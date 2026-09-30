import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Loader2 } from "lucide-react";

interface Props {
  retiroNome: string;
  contexto?: Record<string, unknown>;
}

export default function AnaliseIaRetiroCard({ retiroNome, contexto }: Props) {
  const { toast } = useToast();
  const [observacoes, setObservacoes] = useState("");
  const [analise, setAnalise] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const gerar = async () => {
    if (observacoes.trim().length < 10) {
      toast({ title: "Escreva um pouco mais", description: "Descreva o que observou no retiro.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setAnalise(null);
    try {
      const { data, error } = await supabase.functions.invoke("analisar-retiro", {
        body: { observacoes: observacoes.trim(), retiroNome, contexto },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setAnalise((data as any)?.analise ?? "");
    } catch (e: any) {
      toast({
        title: "Não foi possível gerar a análise",
        description: e?.message ?? "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-secondary" /> Observações e Análise
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <Textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={5}
          maxLength={4000}
          placeholder="Ex.: pastos do fundo com cocho vazio há 3 dias, lote da sede com aguada baixa, chuva forte na semana..."
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] text-muted-foreground">{observacoes.length}/4000</p>
          <Button size="sm" className="gap-1.5" onClick={gerar} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? "Analisando..." : "Gerar análise"}
          </Button>
        </div>

        {analise && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap leading-relaxed text-foreground">
            {analise}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
