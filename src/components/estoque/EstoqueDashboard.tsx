import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Plus, Check, X, ArrowRightLeft } from "lucide-react";
import type { EstoqueRetiro, TransferenciaEstoque } from "@/hooks/useEstoqueData";
import AdicionarEstoqueModal from "./AdicionarEstoqueModal";

function diasColor(dias: number | null) {
  if (dias === null) return "text-muted-foreground";
  if (dias > 15) return "text-primary";
  if (dias >= 7) return "text-secondary";
  return "text-destructive";
}

function diasBadge(dias: number | null) {
  if (dias === null) return { label: "Sem dados", variant: "outline" as const };
  if (dias > 15) return { label: `${dias}d 🟢`, variant: "outline" as const };
  if (dias >= 7) return { label: `${dias}d 🟡`, variant: "secondary" as const };
  return { label: `${dias}d 🔴`, variant: "destructive" as const };
}

interface EstoqueDashboardProps {
  estoques: EstoqueRetiro[];
  transferencias: TransferenciaEstoque[];
  retiros: { id: string; nome: string }[];
  onAdicionarEstoque: (retiroId: string, quantidade: number) => Promise<void>;
  onAprovar: (id: string) => Promise<void>;
  onRecusar: (id: string) => Promise<void>;
  loading: boolean;
  hideTransferActions?: boolean;
}

export default function EstoqueDashboard({
  estoques, transferencias, retiros, onAdicionarEstoque, onAprovar, onRecusar, loading, hideTransferActions,
}: EstoqueDashboardProps) {
  const [addOpen, setAddOpen] = useState(false);

  const pendentes = transferencias.filter(t => t.status === 'pendente');
  const historico = transferencias.filter(t => t.status !== 'pendente').slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Package className="w-4 h-4" /> Estoque de Sal
        </h2>
        <Button size="sm" className="gap-1" onClick={() => setAddOpen(true)}>
          <Plus className="w-3 h-3" /> Adicionar
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
      ) : (
        <>
          {/* Estoque por retiro */}
          <div className="grid grid-cols-1 gap-3">
            {estoques.map(e => {
              const badge = diasBadge(e.dias_restantes);
              return (
                <Card key={e.retiro_id}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold text-sm text-foreground">{e.retiro_nome}</p>
                      <Badge variant={badge.variant} className="text-[10px]">{badge.label}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div>
                        <p className="text-muted-foreground">Estoque</p>
                        <p className="font-bold text-foreground">{e.quantidade_atual} sacos</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Consumo/dia</p>
                        <p className="font-bold text-secondary">{e.consumo_medio_diario.toFixed(1)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Dias rest.</p>
                        <p className={`font-bold ${diasColor(e.dias_restantes)}`}>
                          {e.dias_restantes !== null ? e.dias_restantes : '—'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Transferências pendentes */}
          {pendentes.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4" /> Transferências Pendentes
                <Badge variant="destructive" className="text-[10px] h-5">{pendentes.length}</Badge>
              </h3>
              <div className="space-y-2">
                {pendentes.map(t => (
                  <Card key={t.id}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {t.tipo_acao === 'solicitacao'
                              ? `${t.retiro_destino_nome} solicita ${t.quantidade} sacos de ${t.retiro_origem_nome}`
                              : `${t.retiro_origem_nome} deseja enviar ${t.quantidade} sacos para ${t.retiro_destino_nome}`
                            }
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(t.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-primary" onClick={() => onAprovar(t.id)}>
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-destructive" onClick={() => onRecusar(t.id)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Histórico */}
          {historico.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Histórico de Transferências
              </h3>
              <div className="space-y-1">
                {historico.map(t => (
                  <div key={t.id} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded border bg-card">
                    <Badge variant={t.status === 'aprovado' ? 'default' : 'destructive'} className="text-[10px] shrink-0">
                      {t.status === 'aprovado' ? '✅' : '❌'} {t.status}
                    </Badge>
                    <span className="truncate text-muted-foreground">
                      {t.retiro_origem_nome} → {t.retiro_destino_nome} ({t.quantidade} sacos)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <AdicionarEstoqueModal
        open={addOpen}
        onOpenChange={setAddOpen}
        retiros={retiros}
        onConfirm={onAdicionarEstoque}
      />
    </div>
  );
}
