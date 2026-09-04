-- Approve a pending signup atomically: link or create the tutor row and promote the profile.
CREATE OR REPLACE FUNCTION public.tm_approve_signup(
  p_profile_id UUID,
  p_tutor_id UUID DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_tutor_id UUID;
BEGIN
  IF public.app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can approve signups' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = p_profile_id FOR UPDATE;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Signup not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_role <> 'pending' THEN
    RAISE EXCEPTION 'Only pending signups can be approved' USING ERRCODE = '22023';
  END IF;

  IF p_tutor_id IS NOT NULL THEN
    UPDATE public.tm_tutors SET profile_id = p_profile_id
     WHERE id = p_tutor_id AND profile_id IS NULL
     RETURNING id INTO v_tutor_id;
    IF v_tutor_id IS NULL THEN
      RAISE EXCEPTION 'Tutor not found or already linked' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF p_name IS NULL OR btrim(p_name) = '' THEN
      RAISE EXCEPTION 'Tutor name is required' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.tm_tutors (name, phone, profile_id)
    VALUES (btrim(p_name), NULLIF(btrim(COALESCE(p_phone, '')), ''), p_profile_id)
    RETURNING id INTO v_tutor_id;
  END IF;

  UPDATE public.profiles SET role = 'tutor' WHERE id = p_profile_id;
  RETURN v_tutor_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tm_approve_signup(UUID, UUID, TEXT, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.tm_approve_signup(UUID, UUID, TEXT, TEXT) TO authenticated;
