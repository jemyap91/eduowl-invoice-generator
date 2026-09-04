-- Update invoice number generation to reuse gaps from deleted invoices
-- Instead of MAX(seq) + 1, find the first available number starting from 1
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  year_month TEXT;
  seq_num INT;
BEGIN
  year_month := LPAD(NEW.year::TEXT, 4, '0') || LPAD(NEW.month::TEXT, 2, '0');

  -- Find the first available sequence number (fills gaps from deleted invoices)
  SELECT COALESCE(
    (SELECT s FROM generate_series(1, 999) s
     WHERE s NOT IN (
       SELECT CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INT)
       FROM invoices
       WHERE invoice_number LIKE 'INV-' || year_month || '-%'
     )
     ORDER BY s
     LIMIT 1),
    1
  ) INTO seq_num;

  NEW.invoice_number := 'INV-' || year_month || '-' || LPAD(seq_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
