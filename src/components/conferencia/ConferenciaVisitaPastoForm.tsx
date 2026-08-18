import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { compressImageFileToDataUrl } from "@/lib/imageCompression";

export interface FotoExistente {
  id: string;
  url: string;
  /** URL assinada para preview. */
  src?: string;
}

export interface ConferenciaPastoFormValues {
  observacao: string;
  qtd_animais: number | null;
  peso_medio_kg: number | null;
  consumo_medio_g: number | null;
  novasFotos: string[];
  fotosRemovidas: FotoExistente[];
}

interface Props {
  titulo: string;
  subtitulo: string;
  /** Linha informativa extra (ex.: "Última salga: 10/08/2026 — 12 sacos"). */
  infoUltimaSalga?: string | null;
  /** Número inicial da numeração sequencial contínua da visita. */
  numeroInicial: number;
  /** Números globais já atribuídos às fotos existentes (mesma ordem de `initial.fotos`). */
  numerosExistentes?: (number | undefined)[];
  saving: boolean;
  /** Modo edição: exibe fotos já salvas e campos numéricos editáveis. */
  edicao?: boolean;
  initial?: {
    observacao?: string | null;
    qtd_animais?: number | null;
    peso_medio_kg?: number | null;
    consumo_medio_g?: number | null;
    fotos?: FotoExistente[];
  };
  onBack: () => void;
  onSalvar: (values: ConferenciaPastoFormValues) => void;
}

const MAX_FOTOS = 5;

const numOrNull = (v: string): number | null => {
  const t = v.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

export default function ConferenciaVisitaPastoForm({
  titulo, subtitulo, infoUltimaSalga, numeroInicial, numerosExistentes, saving, edicao, initial, onBack, onSalvar,
}: Props) {
  const [observacao, setObservacao] = useState(initial?.observacao ?? "");
  const [qtdAnimais, setQtdAnimais] = useState(initial?.qtd_animais != null ? String(initial.qtd_animais) : "");
  const [pesoMedio, setPesoMedio] = useState(initial?.peso_medio_kg != null ? String(initial.peso_medio_kg) : "");
  const [consumoMedio, setConsumoMedio] = useState(initial?.consumo_medio_g != null ? String(initial.consumo_medio_g) : "");
  const [existentes, setExistentes] = useState<FotoExistente[]>(initial?.fotos ?? []);
  const [removidas, setRemovidas] = useState<FotoExistente[]>([]);
  const [fotos, setFotos] = useState<string[]>([]);
  const [processando, setProcessando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setExistentes(initial?.fotos ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.fotos]);

  const total = existentes.length + fotos.length;

  const handleFotos = async (files: FileList | null) => {
    if (!files) return;
    const restantes = MAX_FOTOS - total;
    if (restantes <= 0) {
      toast.error(`Máximo de ${MAX_FOTOS} fotos por pasto.`);
      return;
    }
    setProcessando(true);
    try {
      const arr = Array.from(files).slice(0, restantes);
      const urls = (await Promise.all(arr.map((f) => compressImageFileToDataUrl(f)))).filter(Boolean) as string[];
      setFotos((prev) => [...prev, ...urls].slice(0, MAX_FOTOS - existentes.length));
    } catch {
      toast.error("Não foi possível processar a foto.");
    } finally {
      setProcessando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removerExistente = (f: FotoExistente) => {
    setExistentes((prev) => prev.filter((x) => x.id !== f.id));
    setRemovidas((prev) => [...prev, f]);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="text-primary-foreground hover:bg-primary/80">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">{titulo}</h1>
          <p className="text-xs opacity-90 truncate">{subtitulo}</p>
          {infoUltimaSalga ? (
            <p className="text-xs opacity-90 truncate">{infoUltimaSalga}</p>
          ) : null}
        </div>
      </header>

      <main className="flex-1 p-4 space-y-4 max-w-2xl mx-auto w-full">
        {edicao && (
          <Card>
            <CardContent className="p-4 grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="qtd" className="text-xs">Animais</Label>
                <Input id="qtd" inputMode="numeric" value={qtdAnimais} onChange={(e) => setQtdAnimais(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="peso" className="text-xs">Peso médio (kg)</Label>
                <Input id="peso" inputMode="decimal" value={pesoMedio} onChange={(e) => setPesoMedio(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cons" className="text-xs">Consumo (g)</Label>
                <Input id="cons" inputMode="decimal" value={consumoMedio} onChange={(e) => setConsumoMedio(e.target.value)} />
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-4 space-y-2">
            <Label htmlFor="obs">Observação</Label>
            <Textarea
              id="obs"
              rows={5}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Descreva o que foi observado neste pasto..."
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label>Fotos ({total}/{MAX_FOTOS})</Label>
              <span className="text-xs text-muted-foreground">
                Numeração contínua do relatório
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {existentes.map((f, i) => {
                const n = numerosExistentes?.[i] ?? numeroInicial + i;
                return (
                  <div key={f.id} className="relative aspect-square rounded-lg overflow-hidden border">
                    {f.src
                      ? <img src={f.src} alt={`Foto ${n}`} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center bg-muted"><Loader2 className="w-4 h-4 animate-spin" /></div>}
                    <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-xs font-bold rounded px-1.5">
                      {n}
                    </span>
                    <button
                      type="button"
                      onClick={() => removerExistente(f)}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1"
                      aria-label="Remover foto"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
              {fotos.map((src, i) => (
                <div key={`nova-${i}`} className="relative aspect-square rounded-lg overflow-hidden border">
                  <img src={src} alt={`Foto ${numeroInicial + i}`} className="w-full h-full object-cover" />
                  <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-xs font-bold rounded px-1.5">
                    {numeroInicial + i}
                  </span>

                  <button
                    type="button"
                    onClick={() => setFotos((p) => p.filter((_, idx) => idx !== i))}
                    className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1"
                    aria-label="Remover foto"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {total < MAX_FOTOS && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 text-muted-foreground"
                >
                  {processando ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
                  <span className="text-xs">Adicionar</span>
                </button>
              )}
            </div>

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              className="hidden"
              onChange={(e) => void handleFotos(e.target.files)}
            />
          </CardContent>
        </Card>

        <Button
          size="lg"
          className="w-full gap-2"
          disabled={saving || processando}
          onClick={() => onSalvar({
            observacao: observacao.trim(),
            qtd_animais: numOrNull(qtdAnimais),
            peso_medio_kg: numOrNull(pesoMedio),
            consumo_medio_g: numOrNull(consumoMedio),
            novasFotos: fotos,
            fotosRemovidas: removidas,
          })}
        >
          {saving && <Loader2 className="w-5 h-5 animate-spin" />}
          {edicao ? "SALVAR ALTERAÇÕES" : "SALVAR E CONTINUAR"}
        </Button>
      </main>
    </div>
  );
}
