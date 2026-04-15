import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Scale, Syringe, FileText, Layers } from "lucide-react";

export type TipoEvento = "pesagem" | "sanitario" | "pesagem_sanitario" | "observacao";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (tipo: TipoEvento) => void;
  pastoNome: string;
}

const opcoes: { tipo: TipoEvento; label: string; icon: any; desc: string }[] = [
  { tipo: "pesagem", label: "Pesagem", icon: Scale, desc: "Registrar pesos individuais" },
  { tipo: "sanitario", label: "Controle Sanitário", icon: Syringe, desc: "Vermífugo, vacina, vitamina..." },
  { tipo: "pesagem_sanitario", label: "Pesagem + Sanitário", icon: Layers, desc: "Ambos em sequência" },
  { tipo: "observacao", label: "Observação do Lote", icon: FileText, desc: "Anotação livre sobre o lote" },
];

export default function SelecionarEventoModal({ open, onClose, onSelect, pastoNome }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Registrar Evento</DialogTitle>
          <DialogDescription>{pastoNome} — Selecione o tipo</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {opcoes.map((o) => (
            <Button
              key={o.tipo}
              variant="outline"
              className="w-full justify-start gap-3 h-14 flex-col items-start px-4"
              onClick={() => { onClose(); onSelect(o.tipo); }}
            >
              <div className="flex items-center gap-3">
                <o.icon className="w-5 h-5 text-primary shrink-0" />
                <div className="text-left">
                  <div className="font-semibold text-sm">{o.label}</div>
                  <div className="text-xs text-muted-foreground">{o.desc}</div>
                </div>
              </div>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
