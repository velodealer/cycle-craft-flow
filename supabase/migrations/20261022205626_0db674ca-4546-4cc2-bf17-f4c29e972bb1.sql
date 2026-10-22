REVOKE EXECUTE ON FUNCTION public.generate_bike_reference(text,text,uuid,uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_bike_reference() FROM PUBLIC, anon, authenticated;