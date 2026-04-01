import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, X, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { PastoCache } from "@/lib/offlineDb";

interface Props {
  open: boolean;
  onClose: () => void;
  pastos: PastoCache[];
  retiroId: string;
  fazendaId: string;
  capatazNome: string;
  onPastoUpdated: () => void;
}

export default function MortalidadeModal({ open, onClose, pastos, retiroId, fazendaId, capatazNome, onPastoUpdated }: Props) {
  const [pastoId, setPastoId] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedPasto = pastos.find((p) => p.id === pastoId);
  const animaisAtuais = selectedPasto?.num_animais ?? 0;
  const animaisRestantes = animaisAtuais - quantidade;

  useEffect(() => {
    if (open) {
      setPastoId("");
      setQuantidade(1);
      setFotoBase64(null);
      setObservacao("");
    }
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
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
        setFotoBase64(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!pastoId) { toast.error("Selecione um pasto"); return; }
    if (!fotoBase64) { toast.error("Foto obrigatória"); return; }
    if (quantidade < 1 || quantidade > animaisAtuais) { toast.error("Quantidade inválida"); return; }

    setSaving(true);
    try {
      // 1. Insert observação
      const { error: obsError } = await supabase.from("observacoes").insert({
        pasto_id: pastoId,
        retiro_id: retiroId,
        fazenda_id: fazendaId,
        capataz_nome: capatazNome,
        tipo: "mortalidade",
        descricao: observacao ? `Mortalidade: ${quantidade} animal(is). ${observacao}` : `Mortalidade: ${quantidade} animal(is).`,
        foto_url: fotoBase64,
        resolvido: false,
      });
      if (obsError) throw obsError;

      // 2. Update num_animais
      const { error: updateError } = await supabase
        .from("pastos")
        .update({ num_animais: animaisRestantes })
        .eq("id", pastoId);
      if (updateError) throw updateError;

      toast.success("✅ Mortalidade registrada");
      onPastoUpdated();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao registrar mortalidade");
    } finally {
      setSaving(false);
    }
  };

  const isValid = pastoId && fotoBase64 && quantidade >= 1 && quantidade <= animaisAtuais;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>🐄</span> Mortalidade
          </DialogTitle>
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="space-y-4">
          {/* Pasto select */}
          <div>
            <label className="text-sm font-medium mb-1 block">Pasto *</label>
            <Select value={pastoId} onValueChange={(v) => { setPastoId(v); setQuantidade(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o pasto" />
              </SelectTrigger>
              <SelectContent>
                {pastos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome} ({p.num_animais} animais)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Show current animals */}
          {selectedPasto && (
            <div className="bg-muted rounded-md p-3">
              <p className="text-sm font-medium">Animais atuais: <span className="text-primary font-bold">{animaisAtuais}</span></p>
            </div>
          )}

          {/* Quantidade */}
          {selectedPasto && (
            <div>
              <label className="text-sm font-medium mb-1 block">Quantidade *</label>
              <Input
                type="number"
                min={1}
                max={animaisAtuais}
                value={quantidade}
                onChange={(e) => {
                  const v = parseInt(e.target.value) || 0;
                  setQuantidade(Math.max(0, Math.min(v, animaisAtuais)));
                }}
              />
            </div>
          )}

          {/* Confirmation */}
          {selectedPasto && quantidade >= 1 && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm">
                Quantidade atual: <strong>{animaisAtuais}</strong> → ficará: <strong>{animaisRestantes}</strong>
              </p>
            </div>
          )}

          {/* Photo */}
          <div>
            <label className="text-sm font-medium mb-1 block">Foto *</label>
            {fotoBase64 ? (
              <div className="relative">
                <img src={fotoBase64} alt="Foto" className="w-full h-40 object-cover rounded-md" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1 right-1 bg-background/80 h-7 w-7"
                  onClick={() => setFotoBase64(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full gap-2">
                <Camera className="w-4 h-4" />
                Tirar Foto
              </Button>
            )}
          </div>

          {/* Observação */}
          <div>
            <label className="text-sm font-medium mb-1 block">Observação (opcional)</label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Detalhes adicionais..." rows={2} />
          </div>

          <Button onClick={handleSave} className="w-full" variant="destructive" disabled={saving || !isValid}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar Mortalidade"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
