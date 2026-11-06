import { LocalizedText, useStaticUiText } from "@/components/i18n/LocalizedText";
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
  const uiText = useStaticUiText();
  const [refreshing, setRefreshing] = useState(false);
  const [aviso, setAviso] = useState(false);

  function recarregar() {
    setRefreshing(true);
    window.location.reload();
  }

  return (
    <>
      <Button
        aria-label={uiText("Atualizar aplicativo")}
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
            <AlertDialogTitle><LocalizedText source={"Pesagem em andamento"} /></AlertDialogTitle>
            <AlertDialogDescription>
              <LocalizedText source={"Você tem uma pesagem em andamento. Finalizar antes de atualizar?"} /></AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel><LocalizedText source={"Continuar pesagem"} /></AlertDialogCancel>
            <AlertDialogAction onClick={recarregar}><LocalizedText source={"Atualizar mesmo assim"} /></AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
