import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft, Scissors, Plus, ClipboardList, Eye, Scale } from "lucide-react";
import CarenciaBadge from "@/components/eventos/CarenciaBadge";

interface PastoActionSheetProps {
  open: boolean;
  onClose: () => void;
  pastoNome: string;
  numAnimais: number;
  dataFimCarencia?: string | null;
  onVerDetalhes: () => void;
  onTransferir: () => void;
  onAbater: () => void;
  onEntrada: () => void;
  onEditarPeso: () => void;
  onRegistrarEvento?: () => void;
}

export default function PastoActionSheet({ open, onClose, pastoNome, numAnimais, dataFimCarencia, onVerDetalhes, onTransferir, onAbater, onEntrada, onEditarPeso, onRegistrarEvento }: PastoActionSheetProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>{pastoNome}</DialogTitle>
          <DialogDescription>Selecione uma ação</DialogDescription>
        </DialogHeader>

        <CarenciaBadge dataFimCarencia={dataFimCarencia} className="mb-1" />

        <div className="space-y-2 py-2">
          {/* 1. Ver detalhes */}
          <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={() => { onClose(); onVerDetalhes(); }}>
            <Eye className="w-5 h-5 text-primary" />
            Ver detalhes
          </Button>

          {/* 2. Registrar evento */}
          {onRegistrarEvento && (
            <Button variant="outline" className="w-full justify-start gap-3 h-12 border-primary/50 text-primary hover:bg-primary/10" onClick={() => { onClose(); onRegistrarEvento(); }}>
              <ClipboardList className="w-5 h-5" />
              Registrar evento
            </Button>
          )}

          {/* 3. Transferir animais */}
          {numAnimais > 0 && (
            <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={() => { onClose(); onTransferir(); }}>
              <ArrowRightLeft className="w-5 h-5 text-primary" />
              Transferir animais
            </Button>
          )}

          {/* 4. Abater animais */}
          {numAnimais > 0 && (
            <Button variant="outline" className="w-full justify-start gap-3 h-12 border-destructive/50 text-destructive hover:bg-destructive/10" onClick={() => { onClose(); onAbater(); }}>
              <Scissors className="w-5 h-5" />
              Abater animais
            </Button>
          )}

          {/* 5. Adicionar animais */}
          <Button variant="outline" className="w-full justify-start gap-3 h-12 border-primary/50 text-primary hover:bg-primary/10" onClick={() => { onClose(); onEntrada(); }}>
            <Plus className="w-5 h-5" />
            Adicionar animais
          </Button>

          {/* 6. Editar peso médio */}
          <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={() => { onClose(); onEditarPeso(); }}>
            <Scale className="w-5 h-5 text-primary" />
            Editar peso médio
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
