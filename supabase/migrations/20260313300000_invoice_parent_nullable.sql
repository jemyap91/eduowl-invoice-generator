-- Make parent_id optional on invoices (invoices are now driven by student, not parent)
ALTER TABLE invoices ALTER COLUMN parent_id DROP NOT NULL;
