import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TreePine } from "lucide-react";
import type { PastoRetiroItem } from "@/hooks/usePastosRetiro";

const fmtNum = (n: number, d = 0) => n.toFixed(d).replace(".", ",");

// Paleta unificada do Consumo Global (mesma do RelatorioPDF)
const STATUS_GLOBAL_CLASSES: Record<string, string> = {
  Baixo: "bg-[#E53935]/15 text-[#E53935] border border-[#E53935]/30",
  "Atenção": "bg-[#FBC02D]/20 text-[#A17E00] border border-[#FBC02D]/40",
  Ideal: "bg-[#43A047]/15 text-[#43A047] border border-[#43A047]/30",
  Alto: "bg-[#1E88E5]/15 text-[#1E88E5] border border-[#1E88E5]/30",
};

/**
 * Lista de Pastos — componente único usado pelos perfis admin e gerente.
 * Consumo e status vêm sempre de view_painel_mae_pasto_atual
 * (consumo_global_g_cab_dia / status_global), a mesma fonte do Mapa.
 */
export default function PastosListaRetiro({ pastos, loading = false }: { pastos: PastoRetiroItem[]; loading?: boolean }) {
  return (
    <>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        <TreePine className="w-4 h-4" /> Pastos ({pastos.length})
      </h2>
      {pastos.length === 0 && (
        <p className="text-sm text-muted-foreground py-2">
          {loading ? "Carregando pastos..." : "Nenhum pasto ativo neste retiro."}
        </p>
      )}
      <div className="space-y-2">
        {pastos.map((p) => {
          const consumo = p.consumo_global_g_cab_dia ?? 0;
          const status = p.status_global;
          return (
            <Card key={p.id}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-sm">{p.nome}</p>
                  <div className="flex items-center gap-1.5">
                    {status && (
                      <Badge className={`text-[10px] px-1.5 py-0 h-5 hover:bg-inherit ${
                        STATUS_GLOBAL_CLASSES[status] || "bg-muted text-muted-foreground"
                      }`}>
                        {status}
                        {p.indice_global != null ? ` (${p.indice_global.toFixed(2)})` : ""}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px]">{p.num_animais} cab</Badge>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div><p className="text-muted-foreground">Sacos</p><p className="font-bold">{p.num_sacos}</p></div>
                  <div><p className="text-muted-foreground">Consumo</p><p className="font-bold text-secondary">{consumo > 0 ? fmtNum(consumo, 1) : "—"}</p></div>
                  <div><p className="text-muted-foreground">Peso</p><p className="font-bold">{p.peso_medio_kg ? `${p.peso_medio_kg}kg` : "—"}</p></div>
                  <div><p className="text-muted-foreground">GMD</p><p className="font-bold text-primary">{p.gmd_kg_dia != null && p.gmd_kg_dia > 0 ? fmtNum(p.gmd_kg_dia, 3) : "—"}</p></div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
