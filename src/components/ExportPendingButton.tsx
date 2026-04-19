import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { downloadPendingBackup, type PendingBackup } from "@/lib/backupMirror";

interface Props {
  userInfo?: PendingBackup["userInfo"];
  /** "default" | "outline" | etc. */
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
}

/**
 * Emergency JSON export button — capataz can send this to the manager via
 * WhatsApp if all other sync paths fail.
 */
export function ExportPendingButton({ userInfo, variant = "outline", size = "sm", className }: Props) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      const { count } = await downloadPendingBackup(userInfo);
      if (count === 0) {
        toast.info("Nenhum registro pendente para exportar");
      } else {
        toast.success(`Backup gerado com ${count} registro${count === 1 ? "" : "s"}`);
      }
    } catch (err: any) {
      toast.error("Falha ao gerar backup: " + (err?.message ?? "erro desconhecido"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button onClick={handleClick} disabled={busy} variant={variant} size={size} className={className}>
      {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
      Exportar dados pendentes
    </Button>
  );
}

export default ExportPendingButton;
