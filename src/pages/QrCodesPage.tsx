import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer, QrCode, Search, Loader2 } from "lucide-react";

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

export default function QrCodesPage() {
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [retiros, setRetiros] = useState<Retiro[]>([]);
  const [selectedFazenda, setSelectedFazenda] = useState<string>("");
  const [selectedRetiro, setSelectedRetiro] = useState<string>("");
  const [generatedPastos, setGeneratedPastos] = useState<Pasto[]>([]);
  const [generating, setGenerating] = useState(false);

  // Individual search state
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Pasto[]>([]);
  const [searchPage, setSearchPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [searching, setSearching] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Load fazendas on mount
  useEffect(() => {
    supabase.from("fazendas").select("id, nome").eq("ativo", true).order("nome").then(({ data }) => {
      setFazendas(data || []);
    });
  }, []);

  // Load retiros when fazenda changes (for retiro tab)
  const loadRetiros = useCallback(async (fazendaId: string) => {
    const { data } = await supabase.from("retiros").select("id, nome, fazenda_id").eq("fazenda_id", fazendaId).eq("ativo", true).order("nome");
    setRetiros(data || []);
  }, []);

  // Search pastos with infinite scroll
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

    // Enrich with retiro/fazenda names
    const enriched = await enrichPastos(pastos);

    if (append) {
      setSearchResults((prev) => [...prev, ...enriched]);
    } else {
      setSearchResults(enriched);
    }
    setHasMore(pastos.length === PAGE_SIZE);
    setSearching(false);
  }, []);

  // Initial search load
  useEffect(() => {
    setSearchPage(0);
    searchPastos(searchTerm, 0, false);
  }, [searchTerm, searchPastos]);

  // Infinite scroll observer
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

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
    if (pastos.length === 0) return [];

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
    const { data } = await supabase
      .from("pastos")
      .select("id, qr_uuid, nome, retiro_id")
      .eq("retiro_id", retiroId)
      .eq("ativo", true)
      .order("nome");
    const enriched = await enrichPastos(data || []);
    setGeneratedPastos(enriched);
    setGenerating(false);
  }

  async function generateByFazenda(fazendaId: string) {
    setGenerating(true);
    const { data: retirosData } = await supabase
      .from("retiros")
      .select("id")
      .eq("fazenda_id", fazendaId)
      .eq("ativo", true);

    const retiroIds = (retirosData || []).map((r) => r.id);
    if (retiroIds.length === 0) {
      setGeneratedPastos([]);
      setGenerating(false);
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
    setGenerating(false);
  }

  function selectIndividualPasto(pasto: Pasto) {
    setGeneratedPastos([pasto]);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <h1 className="text-2xl font-bold text-foreground">Gerar QR Codes</h1>
        {generatedPastos.length > 0 && (
          <Button onClick={handlePrint} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Printer className="w-4 h-4 mr-2" />
            Imprimir ({generatedPastos.length})
          </Button>
        )}
      </div>

      <Tabs defaultValue="individual" className="print:hidden">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="individual">Pasto Individual</TabsTrigger>
          <TabsTrigger value="retiro">Por Retiro</TabsTrigger>
          <TabsTrigger value="fazenda">Por Fazenda</TabsTrigger>
        </TabsList>

        <TabsContent value="individual" className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar pasto por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="max-h-64 overflow-y-auto border rounded-md divide-y">
            {searchResults.map((p) => (
              <button
                key={p.id}
                onClick={() => selectIndividualPasto(p)}
                className="w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors flex justify-between items-center"
              >
                <div>
                  <p className="font-medium text-foreground">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">{p.retiro_nome} • {p.fazenda_nome}</p>
                </div>
                <QrCode className="w-4 h-4 text-muted-foreground" />
              </button>
            ))}
            {searchResults.length === 0 && !searching && (
              <p className="text-center text-muted-foreground py-6 text-sm">Nenhum pasto encontrado</p>
            )}
            <div ref={loadMoreRef} className="h-1" />
            {searching && (
              <div className="flex justify-center py-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="retiro" className="space-y-3">
          <Select
            value={selectedFazenda}
            onValueChange={(v) => {
              setSelectedFazenda(v);
              setSelectedRetiro("");
              loadRetiros(v);
            }}
          >
            <SelectTrigger><SelectValue placeholder="Selecione a fazenda" /></SelectTrigger>
            <SelectContent>
              {fazendas.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={selectedRetiro}
            onValueChange={setSelectedRetiro}
            disabled={!selectedFazenda}
          >
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
            {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <QrCode className="w-4 h-4 mr-2" />}
            Gerar QR Codes do Retiro
          </Button>
        </TabsContent>

        <TabsContent value="fazenda" className="space-y-3">
          <Select
            value={selectedFazenda}
            onValueChange={setSelectedFazenda}
          >
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
            {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <QrCode className="w-4 h-4 mr-2" />}
            Gerar QR Codes da Fazenda
          </Button>
        </TabsContent>
      </Tabs>

      {/* Generated QR Codes Grid */}
      {generatedPastos.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 print:hidden">
            {generatedPastos.length} QR Code{generatedPastos.length > 1 ? "s" : ""} gerado{generatedPastos.length > 1 ? "s" : ""}
          </h2>
          <div className="qr-print-wrapper">
            {Array.from({ length: Math.ceil(generatedPastos.length / 4) }).map((_, pageIdx) => (
              <div key={pageIdx} className="qr-print-page grid grid-cols-2 gap-4">
                {generatedPastos.slice(pageIdx * 4, pageIdx * 4 + 4).map((p) => (
                  <Card key={p.id} className="qr-card bg-card border border-border overflow-hidden">
                    <CardContent className="flex flex-col items-center justify-center p-6">
                      <QRCodeSVG
                        value={p.qr_uuid}
                        size={180}
                        level="H"
                        includeMargin
                        className="mb-3"
                      />
                      <p className="font-bold text-foreground text-center text-base">{p.nome}</p>
                      <p className="text-sm text-muted-foreground text-center">{p.retiro_nome}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          body * {
            visibility: hidden;
          }
          .qr-print-wrapper,
          .qr-print-wrapper * {
            visibility: visible;
          }
          .qr-print-wrapper {
            position: absolute;
            left: 0;
            top: 0;
            width: 190mm;
          }
          .qr-print-page {
            width: 190mm;
            height: 277mm;
            display: grid !important;
            grid-template-columns: 92mm 92mm;
            grid-template-rows: 135mm 135mm;
            gap: 3mm;
            page-break-after: always;
            break-after: page;
            box-sizing: border-box;
          }
          .qr-print-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          .qr-card {
            width: 92mm;
            height: 135mm;
            page-break-inside: avoid;
            break-inside: avoid;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            display: flex !important;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            padding: 8mm;
          }
          .qr-card svg {
            width: 65mm !important;
            height: 65mm !important;
          }
        }
      `}</style>
    </div>
  );
}
