-- ============================================
-- EduOwl Tutor Matching - schema
-- ============================================

CREATE TABLE tm_tutors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID UNIQUE REFERENCES profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tm_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_name TEXT,
  parent_phone TEXT,
  contact_preference TEXT,
  address TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tm_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  tutor_id UUID NOT NULL REFERENCES tm_tutors(id),
  student_id UUID NOT NULL REFERENCES tm_students(id),
  subject TEXT NOT NULL,
  timeslot TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'stopping', 'stopped', 'moved_to_academy')),
  deposit_amount NUMERIC(10,2),
  deposit_status TEXT NOT NULL DEFAULT 'none' CHECK (deposit_status IN ('none', 'not_collected', 'collected')),
  curriculum_briefed BOOLEAN NOT NULL DEFAULT false,
  group_chat_created BOOLEAN NOT NULL DEFAULT false,
  post_trial_checkin_done BOOLEAN NOT NULL DEFAULT false,
  monthly_est_profit NUMERIC(10,2),
  additional_materials TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_tm_assignments_tutor ON tm_assignments(tutor_id);
CREATE INDEX idx_tm_assignments_student ON tm_assignments(student_id);

CREATE TABLE tm_rate_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES tm_assignments(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  parent_rate NUMERIC(10,2) NOT NULL,
  tutor_rate NUMERIC(10,2) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (assignment_id, label)
);

CREATE TABLE tm_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE,
  assignment_id UUID NOT NULL REFERENCES tm_assignments(id),
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  source TEXT NOT NULL CHECK (source IN ('generated', 'manual')),
  total_hours NUMERIC(6,2),
  invoice_amount NUMERIC(10,2) NOT NULL,
  tutor_payout NUMERIC(10,2) NOT NULL,
  profit NUMERIC(10,2) GENERATED ALWAYS AS (invoice_amount - tutor_payout) STORED,
  parent_paid_at DATE,
  tutor_paid_at DATE,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (assignment_id, year, month, source)
);
CREATE INDEX idx_tm_invoices_period ON tm_invoices(year, month);

CREATE TABLE tm_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES tm_assignments(id),
  tutor_id UUID NOT NULL REFERENCES tm_tutors(id),
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'returned')),
  submitted_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  return_reason TEXT,
  invoice_id UUID REFERENCES tm_invoices(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- One live submission per assignment-month; returned ones stay as history
CREATE UNIQUE INDEX idx_tm_submissions_live
  ON tm_submissions(assignment_id, year, month) WHERE status <> 'returned';

CREATE TABLE tm_timesheet_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES tm_assignments(id),
  tutor_id UUID NOT NULL REFERENCES tm_tutors(id),
  date DATE NOT NULL CHECK (date <= current_date),
  start_time TIME,
  end_time TIME,
  hours NUMERIC(5,2) CHECK (hours > 0),
  rate_tier_id UUID REFERENCES tm_rate_tiers(id) ON DELETE SET NULL,
  tier_label TEXT NOT NULL,
  parent_rate NUMERIC(10,2) NOT NULL,
  tutor_rate NUMERIC(10,2) NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'returned')),
  submission_id UUID REFERENCES tm_submissions(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES tm_invoices(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_tm_entries_assignment_date ON tm_timesheet_entries(assignment_id, date);
CREATE INDEX idx_tm_entries_tutor ON tm_timesheet_entries(tutor_id);
CREATE INDEX idx_tm_entries_submission ON tm_timesheet_entries(submission_id);

CREATE TABLE tm_entry_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES tm_timesheet_entries(id) ON DELETE CASCADE,
  edited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  edited_at TIMESTAMPTZ DEFAULT now(),
  previous JSONB NOT NULL
);

CREATE TABLE tm_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'EduOwl',
  legal_name TEXT NOT NULL DEFAULT 'Education Consultancy Pte. Ltd.',
  payment_terms TEXT NOT NULL DEFAULT 'Payment to be made addressed to EDUOWL EDUCATION CONSULTANCY PTE. LTD. within 7 days of invoice',
  paynow_uen TEXT NOT NULL DEFAULT '202411710M',
  qr_code_path TEXT NOT NULL DEFAULT '/tm/paynow-qr.png',
  payment_details TEXT NOT NULL DEFAULT 'PayNow UEN 202411710M',
  default_rate_tiers JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO tm_settings DEFAULT VALUES;

-- ---------- Triggers ----------

-- Derive hours from start/end when hours is not supplied; require one or the other.
CREATE OR REPLACE FUNCTION tm_set_entry_hours()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.hours IS NULL AND NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    NEW.hours := ROUND(EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600.0, 2);
  END IF;
  IF NEW.hours IS NULL THEN
    RAISE EXCEPTION 'hours is required when start_time and end_time are not both set'
      USING ERRCODE = '23502';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tm_set_entry_hours
  BEFORE INSERT OR UPDATE ON tm_timesheet_entries
  FOR EACH ROW EXECUTE FUNCTION tm_set_entry_hours();

CREATE OR REPLACE FUNCTION tm_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER tm_touch_updated_at
  BEFORE UPDATE ON tm_timesheet_entries
  FOR EACH ROW EXECUTE FUNCTION tm_touch_updated_at();

-- Invoice numbers: TM-YYYYMM-NNN, filling gaps left by deleted invoices
CREATE OR REPLACE FUNCTION tm_set_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  year_month TEXT;
  seq_num INT;
BEGIN
  year_month := LPAD(NEW.year::TEXT, 4, '0') || LPAD(NEW.month::TEXT, 2, '0');
  SELECT COALESCE(
    (SELECT s FROM generate_series(1, 999) s
     WHERE s NOT IN (
       SELECT CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INT)
       FROM tm_invoices
       WHERE invoice_number LIKE 'TM-' || year_month || '-%'
     )
     ORDER BY s LIMIT 1),
    1
  ) INTO seq_num;
  NEW.invoice_number := 'TM-' || year_month || '-' || LPAD(seq_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$;
CREATE TRIGGER tm_set_invoice_number
  BEFORE INSERT ON tm_invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL)
  EXECUTE FUNCTION tm_set_invoice_number();
