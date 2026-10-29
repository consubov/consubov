import { withReportExportDeadline, downloadGeneratedPdf } from "@/lib/reportPdfExport";
import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink, Loader2, Camera, Share2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { gerarPdfPesagem, type AnimalPesagem, type PesagemPdfData } from "@/utils/gerarPdfPesagem";
import { useOnlineStatus } from "@/hooks/useOfflinePesagem";
import { saveSyncQueueItem } from "@/lib/offlineDb";
import { usePesagemResultado } from "@/hooks/usePesagemResultado";
import PhotoResultModal from "./PhotoResultModal";

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
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [sharingPdf, setSharingPdf] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const pdfBlobRef = useRef<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isOnline = useOnlineStatus();

  const resultado = usePesagemResultado(open ? pesagemId : null);

  const totalAnimais = resultado.qtdAnimais || animais.length;
  const pesoMedioKg = resultado.pesoAtual ||
    (animais.length > 0 ? animais.reduce((s, a) => s + a.pesoKg, 0) / animais.length : 0);
  const pesoTotalKg = pesoMedioKg * totalAnimais;

  async function ensurePdf(): Promise<Blob | null> {
    if (pdfBlobRef.current) return pdfBlobRef.current;
    setGeneratingPdf(true);
    try {
      const pdfData: PesagemPdfData = {
        pesagemId, fazendaNome, retiroNome, pastoNome,
        dataPesagem, horaFinalizacao, responsavelNome, animais,
      };
      const { blob, fileName } = gerarPdfPesagem(pdfData);
      pdfBlobRef.current = blob;

      if (!isOnline) {
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
      } else {
        const storagePath = `pesagens/${fazendaId}/${pesagemId}/${fileName}`;
        try {
          const { error } = await withReportExportDeadline(
            supabase.storage.from("relatorios").upload(storagePath, blob, { upsert: true, contentType: "application/pdf" }),
            "Backup da pesagem", Date.now() + 25_000,
          );
          if (error) throw error;
        } catch (uploadError) {
          console.warn("[PDF] Pesagem gerada, cópia remota pendente:", uploadError);
          toast.warning("PDF disponível no aparelho, mas não foi possível confirmar o backup.");
        }
      }

      const localUrl = URL.createObjectURL(blob);
      setPdfUrl(localUrl);
      return blob;
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      toast.error("Erro ao gerar PDF.");
      return null;
    } finally {
      setGeneratingPdf(false);
    }
  }

  async function handleAbrirPdf() {
    if (pdfUrl) {
      window.open(pdfUrl, "_blank");
      return;
    }
    const blob = await ensurePdf();
    if (blob) {
      const url = pdfUrl || URL.createObjectURL(blob);
      const tab = window.open(url, "_blank");
      if (!tab) downloadGeneratedPdf(blob, `pesagem-${pesagemId}.pdf`);
    }
  }

  async function handleCompartilharPdf() {
    setSharingPdf(true);
    try {
      const blob = await ensurePdf();
      if (!blob) return;
      const file = new File([blob], `pesagem-${pesagemId}.pdf`, { type: "application/pdf" });
      if ((navigator as any).share && (navigator as any).canShare?.({ files: [file] })) {
        try {
          await (navigator as any).share({ files: [file], title: "Pesagem Consubov" });
          return;
        } catch {
          // fallback
        }
      }
      downloadGeneratedPdf(blob, `pesagem-${pesagemId}.pdf`);
    } finally {
      setSharingPdf(false);
    }
  }

  function abrirCamera() {
    fileInputRef.current?.click();
  }

  function handleFotoCapturada(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
    setPhotoModalOpen(true);
    handleClose();

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function fecharFotoModal() {
    setPhotoModalOpen(false);
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
  }

  function handleClose() {
    setPdfUrl(null);
    pdfBlobRef.current = null;
    setGeneratingPdf(false);
    setSharingPdf(false);
    onClose();
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFotoCapturada}
      />

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
          <div className="flex gap-2 pt-2 items-stretch">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleAbrirPdf}
              disabled={generatingPdf}
            >
              {generatingPdf ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4 mr-2" />
              )}
              Abrir PDF
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={abrirCamera}
              title="Tirar foto"
            >
              <Camera className="w-4 h-4" />
            </Button>
            <Button
              className="flex-1 bg-green-900 hover:bg-green-900/90 text-white"
              onClick={handleCompartilharPdf}
              disabled={sharingPdf}
            >
              {sharingPdf ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Share2 className="w-4 h-4 mr-2" />
              )}
              Compartilhar
            </Button>
          </div>

          {/* Banner inferior - clicável */}
          <button
            type="button"
            onClick={abrirCamera}
            className="mt-3 rounded-xl bg-muted p-3 flex items-center gap-3 text-left hover:bg-muted/80 transition-colors w-full"
          >
            <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold leading-tight">
                Quer compartilhar com ainda mais impacto?
              </p>
              <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                Tire uma foto, adicione o filtro de desempenho automaticamente e compartilhe seu resultado!
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          </button>
        </DialogContent>
      </Dialog>

      <PhotoResultModal
        open={photoModalOpen}
        onClose={fecharFotoModal}
        photoUrl={photoUrl}
        pesagemId={photoModalOpen ? pesagemId : null}
      />
    </>
  );
}
