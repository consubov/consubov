import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PremiacaoSemestral from "@/components/ranking/PremiacaoSemestral";

export default function AdminPremiacaoPage() {
  const [fazendas, setFazendas] = useState<{ id: string; nome: string }[]>([]);
  const [fazendaId, setFazendaId] = useState("todas");

  useEffect(() => {
    supabase.from("fazendas").select("id, nome").eq("ativo", true).order("nome")
      .then(({ data }) => setFazendas(data ?? []));
  }, []);

  const alvo = useMemo(
    () => (fazendaId === "todas" ? fazendas : fazendas.filter((f) => f.id === fazendaId)),
    [fazendaId, fazendas],
  );

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Premiação</h1>
      <PremiacaoSemestral
        fazendas={alvo}
        mostrarFazenda={fazendaId === "todas"}
        seletorExtra={
          <Select value={fazendaId} onValueChange={setFazendaId}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as fazendas</SelectItem>
              {fazendas.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />
    </div>
  );
}
