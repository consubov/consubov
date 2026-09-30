import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, ListPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BulkPastosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  retiroId: string;
  onCreated: () => void;
}

export default function BulkPastosModal({ open, onOpenChange, retiroId, onCreated }: BulkPastosModalProps) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const names = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (names.length === 0) {
      toast.error("Digite pelo menos um nome de pasto.");
      return;
    }

    setSaving(true);
    try {
      const rows = names.map((nome) => ({ nome, retiro_id: retiroId, num_animais: 0 }));
      const { error } = await supabase.from("pastos").insert(rows);
      if (error) throw error;
      toast.success(`${names.length} pasto(s) criado(s) com sucesso!`);
      setText("");
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      console.error("Erro ao criar pastos em lote:", err);
      toast.error(`Erro: ${err?.message || "Erro desconhecido"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListPlus className="w-5 h-5" /> Adicionar Vários Pastos
          </DialogTitle>
          <DialogDescription>
            Cole os nomes dos pastos, um por linha. Todos serão criados vinculados a este retiro.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label htmlFor="bulk-names">Nomes dos pastos (um por linha)</Label>
          <Textarea
            id="bulk-names"
            rows={8}
            placeholder={"Pasto A1\nPasto A2\nPasto B1\nPasto B2"}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {text.split("\n").filter((l) => l.trim()).length} pasto(s) serão criados
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar Pastos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
