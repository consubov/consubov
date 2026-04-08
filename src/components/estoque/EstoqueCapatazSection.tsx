import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, ArrowRightLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SolicitarSalModal from "./SolicitarSalModal";

interface EstoqueCapatazSectionProps {
  retiroId: string;
  fazendaId: string;
}

export default function EstoqueCapatazSection({ retiroId, fazendaId }: EstoqueCapatazSectionProps) {
  const [estoqueAtual, setEstoqueAtual] = useState<number>(0);
  const [outrosRetiros, setOutrosRetiros] = useState<{ id: string; nome: string }[]>([]);
  const [transferencias, setTransferencias] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const mes = now.getMonth() + 1;
  const ano = now.getFullYear();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // Estoque atual
      const { data: estoque } = await supabase
        .from("estoque_retiro")
        .select("quantidade_atual")
        .eq("retiro_id", retiroId)
        .eq("mes", mes)
        .eq("ano", ano)
        .maybeSingle();

      setEstoqueAtual(estoque?.quantidade_atual ?? 0);

      // Outros retiros da fazenda
      const { data: retiros } = await supabase
        .from("retiros")
        .select("id, nome")
        .eq("fazenda_id", fazendaId)
        .eq("ativo", true)
        .neq("id", retiroId);

      setOutrosRetiros(retiros || []);

      // Minhas transferências
      const { data: transf } = await supabase
        .from("transferencias_estoque")
        .select("*")
        .or(`retiro_origem_id.eq.${retiroId},retiro_destino_id.eq.${retiroId}`)
        .order("created_at", { ascending: false })
        .limit(10);

      setTransferencias(transf || []);
    } catch {
      // offline
    } finally {
      setLoading(false);
    }
  }, [retiroId, fazendaId, mes, ano]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading) return null;

  return (
    <div className="space-y-3">
      {/* Estoque atual */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Estoque de sal</p>
              <p className="text-lg font-bold text-primary">{estoqueAtual} sacos</p>
            </div>
          </div>
          {outrosRetiros.length > 0 && (
            <Button size="sm" variant="outline" className="gap-1" onClick={() => setModalOpen(true)}>
              <ArrowRightLeft className="w-3 h-3" />
              Solicitar / Enviar
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Transferências recentes */}
      {transferencias.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Transferências</p>
          <div className="space-y-1">
            {transferencias.slice(0, 5).map(t => (
              <div key={t.id} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded border bg-card">
                <Badge
                  variant={t.status === 'aprovado' ? 'default' : t.status === 'recusado' ? 'destructive' : 'secondary'}
                  className="text-[10px] shrink-0"
                >
                  {t.status === 'pendente' ? '⏳' : t.status === 'aprovado' ? '✅' : '❌'} {t.status}
                </Badge>
                <span className="text-muted-foreground truncate">
                  {t.quantidade} sacos · {t.tipo_acao === 'solicitacao' ? 'Solicitação' : 'Envio'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <SolicitarSalModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        meuRetiroId={retiroId}
        outrosRetiros={outrosRetiros}
        onSuccess={refresh}
      />
    </div>
  );
}
