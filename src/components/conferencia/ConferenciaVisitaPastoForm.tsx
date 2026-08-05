import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { compressImageFileToDataUrl } from "@/lib/imageCompression";
import type { DadosConferencia } from "./ConferenciaResultado";

interface Props {
  dados: DadosConferencia;
  /** Número inicial da numeração sequencial contínua da visita. */
  numeroInicial: number;
  saving: boolean;
  onBack: () => void;
  onSalvar: (observacao: string, fotosDataUrls: string[]) => void;
}

const MAX_FOTOS = 5;

export default function ConferenciaVisitaPastoForm({ dados, numeroInicial, saving, onBack, onSalvar }: Props) {
  const [observacao, setObservacao] = useState("");
  const [fotos, setFotos] = useState<string[]>([]);
  const [processando, setProcessando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFotos = async (files: FileList | null) => {
    if (!files) return;
    const restantes = MAX_FOTOS - fotos.length;
    if (restantes <= 0) {
      toast.error(`Máximo de ${MAX_FOTOS} fotos por pasto.`);
      return;
    }
    setProcessando(true);
    try {
      const arr = Array.from(files).slice(0, restantes);
      const urls = (await Promise.all(arr.map((f) => compressImageFileToDataUrl(f)))).filter(Boolean) as string[];
      setFotos((prev) => [...prev, ...urls].slice(0, MAX_FOTOS));
    } catch {
      toast.error("Não foi possível processar a foto.");
    } finally {
      setProcessando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="text-primary-foreground hover:bg-primary/80">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">Registrar {dados.pasto.nome}</h1>
          <p className="text-xs opacity-90 truncate">{dados.retiro.nome} • {dados.fazenda.nome}</p>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-4 max-w-2xl mx-auto w-full">
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
              <Label>Fotos ({fotos.length}/{MAX_FOTOS})</Label>
              <span className="text-xs text-muted-foreground">
                Numeração: {numeroInicial}
                {fotos.length > 1 ? `–${numeroInicial + fotos.length - 1}` : ""}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {fotos.map((src, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden border">
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
              {fotos.length < MAX_FOTOS && (
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
          onClick={() => onSalvar(observacao.trim(), fotos)}
        >
          {saving && <Loader2 className="w-5 h-5 animate-spin" />}
          SALVAR E CONTINUAR
        </Button>
      </main>
    </div>
  );
}
