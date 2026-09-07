-- ============================================
-- EduOwl Tutor Matching - approvals
-- Admin-only functions: edit a submitted session (with audit row),
-- approve a submission (generates the invoice), send a submission back.
-- ============================================

-- Edit one submitted session. p_patch: {date, start_time, end_time, hours, rate_tier_id, note}.
-- Writes a tm_entry_edits row with the previous values first, in the same transaction.
CREATE OR REPLACE FUNCTION public.tm_edit_entry(p_entry_id UUID, p_patch JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry public.tm_timesheet_entries%ROWTYPE;
  v_tier public.tm_rate_tiers%ROWTYPE;
  v_date DATE;
  v_start TIME;
  v_end TIME;
  v_hours NUMERIC;
  v_effective NUMERIC;
  v_tier_id UUID;
  v_note TEXT;
  v_tier_changed BOOLEAN;
BEGIN
  IF public.app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can edit submitted sessions' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_entry FROM public.tm_timesheet_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_entry.status <> 'submitted' THEN
    RAISE EXCEPTION 'Only sessions waiting for approval can be edited here' USING ERRCODE = '22023';
  END IF;

  v_date := (p_patch->>'date')::date;
  v_start := (p_patch->>'start_time')::time;
  v_end := (p_patch->>'end_time')::time;
  v_hours := ROUND((p_patch->>'hours')::numeric, 2);
  v_tier_id := (p_patch->>'rate_tier_id')::uuid;
  v_note := NULLIF(btrim(COALESCE(p_patch->>'note', '')), '');

  IF v_date IS NULL THEN
    RAISE EXCEPTION 'Enter the session date' USING ERRCODE = '22023';
  END IF;
  IF v_tier_id IS NULL THEN
    RAISE EXCEPTION 'Choose a rate tier' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_tier FROM public.tm_rate_tiers WHERE id = v_tier_id;
  IF NOT FOUND OR v_tier.assignment_id <> v_entry.assignment_id THEN
    RAISE EXCEPTION 'rate tier does not belong to this assignment' USING ERRCODE = '23503';
  END IF;

  -- Effective hours: typed hours, else derived from both times (same rule as tm_set_entry_hours).
  IF v_hours IS NULL AND v_start IS NOT NULL AND v_end IS NOT NULL THEN
    v_effective := ROUND(EXTRACT(EPOCH FROM (v_end - v_start)) / 3600.0, 2);
  ELSE
    v_effective := v_hours;
  END IF;
  IF v_effective IS NULL OR v_effective <= 0 THEN
    RAISE EXCEPTION 'Hours must be more than 0' USING ERRCODE = '22023';
  END IF;

  v_tier_changed := v_tier_id IS DISTINCT FROM v_entry.rate_tier_id;

  IF v_date = v_entry.date
     AND v_start IS NOT DISTINCT FROM v_entry.start_time
     AND v_end IS NOT DISTINCT FROM v_entry.end_time
     AND v_effective = v_entry.hours
     AND NOT v_tier_changed
     AND v_note IS NOT DISTINCT FROM v_entry.note THEN
    RETURN v_entry.id;
  END IF;

  INSERT INTO public.tm_entry_edits (entry_id, edited_by, previous)
  VALUES (
    v_entry.id,
    auth.uid(),
    jsonb_build_object(
      'date', v_entry.date,
      'start_time', v_entry.start_time,
      'end_time', v_entry.end_time,
      'hours', v_entry.hours,
      'tier_label', v_entry.tier_label,
      'note', v_entry.note
    )
  );

  -- hours is NULL when both times are given, so tm_set_entry_hours recomputes it.
  UPDATE public.tm_timesheet_entries SET
    date = v_date,
    start_time = v_start,
    end_time = v_end,
    hours = v_hours,
    rate_tier_id = v_tier_id,
    note = v_note,
    tier_label = CASE WHEN v_tier_changed THEN v_tier.label ELSE tier_label END,
    parent_rate = CASE WHEN v_tier_changed THEN v_tier.parent_rate ELSE parent_rate END,
    tutor_rate = CASE WHEN v_tier_changed THEN v_tier.tutor_rate ELSE tutor_rate END
  WHERE id = v_entry.id;

  RETURN v_entry.id;
END;
$$;

REVOKE ALL ON FUNCTION public.tm_edit_entry(UUID, JSONB) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.tm_edit_entry(UUID, JSONB) TO authenticated;

-- Approve a submission: generate its invoice and lock the entries. Returns the invoice id.
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

REVOKE ALL ON FUNCTION public.tm_approve_submission(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.tm_approve_submission(UUID) TO authenticated;

-- Send a submission back to the tutor with a reason. Entries become editable again.
CREATE OR REPLACE FUNCTION public.tm_return_submission(p_submission_id UUID, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.tm_submissions%ROWTYPE;
  v_reason TEXT;
BEGIN
  IF public.app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can send submissions back' USING ERRCODE = '42501';
  END IF;
  v_reason := NULLIF(btrim(COALESCE(p_reason, '')), '');
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Give the tutor a reason' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_sub FROM public.tm_submissions WHERE id = p_submission_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_sub.status <> 'submitted' THEN
    RAISE EXCEPTION 'This submission is not waiting for approval' USING ERRCODE = '22023';
  END IF;

  -- submission_id is kept for history; tm_submit_month overwrites it on resubmission.
  UPDATE public.tm_timesheet_entries
     SET status = 'returned'
   WHERE submission_id = p_submission_id AND status = 'submitted';

  UPDATE public.tm_submissions
     SET status = 'returned', return_reason = v_reason, reviewed_at = now()
   WHERE id = p_submission_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tm_return_submission(UUID, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.tm_return_submission(UUID, TEXT) TO authenticated;
