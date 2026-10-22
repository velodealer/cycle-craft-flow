INSERT INTO public.app_settings (key, value, business_id)
SELECT 'onboarding:' || b.id, jsonb_build_object('completed', true, 'steps', jsonb_build_object('profile',true,'tax',true,'bays',true,'integrations',true)), b.id
FROM public.businesses b
ON CONFLICT (key) DO NOTHING;