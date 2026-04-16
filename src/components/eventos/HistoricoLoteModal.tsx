import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Scale, Syringe, FileText, ArrowRightLeft, Scissors } from "lucide-react";
import { useEventosLote } from "@/hooks/useEventosLote";

interface Props {
  open: boolean;
  onClose: () => void;
  pastoId: string | undefined;
  pastoNome: string;
}

const tipoConfig: Record<string, { icon: any; label: string; color: string }> = {
  pesagem: { icon: Scale, label: "Pesagem", color: "text-blue-500" },
  sanitario: { icon: Syringe, label: "Sanitário", color: "text-green-500" },
  pesagem_sanitario: { icon: Scale, label: "Pesagem + Sanitário", color: "text-purple-500" },
  observacao: { icon: FileText, label: "Observação", color: "text-yellow-500" },
  transferencia: { icon: ArrowRightLeft, label: "Transferência", color: "text-orange-500" },
  abate: { icon: Scissors, label: "Abate", color: "text-red-500" },
};

function formatEventoResumo(ev: any): string {
  const d = ev.dados || {};
  switch (ev.tipo) {
    case "pesagem":
      return `${d.total_pesado || 0} animais, média ${d.media || "—"} kg`;
    case "sanitario": {
      const cat = d.categoria || "";
      const med = d.medicamento || "";
      const car = d.tem_carencia ? `, carência ${d.dias_carencia} dias` : "";
      return `${cat}: ${med} ${d.dose || ""}${car}`;
    }
    case "pesagem_sanitario": {
      const san = d.sanitario || {};
      return `${d.total_pesado || 0} animais, ${san.categoria || ""}: ${san.medicamento || ""}`;
    }
    case "observacao":
      return d.texto || "Observação";
    default:
      return JSON.stringify(d).slice(0, 80);
  }
}

export default function HistoricoLoteModal({ open, onClose, pastoId, pastoNome }: Props) {
  // Use a refreshKey that increments every time the modal opens to force re-fetch
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    if (open) setRefreshKey((k) => k + 1);
  }, [open]);

  const { eventos, loading } = useEventosLote(open ? pastoId : undefined, refreshKey);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico do Lote</DialogTitle>
          <DialogDescription>{pastoNome}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : eventos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum evento registrado</p>
        ) : (
          <div className="space-y-2 py-2">
            {eventos.map((ev) => {
              const cfg = tipoConfig[ev.tipo] || tipoConfig.observacao;
              const Icon = cfg.icon;
              const dataStr = new Date(ev.data_evento).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
              const resumo = formatEventoResumo(ev);

              return (
                <div key={ev.id} className="flex items-start gap-3 text-sm border-b pb-2 last:border-0">
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{dataStr}</span>
                      <Badge variant="outline" className="text-[10px] px-1 py-0">{cfg.label}</Badge>
                    </div>
                    <p className="text-xs mt-0.5 truncate">{resumo}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
