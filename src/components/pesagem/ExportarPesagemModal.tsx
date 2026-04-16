import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Download, Share2, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { gerarPdfPesagem, type AnimalPesagem, type PesagemPdfData } from "@/utils/gerarPdfPesagem";
import { useOnlineStatus } from "@/hooks/useOfflinePesagem";
import { saveSyncQueueItem } from "@/lib/offlineDb";

interface Props {
  open: boolean;
  onClose: () => void;
  pesagemId: string;
  fazendaId: string;
  fazendaNome: string;
  retiroNome: string;
  pastoNome: string;
  dataPesagem: string;
  horaFinalizacao: string;
  responsavelNome: string;
  animais: AnimalPesagem[];
}

export default function ExportarPesagemModal({
  open, onClose, pesagemId, fazendaId, fazendaNome, retiroNome, pastoNome,
  dataPesagem, horaFinalizacao, responsavelNome, animais,
}: Props) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const pdfBlobRef = useRef<Blob | null>(null);
  const isOnline = useOnlineStatus();

  const totalAnimais = animais.length;
  const pesoTotalKg = animais.reduce((s, a) => s + a.pesoKg, 0);
  const pesoMedioKg = totalAnimais > 0 ? pesoTotalKg / totalAnimais : 0;

  const shareFileName = `Relatório de Pesagem - ${fazendaNome}.pdf`;

  async function handleGerarPdf() {
    setGenerating(true);
    toast.info("Gerando PDF…");

    try {
      const pdfData: PesagemPdfData = {
        pesagemId, fazendaNome, retiroNome, pastoNome,
        dataPesagem, horaFinalizacao, responsavelNome, animais,
      };
      const { blob, fileName } = gerarPdfPesagem(pdfData);
      pdfBlobRef.current = blob;

      if (!isOnline) {
        // Offline: local blob URL + queue upload
        const localUrl = URL.createObjectURL(blob);
        setPdfUrl(localUrl);

        // Convert blob to base64 for IndexedDB
        const reader = new FileReader();
        reader.onloadend = async () => {
          const blobBase64 = (reader.result as string).split(",")[1];
          await saveSyncQueueItem({
            id: crypto.randomUUID(),
            type: "upload_pdf_pesagem",
            payload: { pesagemId, fazendaId, fileName, blobBase64 },
            createdAt: new Date().toISOString(),
          });
        };
        reader.readAsDataURL(blob);

        toast.success("PDF gerado localmente. Será enviado ao servidor quando a conexão for restaurada.");
        setGenerating(false);
        return;
      }

      // Online: upload to Supabase Storage
      const storagePath = `pesagens/${fazendaId}/${pesagemId}/${fileName}`;
      const { error: uploadErr } = await supabase.storage
        .from("relatorios")
        .upload(storagePath, blob, { upsert: true, contentType: "application/pdf" });

      if (uploadErr) throw uploadErr;

      const localUrl = URL.createObjectURL(blob);
      setPdfUrl(localUrl);
      toast.success("PDF gerado com sucesso!");
    } catch (err: any) {
      console.error("Erro ao gerar PDF:", err);
      toast.error("Erro ao gerar PDF. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleShare() {
    const blob = pdfBlobRef.current;
    if (!blob) return;

    const file = new File([blob], shareFileName, { type: "application/pdf" });

    // Try sharing the file directly
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `Relatório de Pesagem - ${fazendaNome}`,
        });
        return;
      } catch {
        // User cancelled or error — fall through to download
      }
    }

    // Fallback: download the file directly
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = shareFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("PDF baixado!");
  }

  function handleClose() {
    setPdfUrl(null);
    pdfBlobRef.current = null;
    setGenerating(false);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Exportar Pesagem
          </DialogTitle>
          <DialogDescription>
            Gere o relatório em PDF da pesagem realizada.
          </DialogDescription>
        </DialogHeader>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 text-center py-2">
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-lg font-bold text-primary">{totalAnimais}</p>
            <p className="text-xs text-muted-foreground">animais</p>
          </div>
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-lg font-bold text-primary">{pesoMedioKg.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">kg médio</p>
          </div>
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-lg font-bold text-primary">{pesoTotalKg.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">kg total</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {!pdfUrl ? (
            <>
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                Fechar
              </Button>
              <Button
                className="flex-1 bg-[#1B4332] hover:bg-[#1B4332]/90 text-white"
                onClick={handleGerarPdf}
                disabled={generating}
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Gerar PDF
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => window.open(pdfUrl, "_blank")}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Abrir PDF
              </Button>
              <Button
                className="flex-1 bg-[#1B4332] hover:bg-[#1B4332]/90 text-white"
                onClick={handleShare}
              >
                <Share2 className="w-4 h-4 mr-2" />
                Compartilhar
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
