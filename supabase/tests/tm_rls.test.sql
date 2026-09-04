BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(16);

-- Two tutor logins and one admin
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tutor.a@example.com', '', now(), '{}', '{"full_name":"Tutor A"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tutor.b@example.com', '', now(), '{}', '{"full_name":"Tutor B"}', now(), now()),
  ('a0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zijieynwa@gmail.com', '', now(), '{}', '{"full_name":"Admin"}', now(), now());
UPDATE profiles SET role = 'tutor' WHERE id IN ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002');

INSERT INTO tm_tutors (id, profile_id, name) VALUES
  ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Tutor A'),
  ('10000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Tutor B');
INSERT INTO tm_students (id, name, parent_name, parent_phone) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Student of A', 'Parent A', '9111 1111'),
  ('20000000-0000-0000-0000-000000000002', 'Student of B', 'Parent B', '9222 2222');
INSERT INTO tm_assignments (id, code, tutor_id, student_id, subject, status) VALUES
  ('30000000-0000-0000-0000-000000000001', 'A01', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'English', 'active'),
  ('30000000-0000-0000-0000-000000000002', 'B01', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Math', 'active'),
  ('30000000-0000-0000-0000-000000000003', 'A02', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'Science', 'stopped');
INSERT INTO tm_rate_tiers (assignment_id, label, parent_rate, tutor_rate) VALUES
  ('30000000-0000-0000-0000-000000000001', '1 to 1', 70, 50),
  ('30000000-0000-0000-0000-000000000002', '1 to 1', 80, 60);
INSERT INTO tm_timesheet_entries (id, assignment_id, tutor_id, date, hours, tier_label, parent_rate, tutor_rate, status) VALUES
  ('60000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date, 1, '1 to 1', 70, 50, 'draft'),
  ('60000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date, 2, '1 to 1', 70, 50, 'submitted'),
  ('60000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', current_date, 1, '1 to 1', 80, 60, 'draft');
INSERT INTO tm_invoices (assignment_id, year, month, source, invoice_amount, tutor_payout)
  VALUES ('30000000-0000-0000-0000-000000000001', 2026, 8, 'manual', 700, 500);

-- ---- Act as Tutor A ----
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT is(current_tutor_id(), '10000000-0000-0000-0000-000000000001'::uuid, 'current_tutor_id resolves via profile');
SELECT is((SELECT count(*)::int FROM tm_tutors), 1, 'tutor sees only their own tutor row');
SELECT is((SELECT count(*)::int FROM tm_assignments), 2, 'tutor sees only their own assignments (any status)');
SELECT is((SELECT count(*)::int FROM tm_students), 1, 'tutor sees only students on their active assignments');
SELECT is((SELECT count(*)::int FROM tm_timesheet_entries), 2, 'tutor sees only their own entries');
SELECT is((SELECT count(*)::int FROM tm_invoices), 0, 'tutor cannot read invoices');
SELECT is((SELECT count(*)::int FROM tm_settings), 0, 'tutor cannot read settings');
SELECT is((SELECT count(*)::int FROM tm_rate_tiers), 0, 'tutor cannot read the rate tier table directly');
SELECT is((SELECT count(*)::int FROM tm_rate_tiers_tutor_view), 1, 'tutor reads own tiers through the view');
SELECT hasnt_column('public', 'tm_rate_tiers_tutor_view', 'parent_rate', 'the tutor view has no parent_rate column');

-- Can insert a draft on own active assignment
SELECT lives_ok(
  $$ INSERT INTO tm_timesheet_entries (assignment_id, tutor_id, date, hours, tier_label, parent_rate, tutor_rate)
     VALUES ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date, 1, '1 to 1', 70, 50) $$,
  'tutor inserts a draft on own active assignment');
-- Cannot insert on someone else's assignment
SELECT throws_ok(
  $$ INSERT INTO tm_timesheet_entries (assignment_id, tutor_id, date, hours, tier_label, parent_rate, tutor_rate)
     VALUES ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', current_date, 1, '1 to 1', 80, 60) $$,
  '42501', NULL, 'tutor cannot insert on another tutor''s assignment');
-- Cannot insert on own stopped assignment
SELECT throws_ok(
  $$ INSERT INTO tm_timesheet_entries (assignment_id, tutor_id, date, hours, tier_label, parent_rate, tutor_rate)
     VALUES ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', current_date, 1, '1 to 1', 70, 50) $$,
  '42501', NULL, 'tutor cannot insert on a stopped assignment');
-- Cannot change a submitted entry (RLS filters it out of the UPDATE, so 0 rows)
UPDATE tm_timesheet_entries SET hours = 9 WHERE id = '60000000-0000-0000-0000-000000000002';
SELECT is((SELECT hours FROM tm_timesheet_entries WHERE id = '60000000-0000-0000-0000-000000000002'), 2.00::numeric, 'tutor cannot update a submitted entry');
-- Can change a draft
UPDATE tm_timesheet_entries SET hours = 3 WHERE id = '60000000-0000-0000-0000-000000000001';
SELECT is((SELECT hours FROM tm_timesheet_entries WHERE id = '60000000-0000-0000-0000-000000000001'), 3.00::numeric, 'tutor can update a draft entry');

-- ---- Act as admin ----
SET LOCAL request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000009","role":"authenticated"}';
SELECT is((SELECT count(*)::int FROM tm_timesheet_entries), 4, 'admin sees every entry');

SELECT * FROM finish();
ROLLBACK;
