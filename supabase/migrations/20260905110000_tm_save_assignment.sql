-- Save an assignment and its rate tiers atomically. Admin only.
-- p_id NULL inserts; otherwise updates that row.
-- p_assignment: jsonb with the tm_assignments columns (code, tutor_id, student_id, subject, timeslot,
--   status, deposit_amount, deposit_status, curriculum_briefed, group_chat_created,
--   post_trial_checkin_done, monthly_est_profit, additional_materials, remarks).
-- p_tiers: jsonb array of {label, parent_rate, tutor_rate, sort_order}; must be non-empty.
-- Tiers are upserted on (assignment_id, label) so unchanged labels keep their ids; labels not in p_tiers are deleted.
CREATE OR REPLACE FUNCTION public.tm_save_assignment(p_assignment JSONB, p_tiers JSONB, p_id UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF public.app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can save assignments' USING ERRCODE = '42501';
  END IF;
  IF p_tiers IS NULL OR jsonb_typeof(p_tiers) <> 'array' OR jsonb_array_length(p_tiers) = 0 THEN
    RAISE EXCEPTION 'An assignment needs at least one rate tier' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_tiers) t WHERE COALESCE(btrim(t->>'label'), '') = '') THEN
    RAISE EXCEPTION 'Every rate tier needs a label' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(p_tiers) t) <> (SELECT count(DISTINCT lower(btrim(t->>'label'))) FROM jsonb_array_elements(p_tiers) t) THEN
    RAISE EXCEPTION 'Rate tier labels must be unique' USING ERRCODE = '22023';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.tm_assignments (
      code, tutor_id, student_id, subject, timeslot, status, deposit_amount, deposit_status,
      curriculum_briefed, group_chat_created, post_trial_checkin_done, monthly_est_profit,
      additional_materials, remarks
    ) VALUES (
      p_assignment->>'code', (p_assignment->>'tutor_id')::uuid, (p_assignment->>'student_id')::uuid,
      p_assignment->>'subject', p_assignment->>'timeslot', COALESCE(p_assignment->>'status', 'active'),
      (p_assignment->>'deposit_amount')::numeric, COALESCE(p_assignment->>'deposit_status', 'none'),
      COALESCE((p_assignment->>'curriculum_briefed')::boolean, false),
      COALESCE((p_assignment->>'group_chat_created')::boolean, false),
      COALESCE((p_assignment->>'post_trial_checkin_done')::boolean, false),
      (p_assignment->>'monthly_est_profit')::numeric,
      p_assignment->>'additional_materials', p_assignment->>'remarks'
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.tm_assignments SET
      code = p_assignment->>'code',
      tutor_id = (p_assignment->>'tutor_id')::uuid,
      student_id = (p_assignment->>'student_id')::uuid,
      subject = p_assignment->>'subject',
      timeslot = p_assignment->>'timeslot',
      status = COALESCE(p_assignment->>'status', 'active'),
      deposit_amount = (p_assignment->>'deposit_amount')::numeric,
      deposit_status = COALESCE(p_assignment->>'deposit_status', 'none'),
      curriculum_briefed = COALESCE((p_assignment->>'curriculum_briefed')::boolean, false),
      group_chat_created = COALESCE((p_assignment->>'group_chat_created')::boolean, false),
      post_trial_checkin_done = COALESCE((p_assignment->>'post_trial_checkin_done')::boolean, false),
      monthly_est_profit = (p_assignment->>'monthly_est_profit')::numeric,
      additional_materials = p_assignment->>'additional_materials',
      remarks = p_assignment->>'remarks'
    WHERE id = p_id
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Assignment not found' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  INSERT INTO public.tm_rate_tiers (assignment_id, label, parent_rate, tutor_rate, sort_order)
  SELECT v_id, t->>'label', (t->>'parent_rate')::numeric, (t->>'tutor_rate')::numeric, COALESCE((t->>'sort_order')::int, 0)
  FROM jsonb_array_elements(p_tiers) AS t
  ON CONFLICT (assignment_id, label) DO UPDATE
    SET parent_rate = EXCLUDED.parent_rate, tutor_rate = EXCLUDED.tutor_rate, sort_order = EXCLUDED.sort_order;

  DELETE FROM public.tm_rate_tiers rt
  WHERE rt.assignment_id = v_id
    AND rt.label NOT IN (SELECT t->>'label' FROM jsonb_array_elements(p_tiers) AS t);

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tm_save_assignment(JSONB, JSONB, UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.tm_save_assignment(JSONB, JSONB, UUID) TO authenticated;
