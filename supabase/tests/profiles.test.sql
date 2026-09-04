BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(8);

-- Two signups: one admin email, one unknown email. Inserting into auth.users fires the trigger.
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ZijieYnwa@gmail.com', '', now(), '{"provider":"google"}', '{"full_name":"Zijie"}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'someone@gmail.com', '', now(), '{"provider":"google"}', '{"name":"Some One"}', now(), now());

SELECT is((SELECT role FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000001'), 'admin', 'admin email (any case) gets admin role');
SELECT is((SELECT email FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000001'), 'zijieynwa@gmail.com', 'email stored lower-cased');
SELECT is((SELECT role FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000002'), 'pending', 'unknown email gets pending role');
SELECT is((SELECT full_name FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000002'), 'Some One', 'full_name falls back to the name claim');

-- Seed one academy row as postgres so we can test visibility
INSERT INTO public.students (id, name) VALUES ('00000000-0000-0000-0000-00000000aaaa', 'Visible Student');

-- Act as the pending user
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT is(public.app_role(), 'pending', 'app_role() reads the caller''s profile');
SELECT is((SELECT count(*)::int FROM public.profiles), 1, 'pending user sees only their own profile');
SELECT is((SELECT count(*)::int FROM public.students), 0, 'pending user cannot read academy tables');

-- Act as the admin
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT is((SELECT count(*)::int FROM public.students), 1, 'admin reads academy tables');

SELECT * FROM finish();
ROLLBACK;
