import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, X, Loader2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import type { PastoCache, ObservacaoOffline } from "@/lib/offlineDb";
import { compressImageDataUrl } from "@/lib/imageCompression";

const CATEGORIAS_ESTRUTURA = [
  { value: "porteira", label: "Porteira" },
  { value: "fio_rompido", label: "Fio rompido" },
  { value: "cocho", label: "Cocho" },
  { value: "estaca", label: "Estaca" },
  { value: "agua", label: "Água" },
  { value: "colchete", label: "Colchete" },
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
  editingObs?: ObservacaoOffline | null;
  onSave: (obs: Omit<ObservacaoOffline, 'id' | 'criado_em' | 'status'>) => void;
}

export default function ObservacaoModal({ open, onClose, pastos, retiroId, fazendaId, capatazNome, editingObs, onSave }: Props) {
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
      if (editingObs) {
        setFotoBase64(editingObs.foto_url);
        setCategoria(editingObs.tipo);
        setTexto(editingObs.descricao || "");
        setPastoId(editingObs.pasto_id || "");
        setStep('form');
      } else {
        setStep('camera');
        setFotoBase64(null);
        setCategoria("");
        setTexto("");
        setPastoId("");
      }
    }
  }, [open, editingObs]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const img = new Image();
      img.onload = async () => {
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
        canvas.width = 0;
        canvas.height = 0;
        const finalImage = await compressImageDataUrl(compressed);
        setFotoBase64(finalImage || compressed);
        setStep('form');
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
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
      onSave({
        pasto_id: pastoId || null,
        pasto_nome: pastos.find(p => p.id === pastoId)?.nome || "",
        retiro_id: retiroId,
        fazenda_id: fazendaId,
        capataz_nome: capatazNome,
        tipo: categoria,
        descricao: texto || null,
        foto_url: fotoBase64,
      });
      toast.success("✅ Observação salva offline");
      onClose();
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
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {step === 'camera' && !fotoBase64 && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Camera className="w-16 h-16 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">Tire uma foto ou escolha da galeria</p>
            <Button onClick={() => cameraInputRef.current?.click()} className="w-full gap-2">
              <Camera className="w-4 h-4" />
              📷 Abrir Câmera
            </Button>
            <Button onClick={() => galleryInputRef.current?.click()} variant="outline" className="w-full gap-2">
              <ImageIcon className="w-4 h-4" />
              🖼️ Escolher da Galeria
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
