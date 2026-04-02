
-- Table: leads (stores landing page form submissions)
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text NOT NULL,
  telefone text NOT NULL,
  whatsapp text NOT NULL,
  mensagem text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (public form)
CREATE POLICY "Anon pode inserir leads" ON public.leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Only admin can read
CREATE POLICY "Admin acessa leads" ON public.leads
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM administradores a WHERE a.user_id = auth.uid()));

-- Table: landing_page_content (editable content for landing page)
CREATE TABLE public.landing_page_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  valor text,
  atualizado_em timestamptz DEFAULT now()
);

ALTER TABLE public.landing_page_content ENABLE ROW LEVEL SECURITY;

-- Anyone can read (public landing page)
CREATE POLICY "Publico pode ler landing_page_content" ON public.landing_page_content
  FOR SELECT TO anon, authenticated
  USING (true);

-- Admin can manage
CREATE POLICY "Admin gerencia landing_page_content" ON public.landing_page_content
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM administradores a WHERE a.user_id = auth.uid()));

-- Table: notificacoes (admin notifications from leads)
CREATE TABLE public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL DEFAULT 'lead',
  titulo text NOT NULL,
  mensagem text,
  dados jsonb,
  lida boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin acessa notificacoes" ON public.notificacoes
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM administradores a WHERE a.user_id = auth.uid()));

-- Storage bucket for landing page images
INSERT INTO storage.buckets (id, name, public) VALUES ('landing', 'landing', true);

-- Allow anyone to read landing images
CREATE POLICY "Public read landing" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'landing');

-- Admin can upload/delete landing images
CREATE POLICY "Admin manage landing" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'landing' AND EXISTS (SELECT 1 FROM administradores a WHERE a.user_id = auth.uid()));
