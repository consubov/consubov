ALTER TABLE public.landing_page_content
  ADD COLUMN IF NOT EXISTS landing_slug text NOT NULL DEFAULT 'consubov';

UPDATE public.landing_page_content SET landing_slug = 'consubov' WHERE landing_slug IS NULL;

ALTER TABLE public.landing_page_content
  DROP CONSTRAINT IF EXISTS landing_page_content_landing_slug_check;
ALTER TABLE public.landing_page_content
  ADD CONSTRAINT landing_page_content_landing_slug_check CHECK (landing_slug IN ('consubov','relatto'));

ALTER TABLE public.landing_page_content DROP CONSTRAINT IF EXISTS landing_page_content_chave_key;
DROP INDEX IF EXISTS public.landing_page_content_chave_key;
CREATE UNIQUE INDEX IF NOT EXISTS landing_page_content_slug_chave_key
  ON public.landing_page_content (landing_slug, chave);

CREATE TABLE IF NOT EXISTS public.landing_parceiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_slug text NOT NULL DEFAULT 'relatto' CHECK (landing_slug IN ('consubov','relatto')),
  nome text NOT NULL DEFAULT '',
  logo_url text,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.landing_parceiros TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.landing_parceiros TO authenticated;
GRANT ALL ON public.landing_parceiros TO service_role;

ALTER TABLE public.landing_parceiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parceiros ativos sao publicos"
  ON public.landing_parceiros FOR SELECT
  USING (true);

CREATE POLICY "Admins gerenciam parceiros"
  ON public.landing_parceiros FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER landing_parceiros_updated_at
  BEFORE UPDATE ON public.landing_parceiros
  FOR EACH ROW EXECUTE FUNCTION public.update_slm_updated_at();