-- Drop unique constraint on (student_id, month, year) to allow multiple invoices
-- per student per month (e.g. manual invoices alongside scheduled ones)
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_student_id_month_year_key;
