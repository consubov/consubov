import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { PastoCache } from "@/lib/offlineDb";

const CATEGORIAS_ESTRUTURA = [
  { value: "porteira", label: "Porteira" },
  { value: "fio_rompido", label: "Fio rompido" },
  { value: "cocho", label: "Cocho" },
  { value: "estaca", label: "Estaca" },
  { value: "agua", label: "Água" },
];

const CATEGORIAS_ANIMAL = [
  { value: "animal_doente", label: "Animal doente" },
  { value: "animal_machucado", label: "Animal machucado" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  pastos: PastoCache[];
  retiroId: string;
  fazendaId: string;
  capatazNome: string;
}

export default function ObservacaoModal({ open, onClose, pastos, retiroId, fazendaId, capatazNome }: Props) {
  const [step, setStep] = useState<'camera' | 'form'>('camera');
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  const [categoria, setCategoria] = useState("");
  const [texto, setTexto] = useState("");
  const [pastoId, setPastoId] = useState("");
  const [saving, setSaving] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setStep('camera');
      setFotoBase64(null);
      setCategoria("");
      setTexto("");
      setPastoId("");
      // Auto-open camera
      setTimeout(() => fileInputRef.current?.click(), 300);
    }
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      // Compress image
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 1024;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL("image/jpeg", 0.7);
        setFotoBase64(compressed);
        setStep('form');
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!fotoBase64) {
      toast.error("Foto obrigatória");
      return;
    }
    if (!categoria) {
      toast.error("Selecione uma categoria");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("observacoes").insert({
        pasto_id: pastoId || null,
        retiro_id: retiroId,
        fazenda_id: fazendaId,
        capataz_nome: capatazNome,
        tipo: categoria,
        descricao: texto || null,
        foto_url: fotoBase64,
        resolvido: false,
      });

      if (error) throw error;
      toast.success("✅ Observação registrada");
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar observação");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>+ Observação</DialogTitle>
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        {step === 'camera' && !fotoBase64 && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Camera className="w-16 h-16 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">Tire uma foto para registrar a observação</p>
            <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
              <Camera className="w-4 h-4" />
              Abrir Câmera
            </Button>
          </div>
        )}

        {step === 'form' && fotoBase64 && (
          <div className="space-y-4">
            {/* Photo preview */}
            <div className="relative">
              <img src={fotoBase64} alt="Foto" className="w-full h-40 object-cover rounded-md" />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 bg-background/80 h-7 w-7"
                onClick={() => { setFotoBase64(null); setStep('camera'); }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Category selection */}
            <div>
              <p className="text-sm font-medium mb-2">Estrutura</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIAS_ESTRUTURA.map((c) => (
                  <Button
                    key={c.value}
                    variant={categoria === c.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCategoria(c.value)}
                  >
                    {c.label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Animal</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIAS_ANIMAL.map((c) => (
                  <Button
                    key={c.value}
                    variant={categoria === c.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCategoria(c.value)}
                  >
                    {c.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Optional text */}
            <div>
              <label className="text-sm font-medium mb-1 block">Descrição (opcional)</label>
              <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Descreva a situação..." rows={2} />
            </div>

            {/* Pasto select */}
            <div>
              <label className="text-sm font-medium mb-1 block">Pasto</label>
              <Select value={pastoId} onValueChange={setPastoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o pasto" />
                </SelectTrigger>
                <SelectContent>
                  {pastos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleSave} className="w-full" disabled={saving || !categoria || !fotoBase64}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
