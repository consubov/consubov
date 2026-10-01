import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { GerenteFazendaSelect, useGerenteFazendaAtiva } from "@/components/gerente/GerenteFazendaSelect";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import ProdutosPage from "@/pages/ProdutosPage";
import OndeUsarGerente from "@/components/produtos/OndeUsarGerente";

export default function GerenteProdutosPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const aba = params.get("aba") === "onde-usar" ? "onde-usar" : "produtos";
  const retiro = params.get("retiro");
  const { fazendas, fazendaId, setFazendaId, carregado } = useGerenteFazendaAtiva();
  const [ondeUsarDirty, setOndeUsarDirty] = useState(false);
  // Atalho do painel com retiro: abre na fazenda desse retiro (se for do gerente).
  const retiroAplicado = useRef(false);
  useEffect(() => {
    if (!carregado || !retiro || retiroAplicado.current) return;
    retiroAplicado.current = true;
    (async () => {
      const { data } = await supabase.from("retiros").select("fazenda_id").eq("id", retiro).maybeSingle();
      const fid = (data as any)?.fazenda_id;
      if (fid) setFazendaId(fid);
    })();
  }, [carregado, retiro, setFazendaId]);
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground p-4 flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/gerente")}
          className="text-primary-foreground hover:bg-primary-foreground/10"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-base font-bold">Produtos</h1>
      </header>
      <main className="p-4 max-w-4xl mx-auto">
        {fazendas.length > 1 && (
          <div className="mb-3">
            <GerenteFazendaSelect fazendas={fazendas} value={fazendaId} onChange={setFazendaId} dirty={ondeUsarDirty} />
          </div>
        )}
        <Tabs value={aba} onValueChange={(v) => setParams(v === "onde-usar" ? { aba: v } : {}, { replace: true })}>
          <TabsList className="grid grid-cols-2 w-full mb-4">
            <TabsTrigger value="produtos">Produtos</TabsTrigger>
            <TabsTrigger value="onde-usar">Onde usar</TabsTrigger>
          </TabsList>
          <TabsContent value="produtos">{carregado && fazendaId ? <ProdutosPage modo="gerente" fazendaAtivaId={fazendaId} /> : carregado ? <p className="text-sm text-muted-foreground">Nenhuma fazenda vinculada.</p> : null}</TabsContent>
          <TabsContent value="onde-usar">{fazendaId && <OndeUsarGerente key={fazendaId} fazendaId={fazendaId} retiroInicial={retiro} onDirtyChange={setOndeUsarDirty} />}</TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
