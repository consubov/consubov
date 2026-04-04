import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft, Scissors, Plus, AlertTriangle } from "lucide-react";

interface PastoActionSheetProps {
  open: boolean;
  onClose: () => void;
  pastoNome: string;
  numAnimais: number;
  onTransferir: () => void;
  onAbater: () => void;
  onMortalidade: () => void;
  onEntrada: () => void;
}

export default function PastoActionSheet({ open, onClose, pastoNome, numAnimais, onTransferir, onAbater, onMortalidade, onEntrada }: PastoActionSheetProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>{pastoNome}</DialogTitle>
          <DialogDescription>Selecione uma ação</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {numAnimais === 0 && (
            <Button variant="outline" className="w-full justify-start gap-3 h-12 border-primary/50 text-primary hover:bg-primary/10" onClick={() => { onClose(); onEntrada(); }}>
              <Plus className="w-5 h-5" />
              Adicionar animais
            </Button>
          )}
          {numAnimais > 0 && (
            <>
              <Button variant="outline" className="w-full justify-start gap-3 h-12" onClick={() => { onClose(); onTransferir(); }}>
                <ArrowRightLeft className="w-5 h-5 text-primary" />
                Transferir animais
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3 h-12 border-destructive/50 text-destructive hover:bg-destructive/10" onClick={() => { onClose(); onAbater(); }}>
                <Scissors className="w-5 h-5" />
                Abater animais
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3 h-12 border-destructive/50 text-destructive hover:bg-destructive/10" onClick={() => { onClose(); onMortalidade(); }}>
                <AlertTriangle className="w-5 h-5" />
                🐄 Mortalidade
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
