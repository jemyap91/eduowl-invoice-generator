-- Add dates_attended column to invoice_items for tracking session dates
ALTER TABLE invoice_items ADD COLUMN dates_attended TEXT;
