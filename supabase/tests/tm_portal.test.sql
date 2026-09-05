BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(19);

-- Users: tutor A, tutor B, admin
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'portal.a@example.com', '', now(), '{}', '{"full_name":"Tutor A"}', now(), now()),
  ('a1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'portal.b@example.com', '', now(), '{}', '{"full_name":"Tutor B"}', now(), now()),
  ('a1000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ccchristabelle@gmail.com', '', now(), '{}', '{"full_name":"Admin"}', now(), now());
UPDATE profiles SET role = 'tutor' WHERE id IN ('a1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002');
INSERT INTO tm_tutors (id, profile_id, name) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Tutor A'),
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'Tutor B');
INSERT INTO tm_students (id, name) VALUES ('c1000000-0000-0000-0000-000000000001', 'Student');
INSERT INTO tm_assignments (id, code, tutor_id, student_id, subject, status) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'PA01', 'b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'English', 'active'),
  ('d1000000-0000-0000-0000-000000000002', 'PB01', 'b1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'Math', 'active');
INSERT INTO tm_rate_tiers (id, assignment_id, label, parent_rate, tutor_rate) VALUES
  ('e1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', '1 to 1', 70, 50),
  ('e1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000002', '1 to 1', 80, 60);
-- Two drafts for A in the current month, one for B
INSERT INTO tm_timesheet_entries (id, assignment_id, tutor_id, date, hours, rate_tier_id, tier_label, parent_rate, tutor_rate) VALUES
  ('f1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', date_trunc('month', current_date)::date, 1.5, 'e1000000-0000-0000-0000-000000000001', '1 to 1', 70, 50),
  ('f1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', current_date, 2, 'e1000000-0000-0000-0000-000000000001', '1 to 1', 70, 50),
  ('f1000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', current_date, 1, 'e1000000-0000-0000-0000-000000000002', '1 to 1', 80, 60);

-- ---- View shape ----
SELECT has_view('public', 'tm_timesheet_entries_tutor_view', 'entries tutor view exists');
SELECT hasnt_column('public', 'tm_timesheet_entries_tutor_view', 'parent_rate', 'the view has no parent_rate');
SELECT has_column('public', 'tm_timesheet_entries_tutor_view', 'tutor_rate', 'the view keeps tutor_rate');

-- ---- Act as Tutor A ----
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT is((SELECT count(*)::int FROM tm_timesheet_entries_tutor_view), 2, 'tutor sees only own entries through the view');

-- Tutor B cannot submit A's assignment
SET LOCAL request.jwt.claims = '{"sub":"a1000000-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT throws_ok($$ SELECT tm_submit_month('d1000000-0000-0000-0000-000000000001', EXTRACT(YEAR FROM current_date)::int, EXTRACT(MONTH FROM current_date)::int) $$,
  '42501', NULL, 'another tutor cannot submit this assignment');

-- Tutor A: nothing to submit for a month with no entries
SET LOCAL request.jwt.claims = '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT throws_ok($$ SELECT tm_submit_month('d1000000-0000-0000-0000-000000000001', 2000, 1) $$,
  '22023', NULL, 'submitting a month with no sessions is refused');

-- Tutor A submits the current month
CREATE TEMP TABLE sub AS SELECT tm_submit_month('d1000000-0000-0000-0000-000000000001', EXTRACT(YEAR FROM current_date)::int, EXTRACT(MONTH FROM current_date)::int) AS id;
SELECT is((SELECT status FROM tm_submissions WHERE id = (SELECT id FROM sub)), 'submitted', 'submission row created');
SELECT is((SELECT count(*)::int FROM tm_timesheet_entries_tutor_view WHERE status = 'submitted' AND submission_id = (SELECT id FROM sub)), 2, 'both drafts locked into the submission');
SELECT throws_ok($$ SELECT tm_submit_month('d1000000-0000-0000-0000-000000000001', EXTRACT(YEAR FROM current_date)::int, EXTRACT(MONTH FROM current_date)::int) $$,
  '22023', NULL, 'a second submission for the same month is refused');

-- Locked month: no new draft, no edit, no delete
SELECT throws_ok($$ INSERT INTO tm_timesheet_entries (assignment_id, tutor_id, date, hours, rate_tier_id, tier_label, parent_rate, tutor_rate)
  VALUES ('d1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', current_date, 1, 'e1000000-0000-0000-0000-000000000001', '', 0, 0) $$,
  '22023', NULL, 'cannot log a session in a submitted month');
UPDATE tm_timesheet_entries SET note = 'x' WHERE id = 'f1000000-0000-0000-0000-000000000001';
SELECT is((SELECT note FROM tm_timesheet_entries_tutor_view WHERE id = 'f1000000-0000-0000-0000-000000000001'), NULL, 'submitted entries are not editable (RLS filters the update)');
DELETE FROM tm_timesheet_entries WHERE id = 'f1000000-0000-0000-0000-000000000001';
SELECT is((SELECT count(*)::int FROM tm_timesheet_entries_tutor_view WHERE id = 'f1000000-0000-0000-0000-000000000001'), 1, 'submitted entries are not deletable');

-- Tutor B's month is untouched: B can still log
SET LOCAL request.jwt.claims = '{"sub":"a1000000-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT lives_ok($$ INSERT INTO tm_timesheet_entries (assignment_id, tutor_id, date, hours, rate_tier_id, tier_label, parent_rate, tutor_rate)
  VALUES ('d1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', current_date, 1, 'e1000000-0000-0000-0000-000000000002', '', 0, 0) $$,
  'another tutor logs in the same month unaffected');
SELECT is((SELECT tutor_rate FROM tm_timesheet_entries_tutor_view WHERE assignment_id = 'd1000000-0000-0000-0000-000000000002' ORDER BY created_at DESC LIMIT 1), 60.00::numeric, 'placeholder rates were overwritten by the snapshot trigger');

-- ---- Admin returns the submission; Tutor A can edit and resubmit ----
RESET role;
RESET request.jwt.claims;
UPDATE tm_submissions SET status = 'returned', return_reason = 'Check the hours', reviewed_at = now() WHERE id = (SELECT id FROM sub);
UPDATE tm_timesheet_entries SET status = 'returned' WHERE submission_id = (SELECT id FROM sub);
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}';
UPDATE tm_timesheet_entries SET hours = 2.5 WHERE id = 'f1000000-0000-0000-0000-000000000002';
SELECT is((SELECT hours FROM tm_timesheet_entries_tutor_view WHERE id = 'f1000000-0000-0000-0000-000000000002'), 2.50::numeric, 'returned entries are editable again');
SELECT lives_ok($$ SELECT tm_submit_month('d1000000-0000-0000-0000-000000000001', EXTRACT(YEAR FROM current_date)::int, EXTRACT(MONTH FROM current_date)::int) $$, 'resubmission creates a new submission');
SELECT is((SELECT count(*)::int FROM tm_submissions WHERE assignment_id = 'd1000000-0000-0000-0000-000000000001'), 2, 'returned submission kept as history');
SELECT is((SELECT count(*)::int FROM tm_timesheet_entries_tutor_view WHERE assignment_id = 'd1000000-0000-0000-0000-000000000001' AND status = 'submitted'), 2, 'entries re-locked under the new submission');

-- ---- Anon sees nothing ----
SET LOCAL role anon;
SET LOCAL request.jwt.claims = '{"role":"anon"}';
SELECT throws_ok($$ SELECT count(*) FROM tm_timesheet_entries_tutor_view $$, '42501', NULL, 'anon has no privilege on the entries view');

SELECT * FROM finish();
ROLLBACK;
