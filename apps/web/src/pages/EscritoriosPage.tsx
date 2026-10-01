import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Building2 } from "lucide-react";
import CriarEscritorioModal from "@/components/admin/CriarEscritorioModal";

interface Escritorio {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  fazenda_id: string;
  ativo: boolean;
  criado_em: string;
  fazenda_nome?: string;
}

export default function EscritoriosPage() {
  const [escritorios, setEscritorios] = useState<Escritorio[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchEscritorios = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("escritorios")
      .select("id, nome, email, telefone, fazenda_id, ativo, criado_em")
      .order("criado_em", { ascending: false });

    if (data) {
      // Fetch fazenda names
      const fazendaIds = [...new Set(data.map(e => e.fazenda_id))];
      const { data: fazendas } = await supabase
        .from("fazendas")
        .select("id, nome")
        .in("id", fazendaIds);

      const fazendaMap = new Map((fazendas ?? []).map(f => [f.id, f.nome]));

      setEscritorios(data.map(e => ({
        ...e,
        fazenda_nome: fazendaMap.get(e.fazenda_id) ?? "—",
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchEscritorios(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          Escritórios
        </h1>
        <Button onClick={() => setModalOpen(true)} size="sm" className="gap-1">
          <Plus className="w-4 h-4" /> Criar Escritório
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm text-center py-8">Carregando...</p>
      ) : escritorios.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">Nenhum escritório cadastrado.</p>
      ) : (
        <div className="space-y-3">
          {escritorios.map(e => (
            <Card key={e.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{e.nome}</p>
                    <p className="text-xs text-muted-foreground">{e.email}</p>
                    {e.telefone && <p className="text-xs text-muted-foreground">{e.telefone}</p>}
                  </div>
                  <Badge variant={e.ativo ? "default" : "secondary"}>
                    {e.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Fazenda: <strong>{e.fazenda_nome}</strong>
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CriarEscritorioModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); fetchEscritorios(); }}
      />
    </div>
  );
}
