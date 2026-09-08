-- ============================================
-- EduOwl Tutor Matching - invoices
-- tm_delete_invoice (admin only; re-opens the month for a generated invoice)
-- and an advisory lock on invoice numbering now that manual invoices add a second writer.
-- ============================================

-- Delete an unpaid invoice. For a generated invoice, its entries and submission go back to 'submitted'.
CREATE OR REPLACE FUNCTION public.tm_delete_invoice(p_invoice_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.tm_invoices%ROWTYPE;
  v_sub_id UUID;
BEGIN
  IF public.app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can delete invoices' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_inv FROM public.tm_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_inv.parent_paid_at IS NOT NULL OR v_inv.tutor_paid_at IS NOT NULL THEN
    RAISE EXCEPTION 'A paid invoice cannot be deleted' USING ERRCODE = '22023';
  END IF;

  IF v_inv.source = 'generated' THEN
    -- Lock order: submission first, then entries (same as every approvals function).
    SELECT id INTO v_sub_id FROM public.tm_submissions WHERE invoice_id = p_invoice_id FOR UPDATE;

    UPDATE public.tm_timesheet_entries
       SET status = 'submitted', invoice_id = NULL
     WHERE invoice_id = p_invoice_id;

    IF v_sub_id IS NOT NULL THEN
      UPDATE public.tm_submissions
         SET status = 'submitted', reviewed_at = NULL, invoice_id = NULL
       WHERE id = v_sub_id;
    END IF;
  END IF;

  DELETE FROM public.tm_invoices WHERE id = p_invoice_id;
END;
$$;

REVOKE ALL ON FUNCTION public.tm_delete_invoice(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.tm_delete_invoice(UUID) TO authenticated;

-- Invoice numbers: TM-YYYYMM-NNN, filling gaps left by deleted invoices.
-- Serialised per month with a transaction-scoped advisory lock so concurrent inserts cannot pick the same number.
CREATE OR REPLACE FUNCTION public.tm_set_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  year_month TEXT;
  seq_num INT;
BEGIN
  year_month := LPAD(NEW.year::TEXT, 4, '0') || LPAD(NEW.month::TEXT, 2, '0');
  PERFORM pg_advisory_xact_lock(hashtext('tm_invoices:' || year_month));
  SELECT COALESCE(
    (SELECT s FROM generate_series(1, 999) s
     WHERE s NOT IN (
       SELECT CAST(SUBSTRING(invoice_number FROM '[0-9]+$') AS INT)
       FROM public.tm_invoices
       WHERE invoice_number LIKE 'TM-' || year_month || '-%'
     )
     ORDER BY s LIMIT 1),
    1
  ) INTO seq_num;
  NEW.invoice_number := 'TM-' || year_month || '-' || LPAD(seq_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$;
