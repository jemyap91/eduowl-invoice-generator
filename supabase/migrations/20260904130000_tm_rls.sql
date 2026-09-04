-- ============================================
-- EduOwl Tutor Matching - Row Level Security
-- ============================================

-- The tm_tutors.id of the calling user, or NULL.
CREATE OR REPLACE FUNCTION public.current_tutor_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id FROM public.tm_tutors t WHERE t.profile_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT public.app_role() = 'admin';
$$;

-- Tutors read their rate tiers through this view, which omits parent_rate.
-- The view runs as its owner (bypasses table RLS) and filters by caller itself.
CREATE VIEW tm_rate_tiers_tutor_view AS
  SELECT rt.id, rt.assignment_id, rt.label, rt.tutor_rate, rt.sort_order
  FROM tm_rate_tiers rt
  JOIN tm_assignments a ON a.id = rt.assignment_id
  WHERE a.tutor_id = public.current_tutor_id() OR public.is_admin();
GRANT SELECT ON tm_rate_tiers_tutor_view TO authenticated;

-- ---------- Enable RLS ----------
ALTER TABLE tm_tutors ENABLE ROW LEVEL SECURITY;
ALTER TABLE tm_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE tm_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tm_rate_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tm_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tm_timesheet_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE tm_entry_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE tm_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE tm_settings ENABLE ROW LEVEL SECURITY;

-- ---------- Admin: everything ----------
CREATE POLICY admin_all ON tm_tutors FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY admin_all ON tm_students FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY admin_all ON tm_assignments FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY admin_all ON tm_rate_tiers FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY admin_all ON tm_submissions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY admin_all ON tm_timesheet_entries FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY admin_all ON tm_entry_edits FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY admin_all ON tm_invoices FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY admin_all ON tm_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- Tutor: own rows only ----------
CREATE POLICY tutor_select_self ON tm_tutors FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY tutor_select_own_assignments ON tm_assignments FOR SELECT TO authenticated
  USING (tutor_id = public.current_tutor_id());

CREATE POLICY tutor_select_students_on_active_assignments ON tm_students FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM tm_assignments a
    WHERE a.student_id = tm_students.id
      AND a.tutor_id = public.current_tutor_id()
      AND a.status = 'active'
  ));

CREATE POLICY tutor_select_own_entries ON tm_timesheet_entries FOR SELECT TO authenticated
  USING (tutor_id = public.current_tutor_id());

CREATE POLICY tutor_insert_draft_on_active_assignment ON tm_timesheet_entries FOR INSERT TO authenticated
  WITH CHECK (
    tutor_id = public.current_tutor_id()
    AND status = 'draft'
    AND EXISTS (
      SELECT 1 FROM tm_assignments a
      WHERE a.id = assignment_id
        AND a.tutor_id = public.current_tutor_id()
        AND a.status = 'active'
    )
  );

CREATE POLICY tutor_update_editable_entries ON tm_timesheet_entries FOR UPDATE TO authenticated
  USING (tutor_id = public.current_tutor_id() AND status IN ('draft', 'returned'))
  WITH CHECK (
    tutor_id = public.current_tutor_id()
    AND status IN ('draft', 'returned')
    AND EXISTS (
      SELECT 1 FROM tm_assignments a
      WHERE a.id = assignment_id AND a.tutor_id = public.current_tutor_id()
    )
  );

CREATE POLICY tutor_delete_editable_entries ON tm_timesheet_entries FOR DELETE TO authenticated
  USING (tutor_id = public.current_tutor_id() AND status IN ('draft', 'returned'));

CREATE POLICY tutor_select_own_submissions ON tm_submissions FOR SELECT TO authenticated
  USING (tutor_id = public.current_tutor_id());

CREATE POLICY tutor_insert_own_submissions ON tm_submissions FOR INSERT TO authenticated
  WITH CHECK (
    tutor_id = public.current_tutor_id()
    AND status = 'submitted'
    AND EXISTS (
      SELECT 1 FROM tm_assignments a
      WHERE a.id = assignment_id AND a.tutor_id = public.current_tutor_id()
    )
  );

-- No tutor policies on tm_rate_tiers (use the view), tm_entry_edits, tm_invoices, tm_settings.
