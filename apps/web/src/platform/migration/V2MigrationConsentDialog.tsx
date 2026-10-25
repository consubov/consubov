import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  OneTouchMigrationFlow,
  type MigrationPhase,
} from "./oneTouchMigrationFlow";

const progressMessage: Record<MigrationPhase, string> = {
  checking: "Verificando os dados deste aparelho...",
  backup: "Fazendo backup dos seus lançamentos e fotos...",
  syncing: "Enviando seus dados ao servidor...",
  verifying: "Conferindo o recebimento dos dados...",
  opening: "Abrindo CONSUBOV 2.0...",
};

interface V2MigrationConsentDialogProps {
  /** Feature-gated by the LEGACY app. Do not show before rollout approval. */
  open: boolean;
  migration: OneTouchMigrationFlow;
  onDismiss: () => void;
  onOpenNewApp: (url: string) => void;
}

/**
 * Single invitation, single explicit authorization.
 * The button itself is consent; no second checkbox or technical questions.
 * Never opens the new origin without a durable, verified server receipt.
 */
export function V2MigrationConsentDialog({
  open,
  migration,
  onDismiss,
  onOpenNewApp,
}: V2MigrationConsentDialogProps) {
  const [working, setWorking] = useState(false);
  const [phase, setPhase] = useState<MigrationPhase | null>(null);
  const [error, setError] = useState("");

  const authorizeAndUpdate = async () => {
    if (working) return;
    setWorking(true);
    setError("");
    setPhase("checking");
    try {
      const outcome = await migration.run(true, setPhase);
      if (outcome.ok) {
        // This is the only navigation path; origin and fragment are validated
        // by the coordinator, never read from an untrusted push payload.
        onOpenNewApp(outcome.url);
      } else {
        setError("message" in outcome ? outcome.message : "Seus dados continuam na versão atual.");
      }
    } catch {
      setError("Seus dados continuam na versão atual. Tente novamente.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent
        onEscapeKeyDown={(event) => { if (working) event.preventDefault(); }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Atualização CONSUBOV 2.0</AlertDialogTitle>
          <AlertDialogDescription>
            Você pode atualizar o aplicativo com segurança. Ao autorizar,
            o CONSUBOV irá proteger, transferir e conferir seus lançamentos,
            fotos e dados pendentes antes de abrir a nova versão. Caso algo
            falhe, seus dados permanecerão no aplicativo atual.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <p className="text-sm" role="status" aria-live="polite">
          {error || (phase ? progressMessage[phase] : "Nenhuma ação técnica é necessária.")}
        </p>
        <AlertDialogFooter>
          <Button type="button" variant="outline" onClick={onDismiss} disabled={working}>
            Agora não
          </Button>
          <Button type="button" className="h-auto min-h-11 w-full whitespace-normal px-4 py-3 text-center" onClick={() => { void authorizeAndUpdate(); }} disabled={working}>
            {working ? "Preparando atualização..." : "Autorizar e atualizar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
