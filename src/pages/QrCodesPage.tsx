import { useEffect, useState, useCallback, useRef } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileDown, QrCode, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { buildFixedPages } from "@/lib/qrCodeLayout";

interface Pasto {
  id: string;
  qr_uuid: string;
  nome: string;
  retiro_id: string;
  retiro_nome?: string;
  fazenda_nome?: string;
}

interface Fazenda {
  id: string;
  nome: string;
}

interface Retiro {
  id: string;
  nome: string;
  fazenda_id: string;
}

const PAGE_SIZE = 20;
const QR_CODES_PER_PAGE = 4;
const QR_CODES_PER_ROW = 2;

export default function QrCodesPage() {
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [retiros, setRetiros] = useState<Retiro[]>([]);
  const [selectedFazenda, setSelectedFazenda] = useState<string>("");
  const [selectedRetiro, setSelectedRetiro] = useState<string>("");
  const [generatedPastos, setGeneratedPastos] = useState<Pasto[]>([]);
  const [generating, setGenerating] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Pasto[]>([]);
  const [searchPage, setSearchPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [searching, setSearching] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const capturePagesRef = useRef<Array<HTMLElement | null>>([]);

  const qrPages = buildFixedPages(generatedPastos, QR_CODES_PER_PAGE);
  capturePagesRef.current = capturePagesRef.current.slice(0, qrPages.length);

  useEffect(() => {
    supabase.from("fazendas").select("id, nome").eq("ativo", true).order("nome").then(({ data }) => {
      setFazendas(data || []);
    });
  }, []);

  const loadRetiros = useCallback(async (fazendaId: string) => {
    const { data } = await supabase
      .from("retiros")
      .select("id, nome, fazenda_id")
      .eq("fazenda_id", fazendaId)
      .eq("ativo", true)
      .order("nome");

    setRetiros(data || []);
  }, []);

  const searchPastos = useCallback(async (term: string, page: number, append: boolean) => {
    setSearching(true);

    let query = supabase
      .from("pastos")
      .select("id, qr_uuid, nome, retiro_id")
      .eq("ativo", true)
      .order("nome")
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (term.trim()) {
      query = query.ilike("nome", `%${term.trim()}%`);
    }

    const { data } = await query;
    const pastos = data || [];
    const enriched = await enrichPastos(pastos);

    if (append) {
      setSearchResults((prev) => [...prev, ...enriched]);
    } else {
      setSearchResults(enriched);
    }

    setHasMore(pastos.length === PAGE_SIZE);
    setSearching(false);
  }, []);

  useEffect(() => {
    setSearchPage(0);
    searchPastos(searchTerm, 0, false);
  }, [searchTerm, searchPastos]);

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !searching) {
        const nextPage = searchPage + 1;
        setSearchPage(nextPage);
        searchPastos(searchTerm, nextPage, true);
      }
    });

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [hasMore, searching, searchPage, searchTerm, searchPastos]);

  async function enrichPastos(pastos: Pasto[]): Promise<Pasto[]> {
    if (pastos.length === 0) {
      return [];
    }

    const retiroIds = [...new Set(pastos.map((p) => p.retiro_id))];
    const { data: retirosData } = await supabase
      .from("retiros")
      .select("id, nome, fazenda_id")
      .in("id", retiroIds);

    const fazendaIds = [...new Set((retirosData || []).map((r) => r.fazenda_id))];
    const { data: fazendasData } = await supabase
      .from("fazendas")
      .select("id, nome")
      .in("id", fazendaIds);

    const retiroMap = new Map((retirosData || []).map((r) => [r.id, r]));
    const fazendaMap = new Map((fazendasData || []).map((f) => [f.id, f]));

    return pastos.map((p) => {
      const retiro = retiroMap.get(p.retiro_id);
      const fazenda = retiro ? fazendaMap.get(retiro.fazenda_id) : undefined;

      return {
        ...p,
        retiro_nome: retiro?.nome || "—",
        fazenda_nome: fazenda?.nome || "—",
      };
    });
  }

  async function generateByRetiro(retiroId: string) {
    setGenerating(true);

    try {
      const { data } = await supabase
        .from("pastos")
        .select("id, qr_uuid, nome, retiro_id")
        .eq("retiro_id", retiroId)
        .eq("ativo", true)
        .order("nome");

      const enriched = await enrichPastos(data || []);
      setGeneratedPastos(enriched);
    } finally {
      setGenerating(false);
    }
  }

  async function generateByFazenda(fazendaId: string) {
    setGenerating(true);

    try {
      const { data: retirosData } = await supabase
        .from("retiros")
        .select("id")
        .eq("fazenda_id", fazendaId)
        .eq("ativo", true);

      const retiroIds = (retirosData || []).map((r) => r.id);
      if (retiroIds.length === 0) {
        setGeneratedPastos([]);
        return;
      }

      const { data } = await supabase
        .from("pastos")
        .select("id, qr_uuid, nome, retiro_id")
        .in("retiro_id", retiroIds)
        .eq("ativo", true)
        .order("nome");

      const enriched = await enrichPastos(data || []);
      setGeneratedPastos(enriched);
    } finally {
      setGenerating(false);
    }
  }

  function selectIndividualPasto(pasto: Pasto) {
    setGeneratedPastos([pasto]);
  }

  async function handleExportPdf() {
    if (generatedPastos.length === 0) {
      return;
    }

    setExportingPdf(true);

    try {
      // Espera o React renderizar e as imagens carregarem
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      await Promise.all(
        Array.from(document.querySelectorAll<HTMLImageElement>("[data-qr-capture-page] img")).map(
          (img) =>
            img.complete && img.naturalWidth > 0
              ? Promise.resolve()
              : new Promise<void>((resolve) => {
                  img.addEventListener("load", () => resolve(), { once: true });
                  img.addEventListener("error", () => resolve(), { once: true });
                }),
        ),
      );

      const pdfDoc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidthMm = 210;
      const pageHeightMm = 297;

      const pageNodes = capturePagesRef.current.filter(
        (node): node is HTMLElement => node !== null,
      );

      for (let i = 0; i < pageNodes.length; i++) {
        const node = pageNodes[i];
        const canvas = await html2canvas(node, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#FFFFFF",
          logging: false,
        });
        const imgData = canvas.toDataURL("image/png");
        if (i > 0) pdfDoc.addPage();
        pdfDoc.addImage(imgData, "PNG", 0, 0, pageWidthMm, pageHeightMm);
      }

      pdfDoc.save(`qr-codes-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao gerar o PDF dos QR Codes.");
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">Gerar QR Codes</h1>
        {generatedPastos.length > 0 && (
          <Button onClick={handleExportPdf} disabled={exportingPdf} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {exportingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
            Baixar PDF ({generatedPastos.length})
          </Button>
        )}
      </div>

      <Tabs defaultValue="individual">
        <TabsList className="mb-4 grid w-full grid-cols-3">
          <TabsTrigger value="individual">Pasto Individual</TabsTrigger>
          <TabsTrigger value="retiro">Por Retiro</TabsTrigger>
          <TabsTrigger value="fazenda">Por Fazenda</TabsTrigger>
        </TabsList>

        <TabsContent value="individual" className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar pasto por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="max-h-64 overflow-y-auto divide-y rounded-md border">
            {searchResults.map((p) => (
              <button
                key={p.id}
                onClick={() => selectIndividualPasto(p)}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-accent/50"
              >
                <div>
                  <p className="font-medium text-foreground">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">{p.retiro_nome} • {p.fazenda_nome}</p>
                </div>
                <QrCode className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}

            {searchResults.length === 0 && !searching && (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhum pasto encontrado</p>
            )}

            <div ref={loadMoreRef} className="h-1" />

            {searching && (
              <div className="flex justify-center py-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="retiro" className="space-y-3">
          <Select
            value={selectedFazenda}
            onValueChange={(value) => {
              setSelectedFazenda(value);
              setSelectedRetiro("");
              loadRetiros(value);
            }}
          >
            <SelectTrigger><SelectValue placeholder="Selecione a fazenda" /></SelectTrigger>
            <SelectContent>
              {fazendas.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedRetiro} onValueChange={setSelectedRetiro} disabled={!selectedFazenda}>
            <SelectTrigger><SelectValue placeholder="Selecione o retiro" /></SelectTrigger>
            <SelectContent>
              {retiros.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={() => selectedRetiro && generateByRetiro(selectedRetiro)}
            disabled={!selectedRetiro || generating}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
            Gerar QR Codes do Retiro
          </Button>
        </TabsContent>

        <TabsContent value="fazenda" className="space-y-3">
          <Select value={selectedFazenda} onValueChange={setSelectedFazenda}>
            <SelectTrigger><SelectValue placeholder="Selecione a fazenda" /></SelectTrigger>
            <SelectContent>
              {fazendas.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={() => selectedFazenda && generateByFazenda(selectedFazenda)}
            disabled={!selectedFazenda || generating}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
            Gerar QR Codes da Fazenda
          </Button>
        </TabsContent>
      </Tabs>

      {generatedPastos.length > 0 && (
        <div className="mt-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            {generatedPastos.length} QR Code{generatedPastos.length > 1 ? "s" : ""} gerado{generatedPastos.length > 1 ? "s" : ""}
          </h2>

          <div className="space-y-6">
            {qrPages.map((page, pageIndex) => (
              <section
                key={`preview-page-${pageIndex}`}
                aria-label={`Pré-visualização da página ${pageIndex + 1}`}
                className="mx-auto flex aspect-[210/297] w-full max-w-[820px] flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm"
              >
                {[0, 1].map((rowIndex) => {
                  const rowItems = page.slice(rowIndex * QR_CODES_PER_ROW, rowIndex * QR_CODES_PER_ROW + QR_CODES_PER_ROW);

                  return (
                    <div key={`preview-row-${pageIndex}-${rowIndex}`} className="flex min-h-0 flex-1 gap-4">
                      {rowItems.map((pasto, columnIndex) => (
                        <div key={`preview-slot-${pageIndex}-${rowIndex}-${columnIndex}`} className="min-h-0 min-w-0 flex-1">
                          {pasto ? (
                            <div className="flex h-full flex-col items-center justify-between rounded-xl border bg-card px-3 py-2 text-center shadow-sm" style={{ overflow: "visible" }}>
                              <div className="flex flex-col items-center">
                                <img
                                  src="/logo-consubov-print.png"
                                  alt="Consubov"
                                  className="h-12 w-full max-w-[192px] shrink-0 object-contain object-center"
                                />
                                {pasto.fazenda_nome && (
                                  <p className="mt-0.5 text-[8px] leading-tight" style={{ color: "#555" }}>
                                    {pasto.fazenda_nome}
                                  </p>
                                )}
                              </div>
                              <QRCodeSVG value={pasto.qr_uuid} size={120} level="H" includeMargin className="h-[120px] w-[120px] shrink-0" />
                              <div className="flex flex-col items-center">
                                <p className="break-words text-sm font-bold leading-tight text-foreground">{pasto.nome}</p>
                                <p className="break-words text-[11px] leading-tight text-muted-foreground">{pasto.retiro_nome}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="h-full rounded-xl border border-dashed border-border bg-muted/30" aria-hidden="true" />
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </section>
            ))}
          </div>

          {/* Mirror oculto em tamanho fixo (820px) usado para gerar o PDF idêntico ao preview */}
          <div
            aria-hidden="true"
            style={{
              position: "fixed",
              left: "-10000px",
              top: 0,
              width: "820px",
              pointerEvents: "none",
              opacity: 0,
            }}
          >
            <div className="space-y-6">
              {qrPages.map((page, pageIndex) => (
                <section
                  key={`capture-page-${pageIndex}`}
                  ref={(el) => {
                    capturePagesRef.current[pageIndex] = el;
                  }}
                  data-qr-capture-page="true"
                  style={{ width: "820px", height: `${(820 * 297) / 210}px` }}
                  className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm"
                >
                  {[0, 1].map((rowIndex) => {
                    const rowItems = page.slice(rowIndex * QR_CODES_PER_ROW, rowIndex * QR_CODES_PER_ROW + QR_CODES_PER_ROW);
                    return (
                      <div key={`crow-${rowIndex}`} className="flex min-h-0 flex-1 gap-4">
                        {rowItems.map((pasto, columnIndex) => (
                          <div key={`cslot-${rowIndex}-${columnIndex}`} className="min-h-0 min-w-0 flex-1">
                            {pasto ? (
                              <div className="flex h-full flex-col items-center justify-between rounded-xl border bg-card px-3 py-2 text-center shadow-sm" style={{ overflow: "visible" }}>
                                <div className="flex flex-col items-center">
                                  <img
                                    src="/logo-consubov-print.png"
                                    alt="Consubov"
                                    className="h-12 w-full max-w-[192px] shrink-0 object-contain object-center"
                                  />
                                  {pasto.fazenda_nome && (
                                    <p className="mt-0.5 text-[8px] leading-tight" style={{ color: "#555" }}>
                                      {pasto.fazenda_nome}
                                    </p>
                                  )}
                                </div>
                                <QRCodeSVG value={pasto.qr_uuid} size={120} level="H" includeMargin className="h-[120px] w-[120px] shrink-0" />
                                <div className="flex flex-col items-center">
                                  <p className="break-words text-sm font-bold leading-tight text-foreground">{pasto.nome}</p>
                                  <p className="break-words text-[11px] leading-tight text-muted-foreground">{pasto.retiro_nome}</p>
                                </div>
                              </div>
                            ) : (
                              <div className="h-full rounded-xl border border-dashed border-border bg-muted/30" aria-hidden="true" />
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
