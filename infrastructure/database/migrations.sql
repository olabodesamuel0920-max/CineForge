-- CineForge Database Migrations: Phase G3.3 — Version History & Brand Presets

-- ==========================================
-- 1. Project Render Version History
-- ==========================================

CREATE TABLE IF NOT EXISTS public.project_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  blueprint JSONB NOT NULL,
  output_path TEXT NOT NULL, -- Stable GCS path/key without expiration tokens, e.g. 'rendered/output-proj-uuid.mp4'
  diagnostics JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(project_id, version_number)
);

-- Index for lookup optimization
CREATE INDEX IF NOT EXISTS idx_project_versions_project_id ON public.project_versions(project_id);

-- Enable Row Level Security
ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;

-- Explicit RLS Policies for project_versions
CREATE POLICY "Users can select versions belonging to their own projects" 
ON public.project_versions FOR SELECT TO authenticated 
USING (EXISTS (
  SELECT 1 FROM public.projects 
  WHERE projects.id = project_versions.project_id 
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can insert versions belonging to their own projects" 
ON public.project_versions FOR INSERT TO authenticated 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.projects 
  WHERE projects.id = project_versions.project_id 
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can update versions belonging to their own projects" 
ON public.project_versions FOR UPDATE TO authenticated 
USING (EXISTS (
  SELECT 1 FROM public.projects 
  WHERE projects.id = project_versions.project_id 
  AND projects.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.projects 
  WHERE projects.id = project_versions.project_id 
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Users can delete versions belonging to their own projects" 
ON public.project_versions FOR DELETE TO authenticated 
USING (EXISTS (
  SELECT 1 FROM public.projects 
  WHERE projects.id = project_versions.project_id 
  AND projects.user_id = auth.uid()
));


-- ==========================================
-- 2. Brand Style Memory Presets
-- ==========================================

CREATE TABLE IF NOT EXISTS public.brand_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tone TEXT DEFAULT 'Neutral',
  color_mood TEXT DEFAULT 'Teal & Orange',
  caption_style TEXT DEFAULT 'Bold Monospace Outlined',
  cta_style TEXT DEFAULT 'Centered Loop Logo',
  platform_preference TEXT DEFAULT 'Reels',
  motion_style TEXT,
  sound_design_style TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for lookup optimization
CREATE INDEX IF NOT EXISTS idx_brand_presets_user_id ON public.brand_presets(user_id);

-- Enable Row Level Security
ALTER TABLE public.brand_presets ENABLE ROW LEVEL SECURITY;

-- Explicit RLS Policies for brand_presets
CREATE POLICY "Users can manage their own brand presets" 
ON public.brand_presets FOR ALL TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);


-- ==========================================
-- 3. ReferenceDNA Library
-- ==========================================

CREATE TABLE IF NOT EXISTS public.reference_dnas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_filename TEXT NOT NULL,
  pacing_rhythm TEXT[] NOT NULL, -- Array of shot duration strings, e.g. {'1.5s', '0.8s'}
  average_shot_duration REAL NOT NULL,
  dominant_color_grade TEXT,
  caption_placement TEXT NOT NULL DEFAULT 'center_pulsing',
  soundtrack_beat_intervals REAL[],
  transition_styles TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for user lookup optimization
CREATE INDEX IF NOT EXISTS idx_reference_dnas_user_id ON public.reference_dnas(user_id);

-- Enable Row Level Security
ALTER TABLE public.reference_dnas ENABLE ROW LEVEL SECURITY;

-- Explicit RLS Policies for reference_dnas
CREATE POLICY "Users can manage their own ReferenceDNAs" 
ON public.reference_dnas FOR ALL TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

