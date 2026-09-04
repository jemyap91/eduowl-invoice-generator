BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(9);

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zijieynwa@gmail.com', '', now(), '{}', '{"full_name":"Admin"}', now(), now()),
  ('b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'new.tutor@example.com', '', now(), '{}', '{"full_name":"New Tutor"}', now(), now()),
  ('b0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'link.me@example.com', '', now(), '{}', '{"full_name":"Link Me"}', now(), now()),
  ('b0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'someone@example.com', '', now(), '{}', '{"full_name":"Someone"}', now(), now()),
  ('b0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a.tutor@example.com', '', now(), '{}', '{"full_name":"A Tutor"}', now(), now());
UPDATE profiles SET role = 'tutor' WHERE id = 'b0000000-0000-0000-0000-000000000005';
INSERT INTO tm_tutors (id, name) VALUES ('c0000000-0000-0000-0000-000000000001', 'Existing Unlinked');

-- A pending user cannot approve
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000004","role":"authenticated"}';
SELECT throws_ok($$ SELECT tm_approve_signup('b0000000-0000-0000-0000-000000000002', NULL, 'X', NULL) $$, '42501', NULL, 'non-admin cannot approve');

-- A tutor cannot approve either
SET LOCAL request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000005","role":"authenticated"}';
SELECT throws_ok($$ SELECT tm_approve_signup('b0000000-0000-0000-0000-000000000002', NULL, 'X', NULL) $$, '42501', NULL, 'a tutor cannot approve');

-- Admin creates a new tutor for a pending signup
SET LOCAL request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT lives_ok($$ SELECT tm_approve_signup('b0000000-0000-0000-0000-000000000002', NULL, '  New Tutor ', '9000 0000') $$, 'admin approves by creating a tutor');
SELECT is((SELECT role FROM profiles WHERE id = 'b0000000-0000-0000-0000-000000000002'), 'tutor', 'profile promoted to tutor');
SELECT is((SELECT name FROM tm_tutors WHERE profile_id = 'b0000000-0000-0000-0000-000000000002'), 'New Tutor', 'tutor row created with trimmed name');
SELECT throws_ok($$ SELECT tm_approve_signup('b0000000-0000-0000-0000-000000000002', NULL, 'Again', NULL) $$, '22023', NULL, 'an already-approved profile cannot be approved twice');

-- Admin links a pending signup to an existing unlinked tutor
SELECT lives_ok($$ SELECT tm_approve_signup('b0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', NULL, NULL) $$, 'admin approves by linking');
SELECT is((SELECT profile_id FROM tm_tutors WHERE id = 'c0000000-0000-0000-0000-000000000001'), 'b0000000-0000-0000-0000-000000000003'::uuid, 'existing tutor linked');
SELECT throws_ok($$ SELECT tm_approve_signup('b0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', NULL, NULL) $$, '22023', NULL, 'an already-linked tutor cannot be linked again');

SELECT * FROM finish();
ROLLBACK;
