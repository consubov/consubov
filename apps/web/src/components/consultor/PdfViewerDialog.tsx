import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Share2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { downloadPdfFromUrl } from "@/lib/downloadPdf";

interface Props {
  url: string | null;
  fileName?: string;
  title?: string;
  onClose: () => void;
}

// Visualizador de PDF embutido no app: baixa o arquivo como blob e exibe
// dentro de um <iframe>, evitando expor a URL do Supabase Storage na barra
// de endereço do navegador. Também oferece Baixar/Enviar a partir do blob.
export default function PdfViewerDialog({ url, fileName, title, onClose }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentUrlRef = useRef<string | null>(null);

  const open = !!url;
  const name = fileName || "relatorio.pdf";

  useEffect(() => {
    if (!url) {
      if (currentUrlRef.current) {
        URL.revokeObjectURL(currentUrlRef.current);
        currentUrlRef.current = null;
      }
      setBlobUrl(null); setBlob(null); setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true); setError(null);
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const b = await res.blob();
        if (cancelled) return;
        const u = URL.createObjectURL(b);
        currentUrlRef.current = u;
        setBlob(b);
        setBlobUrl(u);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error && e.message ? e.message : "Falha ao carregar PDF");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  useEffect(() => () => {
    if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current);
  }, []);

  async function baixar() {
    if (blob) {
      const a = document.createElement("a");
      const u = URL.createObjectURL(blob);
      a.href = u; a.download = name; a.rel = "noopener";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 2000);
    } else if (url) {
      await downloadPdfFromUrl(url, name);
    }
  }

  async function enviar() {
    try {
      if (blob && navigator.canShare) {
        const file = new File([blob], name, { type: "application/pdf" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: title || "Relatório Consubov" });
          return;
        }
      }
      if (blob) {
        // Fallback: baixar (evita expor URL)
        await baixar();
        toast.success("PDF baixado — envie manualmente pelo seu app preferido.");
      }
    } catch { /* cancelado */ }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent showCloseButton={false} className="max-w-5xl w-[95vw] h-[92vh] p-0 gap-0 flex flex-col">
        <DialogDescription className="sr-only">Visualizar, baixar ou compartilhar o relatorio PDF.</DialogDescription>
        <DialogHeader className="p-3 border-b flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-sm truncate pr-2">{title || "Relatório PDF"}</DialogTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={baixar} disabled={!blob && !url}>
              <Download className="w-4 h-4" /> Baixar
            </Button>
            <Button size="sm" className="gap-1.5" style={{ background: "#1F7A4D", color: "white" }} onClick={enviar} disabled={!blob}>
              <Share2 className="w-4 h-4" /> Enviar
            </Button>
            <Button size="icon" variant="ghost" onClick={onClose} aria-label="Fechar">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 bg-muted/30">
          {loading && (
            <div className="h-full flex items-center justify-center text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando PDF…
            </div>
          )}
          {error && !loading && (
            <div className="h-full flex flex-col items-center justify-center gap-3 p-4 text-center">
              <div className="text-sm text-destructive">Não foi possível carregar o PDF no visualizador.</div>
              <Button size="sm" variant="outline" onClick={baixar}>Baixar PDF</Button>
            </div>
          )}
          {blobUrl && !loading && !error && (
            <iframe
              src={blobUrl}
              title={title || "Relatório PDF"}
              className="w-full h-full border-0"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
