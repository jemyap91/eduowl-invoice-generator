BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(12);

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('d0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zijieynwa@gmail.com', '', now(), '{}', '{"full_name":"Admin"}', now(), now()),
  ('d0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pending@example.com', '', now(), '{}', '{"full_name":"Pending"}', now(), now()),
  ('d0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tutor@example.com', '', now(), '{}', '{"full_name":"Tutor User"}', now(), now());
UPDATE profiles SET role = 'tutor' WHERE id = 'd0000000-0000-0000-0000-000000000003';
INSERT INTO tm_tutors (id, name) VALUES ('e0000000-0000-0000-0000-000000000001', 'Tutor');
INSERT INTO tm_students (id, name) VALUES ('f0000000-0000-0000-0000-000000000001', 'Student');

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT throws_ok(
  $$ SELECT tm_save_assignment(NULL, '{"code":"X01","tutor_id":"e0000000-0000-0000-0000-000000000001","student_id":"f0000000-0000-0000-0000-000000000001","subject":"Math"}', '[{"label":"1 to 1","parent_rate":70,"tutor_rate":50,"sort_order":0}]') $$,
  '42501', NULL, 'non-admin cannot save assignments');

SET LOCAL request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-000000000003","role":"authenticated"}';
SELECT throws_ok(
  $$ SELECT tm_save_assignment(NULL, '{"code":"X01","tutor_id":"e0000000-0000-0000-0000-000000000001","student_id":"f0000000-0000-0000-0000-000000000001","subject":"Math"}', '[{"label":"1 to 1","parent_rate":70,"tutor_rate":50,"sort_order":0}]') $$,
  '42501', NULL, 'a tutor cannot save assignments');

SET LOCAL request.jwt.claims = '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT throws_ok(
  $$ SELECT tm_save_assignment(NULL, '{"code":"X01","tutor_id":"e0000000-0000-0000-0000-000000000001","student_id":"f0000000-0000-0000-0000-000000000001","subject":"Math"}', '[]') $$,
  '22023', NULL, 'an assignment needs at least one tier');
SELECT throws_ok(
  $$ SELECT tm_save_assignment(NULL, '{"code":"X01","tutor_id":"e0000000-0000-0000-0000-000000000001","student_id":"f0000000-0000-0000-0000-000000000001","subject":"Math"}', '[{"label":"Group","parent_rate":80,"tutor_rate":50,"sort_order":0},{"label":"Group","parent_rate":90,"tutor_rate":60,"sort_order":1}]') $$,
  '22023', NULL, 'rate tier labels must be unique');
SELECT throws_ok(
  $$ SELECT tm_save_assignment(NULL, '{"code":"X01","tutor_id":"e0000000-0000-0000-0000-000000000001","student_id":"f0000000-0000-0000-0000-000000000001","subject":"Math"}', '[{"label":"","parent_rate":80,"tutor_rate":50,"sort_order":0}]') $$,
  '22023', NULL, 'every rate tier needs a label');

CREATE TEMP TABLE ids (id UUID);
INSERT INTO ids SELECT tm_save_assignment(NULL,
  '{"code":"X01","tutor_id":"e0000000-0000-0000-0000-000000000001","student_id":"f0000000-0000-0000-0000-000000000001","subject":"Math","deposit_amount":"100","deposit_status":"not_collected"}',
  '[{"label":"Group","parent_rate":80,"tutor_rate":50,"sort_order":0},{"label":"1 to 1","parent_rate":120,"tutor_rate":60,"sort_order":1}]');
SELECT is((SELECT count(*)::int FROM tm_assignments WHERE code = 'X01'), 1, 'assignment inserted');
SELECT is((SELECT count(*)::int FROM tm_rate_tiers WHERE assignment_id = (SELECT id FROM ids)), 2, 'two tiers inserted');
SELECT is((SELECT deposit_status FROM tm_assignments WHERE code = 'X01'), 'not_collected', 'deposit status stored');

-- Remember the Group tier id, then update: rename "1 to 1" to "Zoom", change Group's rate
CREATE TEMP TABLE group_tier AS SELECT id FROM tm_rate_tiers WHERE assignment_id = (SELECT id FROM ids) AND label = 'Group';
SELECT lives_ok(format(
  $$ SELECT tm_save_assignment('%s', '{"code":"X01","tutor_id":"e0000000-0000-0000-0000-000000000001","student_id":"f0000000-0000-0000-0000-000000000001","subject":"Math","status":"paused"}', '[{"label":"Group","parent_rate":90,"tutor_rate":55,"sort_order":0},{"label":"Zoom","parent_rate":50,"tutor_rate":40,"sort_order":1}]') $$,
  (SELECT id FROM ids)), 'update with renamed tier');
SELECT is((SELECT id FROM tm_rate_tiers WHERE assignment_id = (SELECT id FROM ids) AND label = 'Group'), (SELECT id FROM group_tier), 'unchanged label keeps its id');
SELECT is((SELECT parent_rate FROM tm_rate_tiers WHERE assignment_id = (SELECT id FROM ids) AND label = 'Group'), 90.00::numeric, 'existing tier rate updated');
SELECT is((SELECT array_agg(label ORDER BY sort_order) FROM tm_rate_tiers WHERE assignment_id = (SELECT id FROM ids)), ARRAY['Group','Zoom'], 'removed label deleted, new label added');

SELECT * FROM finish();
ROLLBACK;
