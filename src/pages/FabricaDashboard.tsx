import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Factory, LogOut, Loader2 } from "lucide-react";

interface Fabrica {
  id: string;
  codigo: string | null;
  nome: string;
  descricao: string | null;
}

export default function FabricaDashboard() {
  const { roleData, signOut } = useAuth();
  const [fabrica, setFabrica] = useState<Fabrica | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roleData?.fabricaId) { setLoading(false); return; }
    supabase.from("fabricas").select("id, codigo, nome, descricao").eq("id", roleData.fabricaId).maybeSingle()
      .then(({ data }) => { setFabrica(data as Fabrica | null); setLoading(false); });
  }, [roleData?.fabricaId]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Factory className="w-6 h-6 text-primary" />
            <h1 className="text-lg font-bold text-foreground">Fábrica</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={() => signOut()}>
            <LogOut className="w-4 h-4 mr-2" /> Sair
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : !fabrica ? (
          <Card><CardContent className="p-6 text-center text-muted-foreground">Sem fábrica vinculada. Contate o administrador.</CardContent></Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Factory className="w-5 h-5 text-primary" /> {fabrica.nome}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">Código: <span className="font-mono">{fabrica.codigo || "—"}</span></p>
              {fabrica.descricao && <p className="text-sm">{fabrica.descricao}</p>}
              <p className="text-xs text-muted-foreground pt-4">Funcionalidades completas em breve.</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
