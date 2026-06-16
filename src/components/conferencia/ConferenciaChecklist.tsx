import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { saveChecklist } from "@/lib/conferenciaOffline";
import type { DadosConferencia } from "./ConferenciaResultado";

interface Props {
  dados: DadosConferencia;
  userId: string;
  perfil: string;
  onBack: () => void;
  onSaved: () => void;
}

const MAX_FOTOS = 5;

const ITENS = [
  { key: "cocho_abastecido", label: "Cocho abastecido" },
  { key: "cocho_parcial", label: "Cocho parcialmente abastecido" },
  { key: "cocho_vazio", label: "Cocho vazio" },
  { key: "cocho_danificado", label: "Cocho danificado" },
  { key: "placa_qr_presente", label: "Placa QR presente" },
  { key: "placa_qr_danificada", label: "Placa QR danificada" },
  { key: "qtd_compativel", label: "Quantidade visual compatível" },
  { key: "qtd_divergente", label: "Quantidade visual divergente" },
  { key: "necessita_atencao", label: "Necessita atenção" },
] as const;

type ChecklistKey = typeof ITENS[number]["key"];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ConferenciaChecklist({ dados, userId, perfil, onBack, onSaved }: Props) {
  const [marcados, setMarcados] = useState<Record<ChecklistKey, boolean>>(() =>
    Object.fromEntries(ITENS.map((i) => [i.key, false])) as Record<ChecklistKey, boolean>
  );
  const [observacoes, setObservacoes] = useState("");
  const [fotos, setFotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFotos = async (files: FileList | null) => {
    if (!files) return;
    const remaining = MAX_FOTOS - fotos.length;
    const toAdd = Array.from(files).slice(0, remaining);
    const dataUrls = await Promise.all(toAdd.map(fileToDataUrl));
    setFotos((prev) => [...prev, ...dataUrls]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { queued } = await saveChecklist({
        fazenda_id: dados.fazenda.id,
        retiro_id: dados.retiro.id,
        pasto_id: dados.pasto.id,
        user_id: userId,
        perfil,
        ...marcados,
        observacoes: observacoes.trim() || null,
        fotosDataUrls: fotos,
      });
      toast.success(queued ? "Conferência salva offline. Será sincronizada ao reconectar." : "Conferência registrada.");
      onSaved();
    } catch (err) {
      toast.error("Não foi possível salvar a conferência.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="text-primary-foreground hover:bg-primary/80">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">Registrar Conferência</h1>
          <p className="text-xs opacity-90 truncate">{dados.pasto.nome}</p>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-4 max-w-2xl mx-auto w-full">
        <Card>
          <CardContent className="p-4 space-y-3">
            {ITENS.map((item) => (
              <div key={item.key} className="flex items-center gap-3">
                <Checkbox
                  id={item.key}
                  checked={marcados[item.key]}
                  onCheckedChange={(v) => setMarcados((m) => ({ ...m, [item.key]: !!v }))}
                />
                <Label htmlFor={item.key} className="text-sm cursor-pointer flex-1">{item.label}</Label>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-2">
          <Label htmlFor="obs" className="text-sm font-semibold">Observações</Label>
          <Textarea
            id="obs"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Descreva detalhes da conferência..."
            rows={4}
            maxLength={1000}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold">Fotos ({fotos.length}/{MAX_FOTOS})</Label>
          <div className="grid grid-cols-3 gap-2">
            {fotos.map((src, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden border">
                <img src={src} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setFotos((prev) => prev.filter((_, idx) => idx !== i))}
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
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/40 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <Camera className="w-6 h-6" />
                <span className="text-xs">Adicionar</span>
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => handleFotos(e.target.files)}
          />
        </div>

        <Button onClick={handleSave} disabled={saving} size="lg" className="w-full gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          SALVAR CONFERÊNCIA
        </Button>
      </main>
    </div>
  );
}
