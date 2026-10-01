import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CriarEscritorioModal({ open, onClose }: Props) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [fazendaId, setFazendaId] = useState("");
  const [fazendas, setFazendas] = useState<{ id: string; nome: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      supabase.from("fazendas").select("id, nome").eq("ativo", true).then(({ data }) => {
        setFazendas(data ?? []);
      });
    }
  }, [open]);

  const handleSave = async () => {
    if (!nome.trim() || !email.trim() || !fazendaId) {
      toast.error("Preencha nome, email e selecione a fazenda.");
      return;
    }

    setSaving(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();

      // 1. Create auth user via edge function with default password
      const { data: fnData, error: fnError } = await supabase.functions.invoke("create-user", {
        body: {
          email: normalizedEmail,
          senha: "Consubov@2025",
          role: "usuario", // don't create admin record
        },
      });

      if (fnError) throw new Error(fnError.message || "Erro ao criar usuário");
      
      const responseData = typeof fnData === "string" ? JSON.parse(fnData) : fnData;
      if (responseData?.error) throw new Error(responseData.error);

      const userId = responseData?.user?.id;
      if (!userId) throw new Error("ID do usuário não retornado");

      // 2. Insert into escritorios table
      const { error: dbError } = await supabase.from("escritorios").insert({
        nome: nome.trim(),
        email: normalizedEmail,
        telefone: telefone.trim() || null,
        fazenda_id: fazendaId,
        user_id: userId,
        ativo: true,
      });

      if (dbError) throw dbError;

      toast.success("Escritório criado com sucesso!");
      setNome(""); setEmail(""); setTelefone(""); setFazendaId("");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar escritório");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Escritório</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do escritório" />
          </div>
          <div>
            <Label>Email *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
          </div>
          <div>
            <Label>Fazenda *</Label>
            <Select value={fazendaId} onValueChange={setFazendaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a fazenda" />
              </SelectTrigger>
              <SelectContent>
                {fazendas.map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Senha padrão: Consubov@2025 (definida automaticamente)
          </p>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Criando..." : "Criar Escritório"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
