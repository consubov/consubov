import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PremiacaoSemestral from "@/components/ranking/PremiacaoSemestral";
import { useAdminPremiacaoFazendas } from "@/features/admin-premiacao/hooks/useAdminPremiacaoFazendas";

export default function AdminPremiacaoPage() {
  const fazendas = useAdminPremiacaoFazendas();
  const [fazendaId, setFazendaId] = useState("todas");

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
