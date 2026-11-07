import { LocalizedText, useStaticUiText } from "@/components/i18n/LocalizedText";
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
  const uiText = useStaticUiText();
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      const { count } = await downloadPendingBackup(userInfo);
      if (count === 0) {
        toast.info(uiText("Nenhum registro pendente para exportar"));
      } else {
        toast.success(`${uiText("Backup gerado com ")}${count} ${uiText(count === 1 ? "registro exportado" : "registros exportados")}`);
      }
    } catch (err: any) {
      toast.error(uiText("Falha ao gerar backup: ") + (err?.message ?? uiText("erro desconhecido")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button onClick={handleClick} disabled={busy} variant={variant} size={size} className={className}>
      {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
      <LocalizedText source={"Exportar dados pendentes"} /></Button>
  );
}

export default ExportPendingButton;
