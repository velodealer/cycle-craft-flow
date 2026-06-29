
CREATE TABLE public.social_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'walkaround',
  body TEXT NOT NULL DEFAULT '',
  variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_template BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_scripts TO authenticated;
GRANT ALL ON public.social_scripts TO service_role;
ALTER TABLE public.social_scripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scripts_read" ON public.social_scripts FOR SELECT TO authenticated USING (true);
CREATE POLICY "scripts_insert" ON public.social_scripts FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "scripts_update" ON public.social_scripts FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR has_any_role(ARRAY['admin'::user_role, 'social_manager'::user_role]));
CREATE POLICY "scripts_delete" ON public.social_scripts FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR has_any_role(ARRAY['admin'::user_role, 'social_manager'::user_role]));
CREATE TRIGGER set_social_scripts_updated BEFORE UPDATE ON public.social_scripts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID REFERENCES public.bikes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  hook TEXT,
  hashtags TEXT[] NOT NULL DEFAULT '{}',
  platforms TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','posted','archived')),
  scheduled_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  assigned_to UUID,
  created_by UUID,
  video_url TEXT,
  thumbnail_url TEXT,
  script_id UUID REFERENCES public.social_scripts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_posts TO authenticated;
GRANT ALL ON public.social_posts TO service_role;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts_read" ON public.social_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "posts_insert" ON public.social_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "posts_update" ON public.social_posts FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = assigned_to OR has_any_role(ARRAY['admin'::user_role, 'social_manager'::user_role]));
CREATE POLICY "posts_delete" ON public.social_posts FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR has_any_role(ARRAY['admin'::user_role, 'social_manager'::user_role]));
CREATE TRIGGER set_social_posts_updated BEFORE UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_social_posts_scheduled ON public.social_posts(scheduled_at);
CREATE INDEX idx_social_posts_status ON public.social_posts(status);

CREATE TABLE public.social_post_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  hook_score NUMERIC(3,1) CHECK (hook_score BETWEEN 0 AND 10),
  retention_score NUMERIC(3,1) CHECK (retention_score BETWEEN 0 AND 10),
  cta_score NUMERIC(3,1) CHECK (cta_score BETWEEN 0 AND 10),
  production_score NUMERIC(3,1) CHECK (production_score BETWEEN 0 AND 10),
  overall_score NUMERIC(4,2) GENERATED ALWAYS AS (
    (COALESCE(hook_score,0) + COALESCE(retention_score,0) + COALESCE(cta_score,0) + COALESCE(production_score,0)) / 4
  ) STORED,
  notes TEXT,
  scored_by UUID,
  scored_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_post_scores TO authenticated;
GRANT ALL ON public.social_post_scores TO service_role;
ALTER TABLE public.social_post_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scores_read" ON public.social_post_scores FOR SELECT TO authenticated USING (true);
CREATE POLICY "scores_insert" ON public.social_post_scores FOR INSERT TO authenticated WITH CHECK (auth.uid() = scored_by);
CREATE POLICY "scores_update" ON public.social_post_scores FOR UPDATE TO authenticated
  USING (auth.uid() = scored_by OR has_any_role(ARRAY['admin'::user_role, 'social_manager'::user_role]));
CREATE POLICY "scores_delete" ON public.social_post_scores FOR DELETE TO authenticated
  USING (auth.uid() = scored_by OR has_any_role(ARRAY['admin'::user_role, 'social_manager'::user_role]));

CREATE TABLE public.social_post_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  saves INTEGER NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by UUID
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_post_metrics TO authenticated;
GRANT ALL ON public.social_post_metrics TO service_role;
ALTER TABLE public.social_post_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "metrics_read" ON public.social_post_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "metrics_insert" ON public.social_post_metrics FOR INSERT TO authenticated WITH CHECK (auth.uid() = recorded_by);
CREATE POLICY "metrics_update" ON public.social_post_metrics FOR UPDATE TO authenticated
  USING (auth.uid() = recorded_by OR has_any_role(ARRAY['admin'::user_role, 'social_manager'::user_role]));
CREATE POLICY "metrics_delete" ON public.social_post_metrics FOR DELETE TO authenticated
  USING (auth.uid() = recorded_by OR has_any_role(ARRAY['admin'::user_role, 'social_manager'::user_role]));

CREATE TABLE public.social_post_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  item TEXT NOT NULL CHECK (item IN ('filmed','edited','caption_written','approved','posted')),
  done BOOLEAN NOT NULL DEFAULT false,
  done_by UUID,
  done_at TIMESTAMPTZ,
  UNIQUE(post_id, item)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_post_checklist TO authenticated;
GRANT ALL ON public.social_post_checklist TO service_role;
ALTER TABLE public.social_post_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checklist_read" ON public.social_post_checklist FOR SELECT TO authenticated USING (true);
CREATE POLICY "checklist_insert" ON public.social_post_checklist FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.social_posts p WHERE p.id = post_id));
CREATE POLICY "checklist_update" ON public.social_post_checklist FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.social_posts p WHERE p.id = post_id
    AND (p.created_by = auth.uid() OR p.assigned_to = auth.uid() OR has_any_role(ARRAY['admin'::user_role, 'social_manager'::user_role]))));
CREATE POLICY "checklist_delete" ON public.social_post_checklist FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.social_posts p WHERE p.id = post_id
    AND (p.created_by = auth.uid() OR has_any_role(ARRAY['admin'::user_role, 'social_manager'::user_role]))));
