-- Rebrand: the seeded academy_info row was 'Pegasus Learning Academy'
UPDATE academy_info SET name = 'EduOwl English Academy' WHERE name = 'Pegasus Learning Academy';
ALTER TABLE academy_info ALTER COLUMN name SET DEFAULT 'EduOwl English Academy';
