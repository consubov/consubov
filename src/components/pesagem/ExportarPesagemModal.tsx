import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink, Loader2, Camera, Share2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { supabase } from "@/integrations/supabase/client";
import { gerarPdfPesagem, type AnimalPesagem, type PesagemPdfData } from "@/utils/gerarPdfPesagem";
import { useOnlineStatus } from "@/hooks/useOfflinePesagem";
import { saveSyncQueueItem } from "@/lib/offlineDb";
import ConsubovResultCard from "./ConsubovResultCard";
import { usePesagemResultado } from "@/hooks/usePesagemResultado";

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
  const [sharing, setSharing] = useState(false);
  const pdfBlobRef = useRef<Blob | null>(null);
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
        await supabase.storage
          .from("relatorios")
          .upload(storagePath, blob, { upsert: true, contentType: "application/pdf" });
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
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    }
  }

  function baixarImagem(dataUrl: string) {
    const link = document.createElement("a");
    link.download = "consubov-resultado.png";
    link.href = dataUrl;
    link.click();
  }

  async function exportarCartao() {
    const el = document.getElementById("consubov-result-card");
    if (!el) {
      toast.error("Cartão não encontrado.");
      return;
    }
    setSharing(true);
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        width: 390,
        height: 693,
      });
      const dataUrl = canvas.toDataURL("image/png");

      if (typeof navigator !== "undefined" && (navigator as any).share) {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], "consubov-resultado.png", { type: "image/png" });
          if ((navigator as any).canShare?.({ files: [file] })) {
            await (navigator as any).share({ files: [file], title: "Resultado Consubov" });
            return;
          }
        } catch {
          // fallback below
        }
      }
      baixarImagem(dataUrl);
      toast.success("Imagem baixada!");
    } catch (err) {
      console.error("Erro ao gerar imagem:", err);
      toast.error("Erro ao gerar imagem.");
    } finally {
      setSharing(false);
    }
  }

  function handleClose() {
    setPdfUrl(null);
    pdfBlobRef.current = null;
    setGeneratingPdf(false);
    setSharing(false);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
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

        {/* Preview do cartão */}
        <div
          className="mx-auto my-2 overflow-hidden rounded-xl"
          style={{ width: 390 * 0.45, height: 693 * 0.45 }}
        >
          <div style={{ transform: "scale(0.45)", transformOrigin: "top left" }}>
            {!resultado.loading && <ConsubovResultCard resultado={resultado} />}
            {resultado.loading && (
              <div
                style={{ width: 390, height: 693 }}
                className="flex items-center justify-center bg-muted"
              >
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}
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
            disabled
            className="cursor-not-allowed"
            title="Em breve"
          >
            <Camera className="w-4 h-4" />
          </Button>
          <Button
            className="flex-1 bg-green-900 hover:bg-green-900/90 text-white"
            onClick={exportarCartao}
            disabled={sharing || resultado.loading}
          >
            {sharing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Share2 className="w-4 h-4 mr-2" />
            )}
            Compartilhar
          </Button>
        </div>

        {/* Banner inferior */}
        <div className="mt-3 rounded-xl bg-muted p-3 flex items-center gap-3 opacity-70">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
