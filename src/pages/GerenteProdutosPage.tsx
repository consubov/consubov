import { useNavigate, useSearchParams } from "react-router-dom";
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
        <Tabs value={aba} onValueChange={(v) => setParams(v === "onde-usar" ? { aba: v } : {}, { replace: true })}>
          <TabsList className="grid grid-cols-2 w-full mb-4">
            <TabsTrigger value="produtos">Produtos</TabsTrigger>
            <TabsTrigger value="onde-usar">Onde usar</TabsTrigger>
          </TabsList>
          <TabsContent value="produtos"><ProdutosPage modo="gerente" /></TabsContent>
          <TabsContent value="onde-usar"><OndeUsarGerente retiroInicial={retiro} /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
