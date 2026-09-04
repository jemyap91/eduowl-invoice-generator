-- Add level column to subjects for stream-based filtering
ALTER TABLE subjects ADD COLUMN level TEXT NOT NULL DEFAULT 'all'
  CHECK (level IN ('primary', 'secondary', 'all'));

-- Set levels for existing subjects
UPDATE subjects SET level = 'all' WHERE name IN (
  'English', 'Chinese', 'Malay', 'Tamil',
  'Higher Chinese', 'Higher Malay', 'Higher Tamil'
);

UPDATE subjects SET level = 'primary' WHERE name IN (
  'Mathematics', 'Science', 'Social Studies'
);

UPDATE subjects SET level = 'secondary' WHERE name IN (
  'Additional Mathematics', 'Elementary Mathematics',
  'Physics', 'Chemistry', 'Biology', 'Combined Science',
  'History', 'Geography', 'Literature in English',
  'Principles of Accounting', 'Computing',
  'Design & Technology', 'Food & Nutrition',
  'Art', 'Music'
);
