-- Non-admin callers never supply rates: snapshot them from the chosen tier.
-- Fixtures and service-role scripts (no JWT) are left alone.
CREATE OR REPLACE FUNCTION public.tm_snapshot_entry_rates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tier RECORD;
BEGIN
  IF auth.uid() IS NOT NULL AND public.app_role() <> 'admin' THEN
    IF NEW.rate_tier_id IS NULL THEN
      RAISE EXCEPTION 'rate_tier_id is required' USING ERRCODE = '23502';
    END IF;
    SELECT rt.label, rt.parent_rate, rt.tutor_rate, rt.assignment_id
      INTO tier
      FROM public.tm_rate_tiers rt
     WHERE rt.id = NEW.rate_tier_id;
    IF NOT FOUND OR tier.assignment_id <> NEW.assignment_id THEN
      RAISE EXCEPTION 'rate tier does not belong to this assignment' USING ERRCODE = '23503';
    END IF;
    NEW.tier_label := tier.label;
    NEW.parent_rate := tier.parent_rate;
    NEW.tutor_rate := tier.tutor_rate;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tm_snapshot_entry_rates
  BEFORE INSERT OR UPDATE ON tm_timesheet_entries
  FOR EACH ROW EXECUTE FUNCTION public.tm_snapshot_entry_rates();
