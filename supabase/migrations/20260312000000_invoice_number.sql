-- Add invoice_number column
ALTER TABLE invoices ADD COLUMN invoice_number TEXT UNIQUE;

-- Function to generate invoice number as INV-YYYYMM-NNN
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  year_month TEXT;
  seq_num INT;
BEGIN
  year_month := LPAD(NEW.year::TEXT, 4, '0') || LPAD(NEW.month::TEXT, 2, '0');

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INT)
  ), 0) + 1
  INTO seq_num
  FROM invoices
  WHERE invoice_number LIKE 'INV-' || year_month || '-%';

  NEW.invoice_number := 'INV-' || year_month || '-' || LPAD(seq_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_invoice_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL)
  EXECUTE FUNCTION generate_invoice_number();

-- Backfill existing invoices that have no invoice_number
DO $$
DECLARE
  r RECORD;
  year_month TEXT;
  seq_num INT;
BEGIN
  FOR r IN
    SELECT id, month, year
    FROM invoices
    WHERE invoice_number IS NULL
    ORDER BY created_at
  LOOP
    year_month := LPAD(r.year::TEXT, 4, '0') || LPAD(r.month::TEXT, 2, '0');

    SELECT COALESCE(MAX(
      CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INT)
    ), 0) + 1
    INTO seq_num
    FROM invoices
    WHERE invoice_number LIKE 'INV-' || year_month || '-%';

    UPDATE invoices
    SET invoice_number = 'INV-' || year_month || '-' || LPAD(seq_num::TEXT, 3, '0')
    WHERE id = r.id;
  END LOOP;
END $$;
