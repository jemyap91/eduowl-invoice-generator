BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(30);

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
-- Fixed tier ids: entries now name a tier and the server snapshots the rates from it.
INSERT INTO tm_rate_tiers (id, assignment_id, label, parent_rate, tutor_rate) VALUES
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '1 to 1', 70, 50),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '1 to 1', 80, 60),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', '1 to 1', 70, 50);
INSERT INTO tm_timesheet_entries (id, assignment_id, tutor_id, date, hours, rate_tier_id, tier_label, parent_rate, tutor_rate, status) VALUES
  ('60000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date, 1, '40000000-0000-0000-0000-000000000001', '1 to 1', 70, 50, 'draft'),
  ('60000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date, 2, '40000000-0000-0000-0000-000000000001', '1 to 1', 70, 50, 'submitted'),
  ('60000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', current_date, 1, '40000000-0000-0000-0000-000000000002', '1 to 1', 80, 60, 'draft');
INSERT INTO tm_invoices (assignment_id, year, month, source, invoice_amount, tutor_payout)
  VALUES ('30000000-0000-0000-0000-000000000001', 2026, 8, 'manual', 700, 500);
INSERT INTO tm_entry_edits (entry_id, previous)
  VALUES ('60000000-0000-0000-0000-000000000002', '{"hours": 1}'::jsonb);

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
SELECT is((SELECT count(*)::int FROM tm_rate_tiers_tutor_view), 2, 'tutor reads their own assignments'' tiers through the view, and no one else''s');
SELECT hasnt_column('public', 'tm_rate_tiers_tutor_view', 'parent_rate', 'the tutor view has no parent_rate column');

-- Can insert a draft on own active assignment
SELECT lives_ok(
  $$ INSERT INTO tm_timesheet_entries (assignment_id, tutor_id, date, hours, rate_tier_id, tier_label, parent_rate, tutor_rate)
     VALUES ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date, 1, '40000000-0000-0000-0000-000000000001', '1 to 1', 70, 50) $$,
  'tutor inserts a draft on own active assignment');

-- Rates come from the tier, not from what the tutor sent
SELECT lives_ok(
  $$ INSERT INTO tm_timesheet_entries (id, assignment_id, tutor_id, date, hours, rate_tier_id, tier_label, parent_rate, tutor_rate)
     VALUES ('60000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date, 1, '40000000-0000-0000-0000-000000000001', 'bogus', 1, 999) $$,
  'tutor inserts an entry supplying its own rates');
SELECT is(
  (SELECT tutor_rate FROM tm_timesheet_entries WHERE id = '60000000-0000-0000-0000-000000000004'),
  50.00::numeric, 'tutor_rate is snapshotted from the tier, not the supplied value');
SELECT is(
  (SELECT parent_rate FROM tm_timesheet_entries WHERE id = '60000000-0000-0000-0000-000000000004'),
  70.00::numeric, 'parent_rate is snapshotted from the tier, not the supplied value');
SELECT is(
  (SELECT tier_label FROM tm_timesheet_entries WHERE id = '60000000-0000-0000-0000-000000000004'),
  '1 to 1', 'tier_label is snapshotted from the tier, not the supplied value');

-- The tier must belong to the assignment being billed
SELECT throws_ok(
  $$ INSERT INTO tm_timesheet_entries (assignment_id, tutor_id, date, hours, rate_tier_id, tier_label, parent_rate, tutor_rate)
     VALUES ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date, 1, '40000000-0000-0000-0000-000000000002', '1 to 1', 70, 50) $$,
  '23503', NULL, 'tutor cannot bill own assignment against another assignment''s tier');
-- A tier is mandatory for non-admin callers
SELECT throws_ok(
  $$ INSERT INTO tm_timesheet_entries (assignment_id, tutor_id, date, hours, tier_label, parent_rate, tutor_rate)
     VALUES ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date, 1, '1 to 1', 70, 50) $$,
  '23502', NULL, 'tutor must name a rate tier');

-- Cannot insert on someone else's assignment
SELECT throws_ok(
  $$ INSERT INTO tm_timesheet_entries (assignment_id, tutor_id, date, hours, rate_tier_id, tier_label, parent_rate, tutor_rate)
     VALUES ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', current_date, 1, '40000000-0000-0000-0000-000000000002', '1 to 1', 80, 60) $$,
  '42501', NULL, 'tutor cannot insert on another tutor''s assignment');
-- Cannot insert on own stopped assignment
SELECT throws_ok(
  $$ INSERT INTO tm_timesheet_entries (assignment_id, tutor_id, date, hours, rate_tier_id, tier_label, parent_rate, tutor_rate)
     VALUES ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', current_date, 1, '40000000-0000-0000-0000-000000000003', '1 to 1', 70, 50) $$,
  '42501', NULL, 'tutor cannot insert on a stopped assignment');
-- Cannot change a submitted entry (RLS filters it out of the UPDATE, so 0 rows)
UPDATE tm_timesheet_entries SET hours = 9 WHERE id = '60000000-0000-0000-0000-000000000002';
SELECT is((SELECT hours FROM tm_timesheet_entries WHERE id = '60000000-0000-0000-0000-000000000002'), 2.00::numeric, 'tutor cannot update a submitted entry');
-- Can change a draft
UPDATE tm_timesheet_entries SET hours = 3 WHERE id = '60000000-0000-0000-0000-000000000001';
SELECT is((SELECT hours FROM tm_timesheet_entries WHERE id = '60000000-0000-0000-0000-000000000001'), 3.00::numeric, 'tutor can update a draft entry');

-- Cannot re-target an entry to another tutor's assignment (WITH CHECK violation raises)
SELECT throws_ok(
  $$ UPDATE tm_timesheet_entries
        SET assignment_id = '30000000-0000-0000-0000-000000000002',
            rate_tier_id = '40000000-0000-0000-0000-000000000002'
     WHERE id = '60000000-0000-0000-0000-000000000001' $$,
  '42501', NULL, 'tutor cannot move an entry to another tutor''s assignment');
-- Audit log is invisible to tutors
SELECT is((SELECT count(*)::int FROM tm_entry_edits), 0, 'tutor cannot read entry edits');
-- Delete: submitted entries are untouchable, drafts are deletable
DELETE FROM tm_timesheet_entries WHERE id = '60000000-0000-0000-0000-000000000002';
SELECT is((SELECT count(*)::int FROM tm_timesheet_entries WHERE id = '60000000-0000-0000-0000-000000000002'), 1, 'tutor cannot delete a submitted entry');
DELETE FROM tm_timesheet_entries WHERE id = '60000000-0000-0000-0000-000000000001';
SELECT is((SELECT count(*)::int FROM tm_timesheet_entries WHERE id = '60000000-0000-0000-0000-000000000001'), 0, 'tutor can delete a draft entry');

-- ---- Act as admin ----
SET LOCAL request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000009","role":"authenticated"}';
SELECT is((SELECT count(*)::int FROM tm_timesheet_entries), 4, 'admin sees every entry');

-- ---- Act as anon ----
SET LOCAL role anon;
SET LOCAL request.jwt.claims = '{"role":"anon"}';
SELECT is((SELECT count(*)::int FROM profiles), 0, 'anon cannot read profiles');
SELECT is((SELECT count(*)::int FROM tm_assignments), 0, 'anon cannot read assignments');
SELECT is((SELECT count(*)::int FROM students), 0, 'anon cannot read academy students');
SELECT throws_ok($$ SELECT count(*) FROM tm_rate_tiers_tutor_view $$, '42501', NULL, 'anon has no privilege on the tutor tier view');

SELECT * FROM finish();
ROLLBACK;
