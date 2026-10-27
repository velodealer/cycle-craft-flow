ALTER TABLE public.bike_collections DROP CONSTRAINT IF EXISTS bike_collections_order_id_key;
DROP INDEX IF EXISTS public.bike_collections_order_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS bike_collections_order_bike_key ON public.bike_collections (order_id, bike_id);