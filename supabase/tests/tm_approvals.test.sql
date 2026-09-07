BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(44);

-- Users: tutor A, tutor B, admin (the signup trigger makes this email an admin)
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('a2000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'approvals.a@example.com', '', now(), '{}', '{"full_name":"Tutor A"}', now(), now()),
  ('a2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'approvals.b@example.com', '', now(), '{}', '{"full_name":"Tutor B"}', now(), now()),
  ('a2000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ccchristabelle@gmail.com', '', now(), '{}', '{"full_name":"Admin"}', now(), now());
UPDATE profiles SET role = 'tutor' WHERE id IN ('a2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002');
INSERT INTO tm_tutors (id, profile_id, name) VALUES
  ('b2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'Tutor A'),
  ('b2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000002', 'Tutor B');
INSERT INTO tm_students (id, name) VALUES ('c2000000-0000-0000-0000-000000000001', 'Student');
INSERT INTO tm_assignments (id, code, tutor_id, student_id, subject, status) VALUES
  ('d2000000-0000-0000-0000-000000000001', 'AA01', 'b2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'English', 'active'),
  ('d2000000-0000-0000-0000-000000000002', 'AB01', 'b2000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000001', 'Math', 'active');
INSERT INTO tm_rate_tiers (id, assignment_id, label, parent_rate, tutor_rate, sort_order) VALUES
  ('e2000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001', '1 to 1', 70, 50, 0),
  ('e2000000-0000-0000-0000-000000000002', 'd2000000-0000-0000-0000-000000000001', 'Group', 40, 30, 1),
  ('e2000000-0000-0000-0000-000000000003', 'd2000000-0000-0000-0000-000000000002', '1 to 1', 80, 60, 0);
-- Two drafts for A in the current month (both "1 to 1"), plus one old draft that is never submitted
INSERT INTO tm_timesheet_entries (id, assignment_id, tutor_id, date, hours, rate_tier_id, tier_label, parent_rate, tutor_rate, note) VALUES
  ('f2000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', date_trunc('month', current_date)::date, 1.5, 'e2000000-0000-0000-0000-000000000001', '1 to 1', 70, 50, 'first'),
  ('f2000000-0000-0000-0000-000000000002', 'd2000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', current_date, 2, 'e2000000-0000-0000-0000-000000000001', '1 to 1', 70, 50, NULL),
  ('f2000000-0000-0000-0000-000000000003', 'd2000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-000000000001', '2000-01-15', 1, 'e2000000-0000-0000-0000-000000000001', '1 to 1', 70, 50, 'old draft');

-- Tutor A submits the current month
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-000000000001","role":"authenticated"}';
CREATE TEMP TABLE sub AS SELECT tm_submit_month('d2000000-0000-0000-0000-000000000001', EXTRACT(YEAR FROM current_date)::int, EXTRACT(MONTH FROM current_date)::int) AS id;

-- ---- Tutors cannot call any of the three ----
SELECT throws_ok($$ SELECT tm_edit_entry('f2000000-0000-0000-0000-000000000001', '{"date":"2026-01-01","hours":1,"rate_tier_id":"e2000000-0000-0000-0000-000000000001"}') $$,
  '42501', NULL, 'a tutor cannot edit through tm_edit_entry');
SELECT throws_ok($$ SELECT tm_approve_submission((SELECT id FROM sub)) $$, '42501', NULL, 'a tutor cannot approve');
SELECT throws_ok($$ SELECT tm_return_submission((SELECT id FROM sub), 'no') $$, '42501', NULL, 'a tutor cannot send back');

-- ---- Admin edits ----
SET LOCAL request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-000000000009","role":"authenticated"}';
SELECT throws_ok($$ SELECT tm_edit_entry('f2000000-0000-0000-0000-000000000003', '{"date":"2000-01-15","hours":1,"rate_tier_id":"e2000000-0000-0000-0000-000000000001"}') $$,
  '22023', NULL, 'a draft entry cannot be edited here');
SELECT throws_ok($$ SELECT tm_edit_entry('00000000-0000-0000-0000-000000000000', '{"date":"2000-01-15","hours":1,"rate_tier_id":"e2000000-0000-0000-0000-000000000001"}') $$,
  'P0002', NULL, 'unknown entry');
SELECT throws_ok(format($q$ SELECT tm_edit_entry('f2000000-0000-0000-0000-000000000001', '{"date":"%s","hours":1}') $q$, date_trunc('month', current_date)::date),
  '22023', NULL, 'a tier is required');
SELECT throws_ok(format($q$ SELECT tm_edit_entry('f2000000-0000-0000-0000-000000000001', '{"date":"%s","hours":1,"rate_tier_id":"e2000000-0000-0000-0000-000000000003"}') $q$, date_trunc('month', current_date)::date),
  '23503', NULL, 'the tier must belong to the entry''s assignment');
SELECT throws_ok(format($q$ SELECT tm_edit_entry('f2000000-0000-0000-0000-000000000001', '{"date":"%s","hours":0,"rate_tier_id":"e2000000-0000-0000-0000-000000000001"}') $q$, date_trunc('month', current_date)::date),
  '22023', NULL, 'hours must be positive');
SELECT throws_ok(format($q$ SELECT tm_edit_entry('f2000000-0000-0000-0000-000000000001', '{"date":"%s","hours":1.5,"rate_tier_id":"e2000000-0000-0000-0000-000000000001"}') $q$, to_char(date_trunc('month', current_date) - interval '1 month', 'YYYY-MM') || '-15'),
  '22023', NULL, 'the date must stay in the submitted month');

-- An unchanged patch writes no audit row
SELECT lives_ok(format($q$ SELECT tm_edit_entry('f2000000-0000-0000-0000-000000000001', '{"date":"%s","hours":1.5,"rate_tier_id":"e2000000-0000-0000-0000-000000000001","note":"first"}') $q$, date_trunc('month', current_date)::date),
  'an unchanged patch is accepted');
SELECT is((SELECT count(*)::int FROM tm_entry_edits WHERE entry_id = 'f2000000-0000-0000-0000-000000000001'), 0, 'no audit row for an unchanged patch');

-- Changing the tier writes one audit row and re-snapshots the rates
SELECT lives_ok(format($q$ SELECT tm_edit_entry('f2000000-0000-0000-0000-000000000001', '{"date":"%s","hours":1.5,"rate_tier_id":"e2000000-0000-0000-0000-000000000002","note":"first"}') $q$, date_trunc('month', current_date)::date),
  'tier change accepted');
SELECT is((SELECT count(*)::int FROM tm_entry_edits WHERE entry_id = 'f2000000-0000-0000-0000-000000000001'), 1, 'one audit row after the tier change');
SELECT is((SELECT previous->>'tier_label' FROM tm_entry_edits WHERE entry_id = 'f2000000-0000-0000-0000-000000000001'), '1 to 1', 'audit row holds the previous tier label');
SELECT is((SELECT (previous->>'hours')::numeric FROM tm_entry_edits WHERE entry_id = 'f2000000-0000-0000-0000-000000000001'), 1.50::numeric, 'audit row holds the previous hours');
SELECT is((SELECT edited_by FROM tm_entry_edits WHERE entry_id = 'f2000000-0000-0000-0000-000000000001'), 'a2000000-0000-0000-0000-000000000009'::uuid, 'audit row records the admin');
SELECT is((SELECT tier_label FROM tm_timesheet_entries WHERE id = 'f2000000-0000-0000-0000-000000000001'), 'Group', 'entry took the new tier label');
SELECT is((SELECT parent_rate FROM tm_timesheet_entries WHERE id = 'f2000000-0000-0000-0000-000000000001'), 40::numeric, 'entry took the new parent rate');
SELECT is((SELECT tutor_rate FROM tm_timesheet_entries WHERE id = 'f2000000-0000-0000-0000-000000000001'), 30::numeric, 'entry took the new tutor rate');
SELECT is((SELECT status FROM tm_timesheet_entries WHERE id = 'f2000000-0000-0000-0000-000000000001'), 'submitted', 'status is untouched by an edit');

-- Times with null hours: the hours trigger recomputes
SELECT lives_ok(format($q$ SELECT tm_edit_entry('f2000000-0000-0000-0000-000000000002', '{"date":"%s","start_time":"14:00","end_time":"16:30","hours":null,"rate_tier_id":"e2000000-0000-0000-0000-000000000001","note":null}') $q$, current_date),
  'edit with times accepted');
SELECT is((SELECT hours FROM tm_timesheet_entries WHERE id = 'f2000000-0000-0000-0000-000000000002'), 2.50::numeric, 'hours recomputed from the new times');
SELECT is((SELECT count(*)::int FROM tm_entry_edits WHERE entry_id = 'f2000000-0000-0000-0000-000000000002'), 1, 'one audit row for the time change');

-- ---- Send back ----
SELECT throws_ok($$ SELECT tm_return_submission((SELECT id FROM sub), '   ') $$, '22023', NULL, 'a reason is required');
SELECT lives_ok($$ SELECT tm_return_submission((SELECT id FROM sub), '  Check the hours ') $$, 'send back accepted');
SELECT is((SELECT status FROM tm_submissions WHERE id = (SELECT id FROM sub)), 'returned', 'submission is returned');
SELECT is((SELECT return_reason FROM tm_submissions WHERE id = (SELECT id FROM sub)), 'Check the hours', 'reason is trimmed and stored');
SELECT isnt((SELECT reviewed_at FROM tm_submissions WHERE id = (SELECT id FROM sub)), NULL, 'reviewed_at is stamped on return');
SELECT is((SELECT count(*)::int FROM tm_timesheet_entries WHERE submission_id = (SELECT id FROM sub) AND status = 'returned'), 2, 'both entries are returned');
SELECT throws_ok($$ SELECT tm_return_submission((SELECT id FROM sub), 'again') $$, '22023', NULL, 'cannot send back twice');

-- ---- Tutor A fixes and resubmits ----
SET LOCAL request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-000000000001","role":"authenticated"}';
UPDATE tm_timesheet_entries SET hours = 1 WHERE id = 'f2000000-0000-0000-0000-000000000001';
SELECT is((SELECT hours FROM tm_timesheet_entries_tutor_view WHERE id = 'f2000000-0000-0000-0000-000000000001'), 1.00::numeric, 'tutor can edit a returned entry');
CREATE TEMP TABLE sub2 AS SELECT tm_submit_month('d2000000-0000-0000-0000-000000000001', EXTRACT(YEAR FROM current_date)::int, EXTRACT(MONTH FROM current_date)::int) AS id;
SELECT is((SELECT count(*)::int FROM tm_timesheet_entries_tutor_view WHERE submission_id = (SELECT id FROM sub2) AND status = 'submitted'), 2, 'resubmission picks up both entries');

-- ---- Approve ----
SET LOCAL request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-000000000009","role":"authenticated"}';
SELECT throws_ok($$ SELECT tm_approve_submission((SELECT id FROM sub)) $$, '22023', NULL, 'a returned submission cannot be approved');
SELECT throws_ok($$ SELECT tm_approve_submission('00000000-0000-0000-0000-000000000000') $$, 'P0002', NULL, 'unknown submission');
CREATE TEMP TABLE inv AS SELECT tm_approve_submission((SELECT id FROM sub2)) AS id;
SELECT matches((SELECT invoice_number FROM tm_invoices WHERE id = (SELECT id FROM inv)), '^TM-' || to_char(current_date, 'YYYYMM') || '-[0-9]{3}$', 'invoice numbered for the month');
SELECT is((SELECT source FROM tm_invoices WHERE id = (SELECT id FROM inv)), 'generated', 'invoice is generated');
-- e1: Group 1.0h (40/30); e2: 1 to 1 2.5h (70/50)
SELECT is((SELECT total_hours FROM tm_invoices WHERE id = (SELECT id FROM inv)), 3.50::numeric, 'total hours summed');
SELECT is((SELECT invoice_amount FROM tm_invoices WHERE id = (SELECT id FROM inv)), 215.00::numeric, 'invoice amount is 1.0x40 + 2.5x70');
SELECT is((SELECT tutor_payout FROM tm_invoices WHERE id = (SELECT id FROM inv)), 155.00::numeric, 'tutor payout is 1.0x30 + 2.5x50');
SELECT is((SELECT count(*)::int FROM tm_timesheet_entries WHERE submission_id = (SELECT id FROM sub2) AND status = 'approved' AND invoice_id = (SELECT id FROM inv)), 2, 'entries approved with the invoice id');
SELECT is((SELECT status FROM tm_submissions WHERE id = (SELECT id FROM sub2)), 'approved', 'submission approved');
SELECT is((SELECT invoice_id FROM tm_submissions WHERE id = (SELECT id FROM sub2)), (SELECT id FROM inv), 'submission points at the invoice');
SELECT throws_ok($$ SELECT tm_approve_submission((SELECT id FROM sub2)) $$, '22023', NULL, 'cannot approve twice');
SELECT throws_ok(format($q$ SELECT tm_edit_entry('f2000000-0000-0000-0000-000000000001', '{"date":"%s","hours":1,"rate_tier_id":"e2000000-0000-0000-0000-000000000002"}') $q$, date_trunc('month', current_date)::date),
  '22023', NULL, 'approved entries cannot be edited');

SELECT * FROM finish();
ROLLBACK;
