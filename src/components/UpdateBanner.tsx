import { useEffect, useRef } from "react";
import { useSWUpdate } from "@/lib/swRegistration";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

/**
 * Renders nothing — just listens for SW updates and shows a discreet sonner
 * toast when a new version is ready. The user clicks "Atualizar" to reload.
 */
export function UpdateBanner() {
  const { updateAvailable, applyUpdate } = useSWUpdate();
  const shownRef = useRef(false);

  useEffect(() => {
    if (!updateAvailable || shownRef.current) return;
    shownRef.current = true;

    toast("Nova versão disponível", {
      description: "Toque em Atualizar para carregar a versão mais recente.",
      duration: Infinity,
      action: {
        label: "Atualizar",
        onClick: () => applyUpdate(),
      },
    });
  }, [updateAvailable, applyUpdate]);

  return null;
}

export function RefreshButton({ className = "" }: { className?: string }) {
  const { forceRefresh } = useSWUpdate();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={forceRefresh}
      className={`text-primary-foreground hover:bg-primary/80 ${className}`}
      title="Atualizar app"
    >
      <RefreshCw className="w-4 h-4" />
    </Button>
  );
}
