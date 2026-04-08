import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EstoqueRetiro {
  id: string;
  retiro_id: string;
  retiro_nome: string;
  mes: number;
  ano: number;
  quantidade_atual: number;
  ultimo_alerta_estoque: string | null;
  consumo_medio_diario: number;
  dias_restantes: number | null;
}

export interface TransferenciaEstoque {
  id: string;
  retiro_origem_id: string;
  retiro_origem_nome: string;
  retiro_destino_id: string;
  retiro_destino_nome: string;
  quantidade: number;
  status: string;
  tipo_acao: string;
  solicitado_por: string | null;
  created_at: string;
}

export interface MovimentacaoEstoque {
  id: string;
  retiro_id: string;
  mes: number;
  ano: number;
  tipo: string;
  quantidade: number;
  origem: string;
  created_at: string;
}

export function useEstoqueData(fazendaId: string | null | undefined, mes: number, ano: number) {
  const [estoques, setEstoques] = useState<EstoqueRetiro[]>([]);
  const [transferencias, setTransferencias] = useState<TransferenciaEstoque[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!fazendaId) return;
    setLoading(true);

    try {
      // Get retiros da fazenda
      const { data: retiros } = await supabase
        .from("retiros")
        .select("id, nome")
        .eq("fazenda_id", fazendaId)
        .eq("ativo", true);

      if (!retiros || retiros.length === 0) {
        setEstoques([]);
        setTransferencias([]);
        setLoading(false);
        return;
      }

      const retiroIds = retiros.map(r => r.id);
      const retiroMap = new Map(retiros.map(r => [r.id, r.nome]));

      // Get estoque for current period
      const { data: estoqueData } = await supabase
        .from("estoque_retiro")
        .select("*")
        .in("retiro_id", retiroIds)
        .eq("mes", mes)
        .eq("ano", ano);

      // Get lancamentos últimos 30 dias para consumo médio
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: lancamentos } = await supabase
        .from("lancamentos")
        .select("retiro_id, num_sacos")
        .in("retiro_id", retiroIds)
        .gte("created_at", thirtyDaysAgo.toISOString());

      // Calcular consumo médio por retiro
      const consumoPorRetiro: Record<string, number> = {};
      lancamentos?.forEach(l => {
        consumoPorRetiro[l.retiro_id] = (consumoPorRetiro[l.retiro_id] || 0) + l.num_sacos;
      });

      const estoqueList: EstoqueRetiro[] = retiros.map(r => {
        const est = estoqueData?.find(e => e.retiro_id === r.id);
        const totalSacos30d = consumoPorRetiro[r.id] || 0;
        const consumoMedioDiario = totalSacos30d / 30;
        const qtdAtual = est?.quantidade_atual ?? 0;
        const diasRestantes = consumoMedioDiario > 0 ? Math.floor(qtdAtual / consumoMedioDiario) : null;

        return {
          id: est?.id || '',
          retiro_id: r.id,
          retiro_nome: r.nome,
          mes,
          ano,
          quantidade_atual: qtdAtual,
          ultimo_alerta_estoque: est?.ultimo_alerta_estoque || null,
          consumo_medio_diario: Math.round(consumoMedioDiario * 10) / 10,
          dias_restantes: diasRestantes,
        };
      });

      setEstoques(estoqueList);

      // Get transferencias pendentes
      const { data: transfData } = await supabase
        .from("transferencias_estoque")
        .select("*")
        .or(`retiro_origem_id.in.(${retiroIds.join(',')}),retiro_destino_id.in.(${retiroIds.join(',')})`)
        .order("created_at", { ascending: false })
        .limit(50);

      const transfList: TransferenciaEstoque[] = (transfData || []).map(t => ({
        id: t.id,
        retiro_origem_id: t.retiro_origem_id,
        retiro_origem_nome: retiroMap.get(t.retiro_origem_id) || 'Desconhecido',
        retiro_destino_id: t.retiro_destino_id,
        retiro_destino_nome: retiroMap.get(t.retiro_destino_id) || 'Desconhecido',
        quantidade: t.quantidade,
        status: t.status,
        tipo_acao: t.tipo_acao,
        solicitado_por: t.solicitado_por,
        created_at: t.created_at,
      }));

      setTransferencias(transfList);
    } catch (err) {
      console.error("Erro ao carregar estoque:", err);
    } finally {
      setLoading(false);
    }
  }, [fazendaId, mes, ano]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const adicionarEstoque = async (retiroId: string, quantidade: number) => {
    if (!fazendaId) return;

    // Upsert estoque
    const { data: existing } = await supabase
      .from("estoque_retiro")
      .select("id, quantidade_atual")
      .eq("retiro_id", retiroId)
      .eq("mes", mes)
      .eq("ano", ano)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("estoque_retiro")
        .update({ quantidade_atual: existing.quantidade_atual + quantidade, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("estoque_retiro")
        .insert({ retiro_id: retiroId, mes, ano, quantidade_atual: quantidade });
    }

    // Registrar movimentação
    await supabase
      .from("movimentacoes_estoque")
      .insert({ retiro_id: retiroId, mes, ano, tipo: 'entrada', quantidade, origem: 'compra' });

    toast.success(`${quantidade} sacos adicionados ao estoque`);
    await refresh();
  };

  const aprovarTransferencia = async (transferenciaId: string) => {
    const transf = transferencias.find(t => t.id === transferenciaId);
    if (!transf) return;

    // Validar estoque na origem
    const { data: estoqueOrigem } = await supabase
      .from("estoque_retiro")
      .select("id, quantidade_atual")
      .eq("retiro_id", transf.retiro_origem_id)
      .eq("mes", mes)
      .eq("ano", ano)
      .maybeSingle();

    if (!estoqueOrigem || estoqueOrigem.quantidade_atual < transf.quantidade) {
      toast.error("Estoque insuficiente no retiro de origem");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    // Subtrair da origem
    await supabase
      .from("estoque_retiro")
      .update({
        quantidade_atual: estoqueOrigem.quantidade_atual - transf.quantidade,
        updated_at: new Date().toISOString()
      })
      .eq("id", estoqueOrigem.id);

    // Somar no destino (upsert)
    const { data: estoqueDestino } = await supabase
      .from("estoque_retiro")
      .select("id, quantidade_atual")
      .eq("retiro_id", transf.retiro_destino_id)
      .eq("mes", mes)
      .eq("ano", ano)
      .maybeSingle();

    if (estoqueDestino) {
      await supabase
        .from("estoque_retiro")
        .update({
          quantidade_atual: estoqueDestino.quantidade_atual + transf.quantidade,
          updated_at: new Date().toISOString()
        })
        .eq("id", estoqueDestino.id);
    } else {
      await supabase
        .from("estoque_retiro")
        .insert({ retiro_id: transf.retiro_destino_id, mes, ano, quantidade_atual: transf.quantidade });
    }

    // Movimentações
    await supabase.from("movimentacoes_estoque").insert([
      { retiro_id: transf.retiro_origem_id, mes, ano, tipo: 'transferencia_envio', quantidade: transf.quantidade, origem: 'transferencia', referencia_id: transf.id },
      { retiro_id: transf.retiro_destino_id, mes, ano, tipo: 'transferencia_recebimento', quantidade: transf.quantidade, origem: 'transferencia', referencia_id: transf.id },
    ]);

    // Atualizar status
    await supabase
      .from("transferencias_estoque")
      .update({ status: 'aprovado', aprovado_por: user?.id, updated_at: new Date().toISOString() })
      .eq("id", transferenciaId);

    toast.success("Transferência aprovada!");
    await refresh();
  };

  const recusarTransferencia = async (transferenciaId: string) => {
    const { data: { user } } = await supabase.auth.getUser();

    await supabase
      .from("transferencias_estoque")
      .update({ status: 'recusado', aprovado_por: user?.id, updated_at: new Date().toISOString() })
      .eq("id", transferenciaId);

    toast.success("Transferência recusada");
    await refresh();
  };

  return {
    estoques,
    transferencias,
    loading,
    refresh,
    adicionarEstoque,
    aprovarTransferencia,
    recusarTransferencia,
  };
}
