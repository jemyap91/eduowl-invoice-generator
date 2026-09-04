-- Add student_id to invoices so invoices are generated per student
ALTER TABLE invoices ADD COLUMN student_id UUID REFERENCES students(id);

-- Drop old unique constraint (one invoice per parent per month)
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_parent_id_month_year_key;

-- Backfill: for existing invoices, try to assign student_id from parent_students
UPDATE invoices i
SET student_id = (
  SELECT ps.student_id
  FROM parent_students ps
  WHERE ps.parent_id = i.parent_id
  LIMIT 1
)
WHERE i.student_id IS NULL;

-- Delete any invoices that still have no student_id (orphaned invoices with no parent-student link)
DELETE FROM invoices WHERE student_id IS NULL;

-- Make student_id NOT NULL after cleanup
ALTER TABLE invoices ALTER COLUMN student_id SET NOT NULL;

-- Add new unique constraint (one invoice per student per month)
ALTER TABLE invoices ADD CONSTRAINT invoices_student_id_month_year_key UNIQUE (student_id, month, year);

-- Add index for student lookups
CREATE INDEX IF NOT EXISTS idx_invoices_student_month ON invoices(student_id, month, year);
