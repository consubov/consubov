import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft, Scissors, Scale, Info, Plus } from "lucide-react";
import type { PastoMapaData } from "@/hooks/useMapaData";

interface Props {
  open: boolean;
  onClose: () => void;
  pasto: PastoMapaData | null;
  onTransferir: () => void;
  onAbater: () => void;
  onEditarPeso: () => void;
  onVerDetalhes: () => void;
  onEntrada: () => void;
}

export default function MapaActionSheet({ open, onClose, pasto, onTransferir, onAbater, onEditarPeso, onVerDetalhes, onEntrada }: Props) {
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
        <div className="space-y-2 py-2">
          <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={onVerDetalhes}>
            <Info className="w-5 h-5 text-primary" />
            Ver detalhes
          </Button>

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
