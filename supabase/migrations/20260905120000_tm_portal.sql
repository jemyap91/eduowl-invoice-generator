-- ============================================
-- EduOwl Tutor Matching - tutor portal support
-- ============================================

-- Tutors read their entries through this view, which omits parent_rate.
-- Runs as owner (bypasses table RLS) and filters by caller itself.
CREATE VIEW tm_timesheet_entries_tutor_view AS
  SELECT e.id, e.assignment_id, e.tutor_id, e.date, e.start_time, e.end_time, e.hours,
         e.rate_tier_id, e.tier_label, e.tutor_rate, e.note, e.status,
         e.submission_id, e.invoice_id, e.created_at, e.updated_at
  FROM tm_timesheet_entries e
  WHERE e.tutor_id = public.current_tutor_id() OR public.is_admin();
GRANT SELECT ON tm_timesheet_entries_tutor_view TO authenticated;
REVOKE ALL ON tm_timesheet_entries_tutor_view FROM anon, public;
ALTER VIEW tm_timesheet_entries_tutor_view SET (security_barrier = true);

-- Non-admin callers cannot add, change, or delete draft/returned entries in a month
-- that has a live (submitted or approved) submission for that assignment.
-- Status transitions themselves are made by tm_submit_month and the approval functions.
CREATE OR REPLACE FUNCTION public.tm_guard_locked_month()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment UUID;
  v_date DATE;
BEGIN
  IF auth.uid() IS NULL OR public.app_role() = 'admin' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_assignment := OLD.assignment_id;
    v_date := OLD.date;
  ELSE
    IF NEW.status NOT IN ('draft', 'returned') THEN
      RETURN NEW;
    END IF;
    v_assignment := NEW.assignment_id;
    v_date := NEW.date;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.tm_submissions s
    WHERE s.assignment_id = v_assignment
      AND s.year = EXTRACT(YEAR FROM v_date)::int
      AND s.month = EXTRACT(MONTH FROM v_date)::int
      AND s.status IN ('submitted', 'approved')
  ) THEN
    RAISE EXCEPTION 'This month has already been submitted for approval' USING ERRCODE = '22023';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

CREATE TRIGGER tm_guard_locked_month
  BEFORE INSERT OR UPDATE OR DELETE ON tm_timesheet_entries
  FOR EACH ROW EXECUTE FUNCTION public.tm_guard_locked_month();

-- Submit one assignment's month: create the submission and lock its draft/returned entries.
CREATE OR REPLACE FUNCTION public.tm_submit_month(p_assignment_id UUID, p_year INT, p_month INT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tutor UUID;
  v_id UUID;
  v_count INT;
BEGIN
  SELECT tutor_id INTO v_tutor FROM public.tm_assignments WHERE id = p_assignment_id;
  IF v_tutor IS NULL THEN
    RAISE EXCEPTION 'Assignment not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.is_admin() AND public.current_tutor_id() IS DISTINCT FROM v_tutor THEN
    RAISE EXCEPTION 'You can only submit your own assignments' USING ERRCODE = '42501';
  END IF;
  IF p_month < 1 OR p_month > 12 THEN
    RAISE EXCEPTION 'Invalid month' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.tm_submissions
    WHERE assignment_id = p_assignment_id AND year = p_year AND month = p_month AND status <> 'returned'
  ) THEN
    RAISE EXCEPTION 'This month has already been submitted for approval' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.tm_timesheet_entries e
  WHERE e.assignment_id = p_assignment_id
    AND e.status IN ('draft', 'returned')
    AND EXTRACT(YEAR FROM e.date) = p_year AND EXTRACT(MONTH FROM e.date) = p_month;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'No sessions to submit for this month' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.tm_timesheet_entries e
    WHERE e.assignment_id = p_assignment_id
      AND e.status IN ('draft', 'returned')
      AND EXTRACT(YEAR FROM e.date) = p_year AND EXTRACT(MONTH FROM e.date) = p_month
      AND e.rate_tier_id IS NULL
  ) THEN
    RAISE EXCEPTION 'One or more sessions need a rate tier before submitting' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.tm_submissions (assignment_id, tutor_id, year, month, status)
  VALUES (p_assignment_id, v_tutor, p_year, p_month, 'submitted')
  RETURNING id INTO v_id;

  UPDATE public.tm_timesheet_entries e
     SET status = 'submitted', submission_id = v_id
   WHERE e.assignment_id = p_assignment_id
     AND e.status IN ('draft', 'returned')
     AND EXTRACT(YEAR FROM e.date) = p_year AND EXTRACT(MONTH FROM e.date) = p_month;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tm_submit_month(UUID, INT, INT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.tm_submit_month(UUID, INT, INT) TO authenticated;
