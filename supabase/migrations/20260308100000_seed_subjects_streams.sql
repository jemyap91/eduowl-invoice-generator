-- ============================================
-- Seed: Singapore School Subjects & Levels
-- ============================================

-- Streams (Levels) - Primary
INSERT INTO streams (name, level_order) VALUES
  ('Primary 1', 1),
  ('Primary 2', 2),
  ('Primary 3', 3),
  ('Primary 4', 4),
  ('Primary 5', 5),
  ('Primary 6', 6)
ON CONFLICT (name) DO NOTHING;

-- Streams (Levels) - Secondary
INSERT INTO streams (name, level_order) VALUES
  ('Secondary 1', 7),
  ('Secondary 2', 8),
  ('Secondary 3', 9),
  ('Secondary 4', 10),
  ('Secondary 5', 11)
ON CONFLICT (name) DO NOTHING;

-- Subjects - Primary School
INSERT INTO subjects (name) VALUES
  ('English'),
  ('Mathematics'),
  ('Science'),
  ('Chinese'),
  ('Malay'),
  ('Tamil'),
  ('Higher Chinese'),
  ('Higher Malay'),
  ('Higher Tamil'),
  ('Social Studies')
ON CONFLICT (name) DO NOTHING;

-- Subjects - Secondary School
INSERT INTO subjects (name) VALUES
  ('Additional Mathematics'),
  ('Elementary Mathematics'),
  ('Physics'),
  ('Chemistry'),
  ('Biology'),
  ('Combined Science'),
  ('History'),
  ('Geography'),
  ('Literature in English'),
  ('Principles of Accounting'),
  ('Computing'),
  ('Design & Technology'),
  ('Food & Nutrition'),
  ('Art'),
  ('Music')
ON CONFLICT (name) DO NOTHING;
