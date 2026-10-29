BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(28);

-- Users: tutor A, tutor B, admin
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('a2000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'self.a@example.com', '', now(), '{}', '{"full_name":"Tutor A"}', now(), now()),
  ('a2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'self.b@example.com', '', now(), '{}', '{"full_name":"Tutor B"}', now(), now()),
  ('a2000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ccchristabelle@gmail.com', '', now(), '{}', '{"full_name":"Admin"}', now(), now());
UPDATE profiles SET role = 'tutor' WHERE id IN ('a2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002');
INSERT INTO tm_tutors (id, profile_id, name) VALUES
  ('b2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'Tutor A'),
  ('b2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000002', 'Tutor B');
-- An existing code with the same prefix, so the generated one must skip it
INSERT INTO tm_students (id, name) VALUES ('c2000000-0000-0000-0000-000000000009', 'Zoe Brown');
INSERT INTO tm_assignments (code, tutor_id, student_id, subject) VALUES ('ZB01', 'b2000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000009', 'Math');

SET LOCAL role authenticated;

-- ---- Tutor A adds a student ----
SET LOCAL request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-000000000001","role":"authenticated"}';
INSERT INTO tm_students (id, name, parent_name) VALUES ('c2000000-0000-0000-0000-000000000001', 'Zhao Bin', 'Li Shiwei');
SELECT is((SELECT created_by_tutor_id FROM tm_students WHERE id = 'c2000000-0000-0000-0000-000000000001'),
  'b2000000-0000-0000-0000-000000000001'::uuid, 'the new student is owned by the tutor who added it');
SELECT throws_ok($$ INSERT INTO tm_students (name, created_by_tutor_id) VALUES ('Sneaky', 'b2000000-0000-0000-0000-000000000002') $$,
  '42501', NULL, 'a tutor cannot add a student on behalf of another tutor');
UPDATE tm_students SET remarks = 'WeChat' WHERE id = 'c2000000-0000-0000-0000-000000000001';
SELECT is((SELECT remarks FROM tm_students WHERE id = 'c2000000-0000-0000-0000-000000000001'), 'WeChat', 'the owner can edit the student');

-- ---- Tutor A adds an assignment with their own pay ----
CREATE TEMP TABLE asg AS SELECT tm_tutor_save_assignment(
  '{"student_id":"c2000000-0000-0000-0000-000000000001","subject":"S4 English","timeslot":"Sat 2pm"}',
  '[{"label":"1 to 1","tutor_rate":50,"sort_order":0}]') AS id;
SELECT is((SELECT code FROM tm_assignments WHERE id = (SELECT id FROM asg)), 'ZB02', 'the code is generated from the student name and skips used numbers');
SELECT is((SELECT tutor_id FROM tm_assignments WHERE id = (SELECT id FROM asg)), 'b2000000-0000-0000-0000-000000000001'::uuid, 'the assignment belongs to the calling tutor');
SELECT is((SELECT status FROM tm_assignments WHERE id = (SELECT id FROM asg)), 'active', 'a new assignment starts active');
SELECT is((SELECT tutor_rate FROM tm_rate_tiers_tutor_view WHERE assignment_id = (SELECT id FROM asg)), 50.00::numeric, 'the tutor rate is saved');
SELECT throws_ok($$ SELECT tm_tutor_save_assignment('{"student_id":"c2000000-0000-0000-0000-000000000001","subject":"Math","status":"moved_to_academy"}', '[{"label":"1 to 1","tutor_rate":50}]') $$,
  '22023', NULL, 'tutors cannot use admin-only statuses');
SELECT throws_ok($$ SELECT tm_tutor_save_assignment('{"student_id":"c2000000-0000-0000-0000-000000000001","subject":"Math"}', '[]') $$,
  '22023', NULL, 'at least one rate is required');
SELECT throws_ok($$ SELECT tm_tutor_save_assignment('{"student_id":"c2000000-0000-0000-0000-000000000001","subject":"Math"}', '[{"label":"1 to 1","tutor_rate":-5}]') $$,
  '22023', NULL, 'negative pay is refused');

-- ---- Tutor B cannot see or use A's student or assignment ----
SET LOCAL request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT is((SELECT count(*)::int FROM tm_students WHERE id = 'c2000000-0000-0000-0000-000000000001'), 0, 'another tutor cannot see the student');
UPDATE tm_students SET remarks = 'hijack' WHERE id = 'c2000000-0000-0000-0000-000000000001';
SELECT throws_ok($$ SELECT tm_tutor_save_assignment('{"student_id":"c2000000-0000-0000-0000-000000000001","subject":"Math"}', '[{"label":"1 to 1","tutor_rate":50}]') $$,
  'P0002', NULL, 'another tutor cannot add an assignment for the student');
SELECT throws_ok(format($$ SELECT tm_tutor_save_assignment('{"subject":"Math"}', '[{"label":"1 to 1","tutor_rate":99}]', '%s') $$, (SELECT id FROM asg)),
  'P0002', NULL, 'another tutor cannot edit the assignment');

-- ---- Tutor A logs and submits a month before any parent rate exists ----
SET LOCAL request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-000000000001","role":"authenticated"}';
INSERT INTO tm_timesheet_entries (assignment_id, tutor_id, date, hours, rate_tier_id, tier_label, tutor_rate)
SELECT (SELECT id FROM asg), 'b2000000-0000-0000-0000-000000000001', current_date, 2, v.id, '', 0
FROM tm_rate_tiers_tutor_view v WHERE v.assignment_id = (SELECT id FROM asg);
CREATE TEMP TABLE sub AS SELECT tm_submit_month((SELECT id FROM asg), EXTRACT(YEAR FROM current_date)::int, EXTRACT(MONTH FROM current_date)::int) AS id;
SELECT is((SELECT status FROM tm_submissions WHERE id = (SELECT id FROM sub)), 'submitted', 'a month with no parent rate can still be submitted');

-- ---- Admin ----
SET LOCAL request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-000000000009","role":"authenticated"}';
SELECT is((SELECT remarks FROM tm_students WHERE id = 'c2000000-0000-0000-0000-000000000001'), 'WeChat', 'the other tutor''s update changed nothing');
SELECT is((SELECT parent_rate FROM tm_rate_tiers WHERE assignment_id = (SELECT id FROM asg)), NULL, 'the parent rate starts unset');
SELECT throws_ok($$ SELECT tm_tutor_save_assignment('{"student_id":"c2000000-0000-0000-0000-000000000001","subject":"Math"}', '[{"label":"1 to 1","tutor_rate":50}]') $$,
  '42501', NULL, 'admins without a tutor profile use tm_save_assignment instead');
SELECT throws_ok(format($$ SELECT tm_approve_submission('%s') $$, (SELECT id FROM sub)),
  '22023', 'Set the parent rate for 1 to 1 before approving', 'approval is refused while a parent rate is missing');

UPDATE tm_rate_tiers SET parent_rate = 70 WHERE assignment_id = (SELECT id FROM asg);
SELECT is((SELECT parent_rate FROM tm_timesheet_entries WHERE assignment_id = (SELECT id FROM asg)), 70.00::numeric, 'setting the parent rate fills in the logged sessions');

CREATE TEMP TABLE inv AS SELECT tm_approve_submission((SELECT id FROM sub)) AS id;
SELECT is((SELECT invoice_amount FROM tm_invoices WHERE id = (SELECT id FROM inv)), 140.00::numeric, 'the invoice uses the admin parent rate');
SELECT is((SELECT tutor_payout FROM tm_invoices WHERE id = (SELECT id FROM inv)), 100.00::numeric, 'the payout uses the tutor rate');

-- ---- Tutor A edits: same pay keeps the parent rate, new pay clears it for admin to re-confirm ----
SET LOCAL request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT tm_tutor_save_assignment('{"subject":"S4 English Lit","status":"paused"}', '[{"label":"1 to 1","tutor_rate":50,"sort_order":0}]', (SELECT id FROM asg));
SET LOCAL request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-000000000009","role":"authenticated"}';
SELECT is((SELECT parent_rate FROM tm_rate_tiers WHERE assignment_id = (SELECT id FROM asg)), 70.00::numeric, 'an edit that keeps the pay keeps the parent rate');
SET LOCAL request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT tm_tutor_save_assignment('{"subject":"S4 English Lit","status":"paused"}', '[{"label":"1 to 1","tutor_rate":55,"sort_order":0}]', (SELECT id FROM asg));
SET LOCAL request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-000000000009","role":"authenticated"}';
SELECT is((SELECT parent_rate FROM tm_rate_tiers WHERE assignment_id = (SELECT id FROM asg)), NULL, 'a pay change clears the parent rate so admin re-confirms the margin');

-- ---- Ended assignments are admin-only ----
UPDATE tm_assignments SET status = 'stopped' WHERE id = (SELECT id FROM asg);
SET LOCAL request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT throws_ok(format($$ SELECT tm_tutor_save_assignment('{"subject":"S4 English","status":"active"}', '[{"label":"1 to 1","tutor_rate":55}]', '%s') $$, (SELECT id FROM asg)),
  '42501', NULL, 'a tutor cannot reopen an assignment that has ended');
SELECT lives_ok($$ SELECT tm_tutor_save_assignment('{"student_id":"c2000000-0000-0000-0000-000000000001","subject":"Math"}', '[{"label":"1 to 1","tutor_rate":50}]') $$,
  'the tutor can still add subjects for a student they created');

-- Tutor B once taught Zoe Brown (admin-created); after that assignment ends B cannot add new ones
SET LOCAL request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-000000000009","role":"authenticated"}';
UPDATE tm_assignments SET status = 'stopped' WHERE code = 'ZB01';
SET LOCAL request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT throws_ok($$ SELECT tm_tutor_save_assignment('{"student_id":"c2000000-0000-0000-0000-000000000009","subject":"Science"}', '[{"label":"1 to 1","tutor_rate":50}]') $$,
  'P0002', NULL, 'an ended assignment does not let a tutor add new ones for that student');

-- ---- Adding a student does not outlast a reassignment ----
SET LOCAL request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-000000000001","role":"authenticated"}';
INSERT INTO tm_students (id, name) VALUES ('c2000000-0000-0000-0000-000000000002', 'Moved Kid');
SET LOCAL request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-000000000009","role":"authenticated"}';
INSERT INTO tm_assignments (code, tutor_id, student_id, subject) VALUES ('MK01', 'b2000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000002', 'Math');
SET LOCAL request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT is((SELECT count(*)::int FROM tm_students WHERE id = 'c2000000-0000-0000-0000-000000000002'), 0, 'the tutor who added a student loses access once admin gives it to another tutor');
SELECT throws_ok($$ SELECT tm_tutor_save_assignment('{"student_id":"c2000000-0000-0000-0000-000000000002","subject":"English"}', '[{"label":"1 to 1","tutor_rate":50}]') $$,
  'P0002', NULL, 'and cannot add assignments for them');

SELECT * FROM finish();
ROLLBACK;
