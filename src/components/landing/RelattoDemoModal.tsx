import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function RelattoDemoModal({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [loading, setLoading] = useState(false);

  async function iniciarDemo(e: React.FormEvent) {
    e.preventDefault();
    if (nome.trim().length < 2 || sobrenome.trim().length < 2) {
      toast.error("Informe nome e sobrenome.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("relatto-demo-signup", {
        body: { nome: nome.trim(), sobrenome: sobrenome.trim() },
      });
      if (error) throw error;
      const creds = data as { email?: string; senha?: string; error?: string };
      if (!creds?.email || !creds?.senha) throw new Error(creds?.error || "Falha ao criar demonstração");

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: creds.email,
        password: creds.senha,
      });
      if (signInError) throw signInError;

      window.localStorage.setItem("relatto_demo", "1");
      onOpenChange(false);
      toast.success(`Bem-vindo, ${nome.trim()}! Siga os 3 passos da demonstração.`);
      navigate("/consultor");
    } catch (err) {
      console.error("[demo]", err);
      toast.error("Não foi possível iniciar a demonstração. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Testar o Relatto</DialogTitle>
          <DialogDescription>
            Criamos uma conta de demonstração para você explorar o app. Os dados são apagados
            automaticamente em 24 horas.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={iniciarDemo} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="demo-nome">Nome</Label>
            <Input id="demo-nome" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="demo-sobrenome">Sobrenome</Label>
            <Input id="demo-sobrenome" value={sobrenome} onChange={(e) => setSobrenome(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Começar demonstração"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
