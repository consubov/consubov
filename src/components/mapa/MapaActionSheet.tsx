import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft, Scissors, Scale, Info, Plus, ClipboardList } from "lucide-react";
import CarenciaBadge from "@/components/eventos/CarenciaBadge";
import type { PastoMapaData } from "@/hooks/useMapaData";

interface Props {
  open: boolean;
  onClose: () => void;
  pasto: (PastoMapaData & { data_fim_carencia?: string | null }) | null;
  onTransferir: () => void;
  onAbater: () => void;
  onEditarPeso: () => void;
  onVerDetalhes: () => void;
  onEntrada: () => void;
  onRegistrarEvento?: () => void;
}

export default function MapaActionSheet({ open, onClose, pasto, onTransferir, onAbater, onEditarPeso, onVerDetalhes, onEntrada, onRegistrarEvento }: Props) {
  if (!pasto) return null;

  const fmtPeso = pasto.peso_medio_kg != null ? `${pasto.peso_medio_kg.toFixed(1).replace(".", ",")} kg` : "—";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>{pasto.pasto_nome}</DialogTitle>
          <DialogDescription>
            {pasto.num_animais} animais · Peso médio: {fmtPeso}
          </DialogDescription>
        </DialogHeader>

        <CarenciaBadge dataFimCarencia={(pasto as any).data_fim_carencia} className="mb-1" />

        <div className="space-y-2 py-2">
          <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={onVerDetalhes}>
            <Info className="w-5 h-5 text-primary" />
            Ver detalhes
          </Button>

          {onRegistrarEvento && (
            <Button variant="outline" className="w-full justify-start gap-3 h-12 border-primary/50 text-primary hover:bg-primary/10" onClick={onRegistrarEvento}>
              <ClipboardList className="w-5 h-5" />
              Registrar evento
            </Button>
          )}

          {pasto.num_animais > 0 && (
            <>
              <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={onTransferir}>
                <ArrowRightLeft className="w-5 h-5 text-primary" />
                Transferir animais
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3 h-12 border-destructive/50 text-destructive hover:bg-destructive/10" onClick={onAbater}>
                <Scissors className="w-5 h-5" />
                Registrar abate
              </Button>
            </>
          )}

          <Button variant="outline" className="w-full justify-start gap-3 h-12 border-primary/50 text-primary hover:bg-primary/10" onClick={onEntrada}>
            <Plus className="w-5 h-5" />
            Adicionar animais
          </Button>

          <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={onEditarPeso}>
            <Scale className="w-5 h-5 text-primary" />
            Editar peso médio
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
