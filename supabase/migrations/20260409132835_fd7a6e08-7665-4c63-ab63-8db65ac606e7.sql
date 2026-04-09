
-- Enable RLS on all tables that currently have it disabled
ALTER TABLE public.administradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capatazes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ciclos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fazendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gerentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teste ENABLE ROW LEVEL SECURITY;

-- teste has no policies, add permissive access so it keeps working
CREATE POLICY "full_access_teste" ON public.teste FOR ALL USING (true) WITH CHECK (true);
