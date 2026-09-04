BEGIN;

-- Create the enum type
CREATE TYPE attendance_status AS ENUM ('pending', 'attended', 'absent', 'cancelled');

-- Add new column with default
ALTER TABLE session_students ADD COLUMN attendance_status attendance_status NOT NULL DEFAULT 'pending';

-- Migrate existing data: attended = true → 'attended'
UPDATE session_students SET attendance_status = 'attended' WHERE attended = true;

-- Migrate existing data: attended = false for PAST sessions → 'absent'
UPDATE session_students ss
SET attendance_status = 'absent'
FROM class_sessions cs
WHERE ss.session_id = cs.id
  AND ss.attended = false
  AND cs.date < CURRENT_DATE;

-- Migrate existing data: attended = false for cancelled sessions → 'cancelled'
UPDATE session_students ss
SET attendance_status = 'cancelled'
FROM class_sessions cs
WHERE ss.session_id = cs.id
  AND ss.attendance_status = 'absent'
  AND cs.status = 'cancelled';

-- Remaining attended = false (future sessions) stay as 'pending' (the default)

-- Drop old column
ALTER TABLE session_students DROP COLUMN attended;

-- Composite index for the primary query pattern (student + status)
CREATE INDEX idx_session_students_student_status ON session_students(student_id, attendance_status);

COMMIT;
