import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { hasCriticalOperations } from "@/lib/criticalOperations";
import { cn } from "@/lib/utils";

/** Botão "Atualizar" do topo do Mais Arrobas — avisa se há pesagem em andamento. */
export function AtualizarAppButton({ className }: { className?: string }) {
  const [refreshing, setRefreshing] = useState(false);
  const [aviso, setAviso] = useState(false);

  function recarregar() {
    setRefreshing(true);
    window.location.reload();
  }

  return (
    <>
      <Button
        aria-label="Atualizar aplicativo"
        variant="ghost"
        size="icon"
        onClick={() => (hasCriticalOperations() ? setAviso(true) : recarregar())}
        className={className}
      >
        <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
      </Button>
      <AlertDialog open={aviso} onOpenChange={setAviso}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pesagem em andamento</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem uma pesagem em andamento. Finalizar antes de atualizar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar pesagem</AlertDialogCancel>
            <AlertDialogAction onClick={recarregar}>Atualizar mesmo assim</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
