-- ============================================
-- EduOwl Tutor Matching - tutor self-service
-- Tutors add their own students and assignments (subject + their hourly pay).
-- Admin sets the parent rate later; a tier with no parent rate yet has parent_rate NULL,
-- and a submission cannot be approved into an invoice until every session has one.
-- ============================================

ALTER TABLE tm_rate_tiers ALTER COLUMN parent_rate DROP NOT NULL;
ALTER TABLE tm_timesheet_entries ALTER COLUMN parent_rate DROP NOT NULL;

-- Which tutor added the student, if any. Defaults to the caller so tutor inserts need not send it.
ALTER TABLE tm_students
  ADD COLUMN created_by_tutor_id UUID REFERENCES tm_tutors(id) ON DELETE SET NULL
  DEFAULT public.current_tutor_id();
CREATE INDEX idx_tm_students_created_by ON tm_students(created_by_tutor_id);

-- ---------- Student RLS for tutors ----------

-- True once a tutor other than the caller has an assignment for the student. A tutor's claim to a
-- student they added ends there, so adding a student does not outlast a reassignment.
-- Reads only tm_assignments: policies call it on the row being inserted, which a function cannot see.
CREATE OR REPLACE FUNCTION public.tm_student_has_other_tutor(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tm_assignments a
    WHERE a.student_id = p_student_id AND a.tutor_id IS DISTINCT FROM public.current_tutor_id()
  );
$$;
REVOKE ALL ON FUNCTION public.tm_student_has_other_tutor(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.tm_student_has_other_tutor(UUID) TO authenticated;

-- Tutors also see students on their paused assignments, so they can resume them.
DROP POLICY tutor_select_students_on_active_assignments ON tm_students;
CREATE POLICY tutor_select_students_on_live_assignments ON tm_students FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM tm_assignments a
    WHERE a.student_id = tm_students.id
      AND a.tutor_id = public.current_tutor_id()
      AND a.status IN ('active', 'paused')
  ));

CREATE POLICY tutor_select_own_students ON tm_students FOR SELECT TO authenticated
  USING (created_by_tutor_id = public.current_tutor_id() AND NOT public.tm_student_has_other_tutor(id));

CREATE POLICY tutor_insert_own_students ON tm_students FOR INSERT TO authenticated
  WITH CHECK (public.current_tutor_id() IS NOT NULL AND created_by_tutor_id = public.current_tutor_id());

CREATE POLICY tutor_update_own_students ON tm_students FOR UPDATE TO authenticated
  USING (created_by_tutor_id = public.current_tutor_id() AND NOT public.tm_student_has_other_tutor(id))
  WITH CHECK (created_by_tutor_id = public.current_tutor_id());

-- ---------- Assignment codes ----------

-- Same rule as suggestAssignmentCode in src/lib/tm/assignments.ts: initials of the student's
-- first two words (or first two letters of one word), upper-cased, plus the next two-digit number.
CREATE OR REPLACE FUNCTION public.tm_next_assignment_code(p_student_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_words TEXT[];
  v_prefix TEXT;
  v_next INT;
BEGIN
  SELECT COALESCE(array_agg(w ORDER BY ord), ARRAY[]::TEXT[]) INTO v_words
  FROM (
    SELECT regexp_replace(part, '[^A-Za-z]', '', 'g') AS w, ord
    FROM unnest(regexp_split_to_array(replace(COALESCE(p_student_name, ''), '&', ' '), '\s+')) WITH ORDINALITY AS t(part, ord)
  ) words
  WHERE w <> '';

  IF array_length(v_words, 1) >= 2 THEN
    v_prefix := left(v_words[1], 1) || left(v_words[2], 1);
  ELSIF array_length(v_words, 1) = 1 THEN
    v_prefix := rpad(left(v_words[1], 2), 2, 'X');
  ELSE
    v_prefix := 'XX';
  END IF;
  v_prefix := upper(v_prefix);

  -- Serialise code assignment per prefix; released at the end of the caller's transaction.
  PERFORM pg_advisory_xact_lock(hashtext('tm_assignment_code:' || v_prefix));

  SELECT COALESCE(max(substr(upper(code), length(v_prefix) + 1)::int), 0) + 1 INTO v_next
  FROM public.tm_assignments
  WHERE upper(code) LIKE v_prefix || '%'
    AND substr(upper(code), length(v_prefix) + 1) ~ '^[0-9]+$';

  RETURN v_prefix || lpad(v_next::text, 2, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.tm_next_assignment_code(TEXT) FROM public, anon, authenticated;

-- ---------- Tutor saves their own assignment ----------

-- p_assignment: {student_id (insert only), subject, timeslot, status}. status is active, paused or stopped.
-- Tutors can only edit live (active or paused) assignments; once ended, only admin can reopen one.
-- p_tiers: non-empty array of {label, tutor_rate, sort_order}. Parent rates are never taken from tutors:
-- new tiers start with parent_rate NULL, and a tier whose tutor pay changes loses its parent rate,
-- so admin re-confirms the margin before the next approval.
CREATE OR REPLACE FUNCTION public.tm_tutor_save_assignment(p_assignment JSONB, p_tiers JSONB, p_id UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tutor UUID := public.current_tutor_id();
  v_existing public.tm_assignments%ROWTYPE;
  v_student UUID;
  v_student_name TEXT;
  v_subject TEXT;
  v_timeslot TEXT;
  v_status TEXT;
  v_id UUID;
BEGIN
  IF v_tutor IS NULL THEN
    RAISE EXCEPTION 'Only tutors can save their own assignments' USING ERRCODE = '42501';
  END IF;

  IF p_tiers IS NULL OR jsonb_typeof(p_tiers) <> 'array' OR jsonb_array_length(p_tiers) = 0 THEN
    RAISE EXCEPTION 'Add at least one rate' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_tiers) t WHERE COALESCE(btrim(t->>'label'), '') = '') THEN
    RAISE EXCEPTION 'Every rate needs a label' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(p_tiers) t) <> (SELECT count(DISTINCT lower(btrim(t->>'label'))) FROM jsonb_array_elements(p_tiers) t) THEN
    RAISE EXCEPTION 'Rate labels must be unique' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_tiers) t
    WHERE COALESCE(t->>'tutor_rate', '') !~ '^[0-9]+(\.[0-9]+)?$'
  ) THEN
    RAISE EXCEPTION 'Every hourly pay must be a number of 0 or more' USING ERRCODE = '22023';
  END IF;

  v_subject := NULLIF(btrim(COALESCE(p_assignment->>'subject', '')), '');
  IF v_subject IS NULL THEN
    RAISE EXCEPTION 'Enter the subject' USING ERRCODE = '22023';
  END IF;
  v_timeslot := NULLIF(btrim(COALESCE(p_assignment->>'timeslot', '')), '');
  v_status := NULLIF(p_assignment->>'status', '');
  IF v_status IS NOT NULL AND v_status NOT IN ('active', 'paused', 'stopped') THEN
    RAISE EXCEPTION 'Status must be active, paused or stopped' USING ERRCODE = '22023';
  END IF;

  IF p_id IS NULL THEN
    v_student := (p_assignment->>'student_id')::uuid;
    SELECT s.name INTO v_student_name
    FROM public.tm_students s
    WHERE s.id = v_student
      AND ((s.created_by_tutor_id = v_tutor AND NOT public.tm_student_has_other_tutor(s.id))
           OR EXISTS (SELECT 1 FROM public.tm_assignments a
                      WHERE a.student_id = s.id AND a.tutor_id = v_tutor AND a.status IN ('active', 'paused')));
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Student not found' USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO public.tm_assignments (code, tutor_id, student_id, subject, timeslot, status)
    VALUES (public.tm_next_assignment_code(v_student_name), v_tutor, v_student, v_subject, v_timeslot, COALESCE(v_status, 'active'))
    RETURNING id INTO v_id;
  ELSE
    SELECT * INTO v_existing FROM public.tm_assignments WHERE id = p_id FOR UPDATE;
    IF NOT FOUND OR v_existing.tutor_id <> v_tutor THEN
      RAISE EXCEPTION 'Assignment not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_existing.status NOT IN ('active', 'paused') THEN
      RAISE EXCEPTION 'This assignment has ended. Ask EduOwl to reopen it.' USING ERRCODE = '42501';
    END IF;
    UPDATE public.tm_assignments SET
      subject = v_subject,
      timeslot = v_timeslot,
      status = COALESCE(v_status, status)
    WHERE id = p_id
    RETURNING id INTO v_id;
  END IF;

  INSERT INTO public.tm_rate_tiers (assignment_id, label, parent_rate, tutor_rate, sort_order)
  SELECT v_id, btrim(t->>'label'), NULL, (t->>'tutor_rate')::numeric, COALESCE((t->>'sort_order')::int, 0)
  FROM jsonb_array_elements(p_tiers) AS t
  ON CONFLICT (assignment_id, label) DO UPDATE
    SET tutor_rate = EXCLUDED.tutor_rate,
        sort_order = EXCLUDED.sort_order,
        parent_rate = CASE WHEN tm_rate_tiers.tutor_rate = EXCLUDED.tutor_rate THEN tm_rate_tiers.parent_rate ELSE NULL END;

  DELETE FROM public.tm_rate_tiers rt
  WHERE rt.assignment_id = v_id
    AND rt.label NOT IN (SELECT btrim(t->>'label') FROM jsonb_array_elements(p_tiers) AS t);

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tm_tutor_save_assignment(JSONB, JSONB, UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.tm_tutor_save_assignment(JSONB, JSONB, UUID) TO authenticated;

-- ---------- Parent rates filled in later ----------

-- When admin sets a tier's parent rate, sessions logged before it was set pick it up,
-- unless they are already invoiced.
CREATE OR REPLACE FUNCTION public.tm_backfill_entry_parent_rate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_rate IS NOT NULL AND OLD.parent_rate IS NULL THEN
    UPDATE public.tm_timesheet_entries
       SET parent_rate = NEW.parent_rate
     WHERE rate_tier_id = NEW.id
       AND parent_rate IS NULL
       AND status <> 'approved';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tm_backfill_entry_parent_rate
  AFTER UPDATE OF parent_rate ON tm_rate_tiers
  FOR EACH ROW EXECUTE FUNCTION public.tm_backfill_entry_parent_rate();

-- Approval now refuses sessions with no parent rate, after picking up any rate set since.
CREATE OR REPLACE FUNCTION public.tm_approve_submission(p_submission_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.tm_submissions%ROWTYPE;
  v_count INT;
  v_hours NUMERIC;
  v_amount NUMERIC;
  v_payout NUMERIC;
  v_invoice UUID;
  v_missing TEXT;
BEGIN
  IF public.app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can approve submissions' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_sub FROM public.tm_submissions WHERE id = p_submission_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_sub.status <> 'submitted' THEN
    RAISE EXCEPTION 'This submission is not waiting for approval' USING ERRCODE = '22023';
  END IF;

  SELECT count(*), COALESCE(sum(hours), 0) INTO v_count, v_hours
  FROM public.tm_timesheet_entries
  WHERE submission_id = p_submission_id AND status = 'submitted';
  IF v_count = 0 THEN
    RAISE EXCEPTION 'No sessions to approve' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.tm_invoices
    WHERE assignment_id = v_sub.assignment_id AND year = v_sub.year AND month = v_sub.month AND source = 'generated'
  ) THEN
    RAISE EXCEPTION 'An invoice already exists for this month' USING ERRCODE = '22023';
  END IF;

  UPDATE public.tm_timesheet_entries e
     SET parent_rate = rt.parent_rate
    FROM public.tm_rate_tiers rt
   WHERE e.submission_id = p_submission_id AND e.status = 'submitted'
     AND e.parent_rate IS NULL
     AND rt.id = e.rate_tier_id AND rt.parent_rate IS NOT NULL;

  SELECT string_agg(DISTINCT tier_label, ', ') INTO v_missing
  FROM public.tm_timesheet_entries
  WHERE submission_id = p_submission_id AND status = 'submitted' AND parent_rate IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Set the parent rate for % before approving', v_missing USING ERRCODE = '22023';
  END IF;

  -- One line per (tier label, rate), each rounded to cents, then summed.
  SELECT COALESCE(sum(line), 0) INTO v_amount FROM (
    SELECT ROUND(sum(hours * parent_rate), 2) AS line
    FROM public.tm_timesheet_entries
    WHERE submission_id = p_submission_id AND status = 'submitted'
    GROUP BY tier_label, parent_rate
  ) lines;
  SELECT COALESCE(sum(line), 0) INTO v_payout FROM (
    SELECT ROUND(sum(hours * tutor_rate), 2) AS line
    FROM public.tm_timesheet_entries
    WHERE submission_id = p_submission_id AND status = 'submitted'
    GROUP BY tier_label, tutor_rate
  ) lines;

  INSERT INTO public.tm_invoices (assignment_id, year, month, source, total_hours, invoice_amount, tutor_payout)
  VALUES (v_sub.assignment_id, v_sub.year, v_sub.month, 'generated', v_hours, v_amount, v_payout)
  RETURNING id INTO v_invoice;

  UPDATE public.tm_timesheet_entries
     SET status = 'approved', invoice_id = v_invoice
   WHERE submission_id = p_submission_id AND status = 'submitted';

  UPDATE public.tm_submissions
     SET status = 'approved', reviewed_at = now(), invoice_id = v_invoice
   WHERE id = p_submission_id;

  RETURN v_invoice;
END;
$$;
