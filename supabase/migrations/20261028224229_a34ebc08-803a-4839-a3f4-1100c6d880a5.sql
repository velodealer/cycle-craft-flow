DO $$
DECLARE r record; q text; c text; stmt text;
BEGIN
  FOR r IN SELECT * FROM pg_policies WHERE schemaname='public' LOOP
    q := r.qual; c := r.with_check;
    IF q IS NOT NULL THEN
      q := regexp_replace(q, '(has_any_role|has_role)\(([^()]*)\)', '(SELECT \1(\2))', 'g');
      q := regexp_replace(q, '(current_business_id|current_business_status|is_super_admin|get_current_user_role)\(\)', '(SELECT \1())', 'g');
      q := regexp_replace(q, 'auth\.uid\(\)', '(SELECT auth.uid())', 'g');
    END IF;
    IF c IS NOT NULL THEN
      c := regexp_replace(c, '(has_any_role|has_role)\(([^()]*)\)', '(SELECT \1(\2))', 'g');
      c := regexp_replace(c, '(current_business_id|current_business_status|is_super_admin|get_current_user_role)\(\)', '(SELECT \1())', 'g');
      c := regexp_replace(c, 'auth\.uid\(\)', '(SELECT auth.uid())', 'g');
    END IF;
    IF q IS DISTINCT FROM r.qual OR c IS DISTINCT FROM r.with_check THEN
      stmt := format('ALTER POLICY %I ON public.%I', r.policyname, r.tablename);
      IF q IS NOT NULL THEN stmt := stmt || ' USING (' || q || ')'; END IF;
      IF c IS NOT NULL THEN stmt := stmt || ' WITH CHECK (' || c || ')'; END IF;
      EXECUTE stmt;
    END IF;
  END LOOP;
END $$;