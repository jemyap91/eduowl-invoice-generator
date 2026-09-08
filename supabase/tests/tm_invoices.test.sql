BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(22);

-- Users: tutor A, admin (the signup trigger makes this email an admin)
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('a3000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'invoices.a@example.com', '', now(), '{}', '{"full_name":"Tutor A"}', now(), now()),
  ('a3000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ccchristabelle@gmail.com', '', now(), '{}', '{"full_name":"Admin"}', now(), now());
UPDATE profiles SET role = 'tutor' WHERE id = 'a3000000-0000-0000-0000-000000000001';
INSERT INTO tm_tutors (id, profile_id, name) VALUES ('b3000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'Tutor A');
INSERT INTO tm_students (id, name) VALUES ('c3000000-0000-0000-0000-000000000001', 'Student');
INSERT INTO tm_assignments (id, code, tutor_id, student_id, subject, status) VALUES
  ('d3000000-0000-0000-0000-000000000001', 'IA01', 'b3000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'English', 'active'),
  ('d3000000-0000-0000-0000-000000000002', 'IA02', 'b3000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'Math', 'active');
INSERT INTO tm_rate_tiers (id, assignment_id, label, parent_rate, tutor_rate, sort_order) VALUES
  ('e3000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001', '1 to 1', 70, 50, 0);
INSERT INTO tm_timesheet_entries (id, assignment_id, tutor_id, date, hours, rate_tier_id, tier_label, parent_rate, tutor_rate) VALUES
  ('f3000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001', date_trunc('month', current_date)::date, 1.5, 'e3000000-0000-0000-0000-000000000001', '1 to 1', 70, 50),
  ('f3000000-0000-0000-0000-000000000002', 'd3000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001', current_date, 2, 'e3000000-0000-0000-0000-000000000001', '1 to 1', 70, 50);

-- Tutor A submits, admin approves
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub":"a3000000-0000-0000-0000-000000000001","role":"authenticated"}';
CREATE TEMP TABLE sub AS SELECT tm_submit_month('d3000000-0000-0000-0000-000000000001', EXTRACT(YEAR FROM current_date)::int, EXTRACT(MONTH FROM current_date)::int) AS id;
SET LOCAL request.jwt.claims = '{"sub":"a3000000-0000-0000-0000-000000000009","role":"authenticated"}';
CREATE TEMP TABLE inv AS SELECT tm_approve_submission((SELECT id FROM sub)) AS id;
CREATE TEMP TABLE num AS SELECT invoice_number FROM tm_invoices WHERE id = (SELECT id FROM inv);

-- ---- Tutor cannot delete ----
SET LOCAL request.jwt.claims = '{"sub":"a3000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT throws_ok($$ SELECT tm_delete_invoice((SELECT id FROM inv)) $$, '42501', NULL, 'a tutor cannot delete invoices');

-- ---- Admin refusals ----
SET LOCAL request.jwt.claims = '{"sub":"a3000000-0000-0000-0000-000000000009","role":"authenticated"}';
SELECT throws_ok($$ SELECT tm_delete_invoice('00000000-0000-0000-0000-000000000000') $$, 'P0002', NULL, 'unknown invoice');
UPDATE tm_invoices SET parent_paid_at = current_date WHERE id = (SELECT id FROM inv);
SELECT throws_ok($$ SELECT tm_delete_invoice((SELECT id FROM inv)) $$, '22023', NULL, 'parent-paid invoice cannot be deleted');
UPDATE tm_invoices SET parent_paid_at = NULL, tutor_paid_at = current_date WHERE id = (SELECT id FROM inv);
SELECT throws_ok($$ SELECT tm_delete_invoice((SELECT id FROM inv)) $$, '22023', NULL, 'tutor-paid invoice cannot be deleted');
UPDATE tm_invoices SET tutor_paid_at = NULL WHERE id = (SELECT id FROM inv);

-- ---- Delete a generated invoice re-opens the month ----
SELECT lives_ok($$ SELECT tm_delete_invoice((SELECT id FROM inv)) $$, 'unpaid generated invoice deleted');
SELECT is((SELECT count(*)::int FROM tm_invoices WHERE id = (SELECT id FROM inv)), 0, 'invoice row is gone');
SELECT is((SELECT count(*)::int FROM tm_timesheet_entries WHERE submission_id = (SELECT id FROM sub) AND status = 'submitted' AND invoice_id IS NULL), 2, 'entries are back to submitted with no invoice');
SELECT is((SELECT status FROM tm_submissions WHERE id = (SELECT id FROM sub)), 'submitted', 'submission is back to submitted');
SELECT is((SELECT reviewed_at IS NULL AND invoice_id IS NULL FROM tm_submissions WHERE id = (SELECT id FROM sub)), true, 'submission bookkeeping cleared');
SELECT lives_ok($$ SELECT tm_approve_submission((SELECT id FROM sub)) $$, 'the month can be approved again');
SELECT is((SELECT invoice_number FROM tm_invoices WHERE assignment_id = 'd3000000-0000-0000-0000-000000000001' AND source = 'generated'), (SELECT invoice_number FROM num), 'the freed invoice number is reused');
SELECT is((SELECT status FROM tm_submissions WHERE id = (SELECT id FROM sub)), 'approved', 'submission approved again');

-- ---- Manual invoices and numbering ----
CREATE TEMP TABLE man AS
  WITH ins AS (
    INSERT INTO tm_invoices (assignment_id, year, month, source, total_hours, invoice_amount, tutor_payout)
    VALUES ('d3000000-0000-0000-0000-000000000001', EXTRACT(YEAR FROM current_date)::int, EXTRACT(MONTH FROM current_date)::int, 'manual', NULL, 100, 60)
    RETURNING id, invoice_number
  )
  SELECT * FROM ins;
SELECT matches((SELECT invoice_number FROM man), '-002$', 'a manual invoice takes the next number');
SELECT throws_ok($$ INSERT INTO tm_invoices (assignment_id, year, month, source, invoice_amount, tutor_payout)
  VALUES ('d3000000-0000-0000-0000-000000000001', EXTRACT(YEAR FROM current_date)::int, EXTRACT(MONTH FROM current_date)::int, 'manual', 1, 1) $$,
  '23505', NULL, 'a second manual invoice for the same month is refused');
SELECT lives_ok($$ SELECT tm_delete_invoice((SELECT id FROM man)) $$, 'manual invoice deleted');
SELECT is((SELECT count(*)::int FROM tm_invoices WHERE id = (SELECT id FROM man)), 0, 'manual row is gone');
SELECT is((SELECT count(*)::int FROM tm_invoices WHERE assignment_id = 'd3000000-0000-0000-0000-000000000001' AND source = 'generated'), 1, 'generated invoice untouched by the manual delete');
SELECT is((SELECT count(*)::int FROM tm_timesheet_entries WHERE submission_id = (SELECT id FROM sub) AND status = 'approved'), 2, 'entries untouched by the manual delete');

-- Gap filling: with -001 (generated) and -002 (manual) present, delete -001; the next insert on another assignment takes -001
INSERT INTO tm_invoices (assignment_id, year, month, source, invoice_amount, tutor_payout)
VALUES ('d3000000-0000-0000-0000-000000000001', EXTRACT(YEAR FROM current_date)::int, EXTRACT(MONTH FROM current_date)::int, 'manual', 100, 60);
SELECT lives_ok($$ SELECT tm_delete_invoice((SELECT id FROM tm_invoices WHERE assignment_id = 'd3000000-0000-0000-0000-000000000001' AND source = 'generated')) $$, 'generated invoice deleted again');
CREATE TEMP TABLE man2 AS
  WITH ins AS (
    INSERT INTO tm_invoices (assignment_id, year, month, source, invoice_amount, tutor_payout)
    VALUES ('d3000000-0000-0000-0000-000000000002', EXTRACT(YEAR FROM current_date)::int, EXTRACT(MONTH FROM current_date)::int, 'manual', 50, 30)
    RETURNING invoice_number
  )
  SELECT * FROM ins;
SELECT is((SELECT invoice_number FROM man2), (SELECT invoice_number FROM num), 'the gap left by the deleted invoice is filled');
SELECT is((SELECT count(*)::int FROM tm_timesheet_entries WHERE submission_id = (SELECT id FROM sub) AND status = 'submitted'), 2, 'month re-opened once more');

-- ---- Anon cannot execute ----
SET LOCAL role anon;
SET LOCAL request.jwt.claims = '{"role":"anon"}';
SELECT throws_ok($$ SELECT tm_delete_invoice('00000000-0000-0000-0000-000000000000') $$, '42501', NULL, 'anon has no execute privilege');

SELECT * FROM finish();
ROLLBACK;
