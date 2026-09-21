import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import ProdutosPage from "@/pages/ProdutosPage";

export default function GerenteProdutosPage() {
  const navigate = useNavigate();
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
      <main className="p-4">
        <ProdutosPage modo="gerente" />
      </main>
    </div>
  );
}
