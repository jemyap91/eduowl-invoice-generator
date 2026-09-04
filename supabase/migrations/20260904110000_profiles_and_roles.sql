-- ============================================
-- Profiles, roles, and admin-only access to the Academy tables
-- ============================================

CREATE TABLE admin_emails (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO admin_emails (email) VALUES ('zijieynwa@gmail.com'), ('ccchristabelle@gmail.com');

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'pending' CHECK (role IN ('pending', 'tutor', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_profiles_role ON profiles(role);

-- Create a profile for every new auth user. Admin emails get 'admin', everyone else 'pending'.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    lower(NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    CASE
      WHEN EXISTS (SELECT 1 FROM public.admin_emails a WHERE lower(a.email) = lower(NEW.email)) THEN 'admin'
      ELSE 'pending'
    END
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- The role of the calling user, for RLS policies. SECURITY DEFINER so it can read
-- profiles without triggering the profiles RLS (which would recurse).
CREATE OR REPLACE FUNCTION public.app_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()), 'anon');
$$;

-- RLS: profiles and admin_emails
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.app_role() = 'admin');
CREATE POLICY profiles_admin_update ON profiles FOR UPDATE TO authenticated
  USING (public.app_role() = 'admin') WITH CHECK (public.app_role() = 'admin');
CREATE POLICY profiles_admin_delete ON profiles FOR DELETE TO authenticated
  USING (public.app_role() = 'admin');

ALTER TABLE admin_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_emails_admin_all ON admin_emails FOR ALL TO authenticated
  USING (public.app_role() = 'admin') WITH CHECK (public.app_role() = 'admin');

-- RLS: every existing Academy table becomes admin-only
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'subjects', 'streams', 'classrooms', 'class_types',
    'tutors', 'students', 'parents', 'parent_students',
    'class_series', 'class_sessions', 'session_students',
    'invoices', 'invoice_items', 'payment_methods', 'academy_info',
    'tutor_subjects', 'tutor_streams', 'student_subjects', 'subject_streams'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY admin_all ON public.%I FOR ALL TO authenticated USING (public.app_role() = ''admin'') WITH CHECK (public.app_role() = ''admin'')',
      t
    );
  END LOOP;
END $$;
