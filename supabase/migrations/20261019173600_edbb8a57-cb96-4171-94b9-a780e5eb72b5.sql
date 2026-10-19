REVOKE ALL ON public.invoice_counters FROM anon;
REVOKE EXECUTE ON FUNCTION public.next_invoice_number(uuid) FROM PUBLIC, anon;