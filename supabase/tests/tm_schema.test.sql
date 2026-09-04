BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(15);

SELECT has_table('public', 'tm_tutors', 'tm_tutors exists');
SELECT has_table('public', 'tm_students', 'tm_students exists');
SELECT has_table('public', 'tm_assignments', 'tm_assignments exists');
SELECT has_table('public', 'tm_rate_tiers', 'tm_rate_tiers exists');
SELECT has_table('public', 'tm_submissions', 'tm_submissions exists');
SELECT has_table('public', 'tm_timesheet_entries', 'tm_timesheet_entries exists');
SELECT has_table('public', 'tm_entry_edits', 'tm_entry_edits exists');
SELECT has_table('public', 'tm_invoices', 'tm_invoices exists');
SELECT has_table('public', 'tm_settings', 'tm_settings exists');
SELECT is((SELECT count(*)::int FROM tm_settings), 1, 'tm_settings is seeded with one row');

-- Fixture: tutor, student, assignment, tier
INSERT INTO tm_tutors (id, name) VALUES ('10000000-0000-0000-0000-000000000001', 'Guan Wen');
INSERT INTO tm_students (id, name, parent_name) VALUES ('20000000-0000-0000-0000-000000000001', 'Janice', 'Debbie');
INSERT INTO tm_assignments (id, code, tutor_id, student_id, subject)
  VALUES ('30000000-0000-0000-0000-000000000001', 'JAJE01', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Sec 2 English');
INSERT INTO tm_rate_tiers (id, assignment_id, label, parent_rate, tutor_rate)
  VALUES ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '1 to 1', 70, 50);

-- Hours are derived from start/end when not supplied
INSERT INTO tm_timesheet_entries (assignment_id, tutor_id, date, start_time, end_time, rate_tier_id, tier_label, parent_rate, tutor_rate)
  VALUES ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date, '14:00', '15:30', '40000000-0000-0000-0000-000000000001', '1 to 1', 70, 50);
SELECT is((SELECT hours FROM tm_timesheet_entries LIMIT 1), 1.50::numeric, 'hours computed from start and end time');

-- Future-dated entries are rejected
SELECT throws_ok(
  $$ INSERT INTO tm_timesheet_entries (assignment_id, tutor_id, date, hours, tier_label, parent_rate, tutor_rate)
     VALUES ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date + 1, 1, '1 to 1', 70, 50) $$,
  '23514', NULL, 'future date violates check constraint');

-- Invoice numbers: TM-YYYYMM-NNN, gap filling, profit generated
INSERT INTO tm_invoices (id, assignment_id, year, month, source, invoice_amount, tutor_payout)
  VALUES ('50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 2026, 8, 'manual', 700, 500);
INSERT INTO tm_invoices (id, assignment_id, year, month, source, invoice_amount, tutor_payout)
  VALUES ('50000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 2026, 8, 'generated', 100, 80);
SELECT is((SELECT invoice_number FROM tm_invoices WHERE id = '50000000-0000-0000-0000-000000000002'), 'TM-202608-002', 'second invoice in a month gets 002');
DELETE FROM tm_invoices WHERE id = '50000000-0000-0000-0000-000000000001';
INSERT INTO tm_invoices (id, assignment_id, year, month, source, invoice_amount, tutor_payout)
  VALUES ('50000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 2026, 8, 'manual', 700, 500);
SELECT is((SELECT invoice_number FROM tm_invoices WHERE id = '50000000-0000-0000-0000-000000000003'), 'TM-202608-001', 'deleted number is reused');
SELECT is((SELECT profit FROM tm_invoices WHERE id = '50000000-0000-0000-0000-000000000003'), 200.00::numeric, 'profit is invoice_amount minus tutor_payout');

SELECT * FROM finish();
ROLLBACK;
