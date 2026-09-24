/**
 * Gera (depois) o PDF de uma pesagem do Pecuarista já finalizada e sincronizada,
 * a partir dos dados do servidor. Usa o mesmo gerador `gerarPecuaristaLotePdf`
 * e o mesmo local de gravação da finalização normal.
 */
import { supabase } from "@/integrations/supabase/client";
import { gerarPecuaristaLotePdf, type PecuaristaPesoIdentificado, type PecuaristaPesoSemId } from "@/lib/pecuaristaPdf";
import { diasEntrePesagens, escolherPesoAnterior } from "@/lib/pecuaristaData";
import { dataLocalSP } from "@/lib/diasCalendario";
import { loadLinhasSem } from "@/lib/maisArrobasResume";

export async function gerarPdfPesagemPecuaristaHistorico(pesagemId: string, categoriaLabel: string): Promise<string> {
  const sb = supabase as any;
  const { data: p, error } = await sb.from("pesagens_lote_pecuarista")
    .select("id, lote_id, data_pesagem, hora_inicio, hora_fim, peso_total, peso_medio, quantidade_animais, gmd")
    .eq("id", pesagemId).maybeSingle();
  if (error || !p) throw new Error("Pesagem não encontrada no servidor.");
  const { data: lote } = await sb.from("lotes_pecuarista")
    .select("id, codigo, nome_lote, identificado, fazenda_id, pecuarista_id").eq("id", p.lote_id).maybeSingle();
  if (!lote) throw new Error("Lote não encontrado.");
  const [{ data: fz }, { data: pc }, { data: ls }] = await Promise.all([
    sb.from("fazendas_pecuarista").select("nome_fazenda, cidade, logo_url").eq("id", lote.fazenda_id).maybeSingle(),
    sb.from("pecuaristas").select("nome").eq("id", lote.pecuarista_id).maybeSingle(),
    sb.from("leituras_balancao_pecuarista").select("ordem, peso_total, quantidade_animais, peso_individual")
      .eq("pesagem_lote_id", pesagemId).order("ordem", { ascending: true }),
  ]);

  const dataPesagem: string = p.data_pesagem;
  const qtd = Number(p.quantidade_animais ?? 0);
  const peso_total = Number(p.peso_total ?? 0);
  const peso_medio = Number(p.peso_medio ?? (qtd ? peso_total / qtd : 0));

  let identificados: PecuaristaPesoIdentificado[] | undefined;
  let semId: PecuaristaPesoSemId[] | undefined;
  let mediaAnterior: number | null = null;
  let dataAnterior: string | null = null;
  let dias: number | null = null;

  if (lote.identificado) {
    const { data: pesos } = await sb.from("pesos_animais_pecuarista")
      .select("id, animal_id, peso_kg, gmd_individual, created_at").eq("pesagem_lote_id", pesagemId).order("created_at");
    const rows = (pesos ?? []) as any[];
    const animalIds = [...new Set(rows.map((r) => r.animal_id))];
    const numeros = new Map<string, string>();
    const historico = new Map<string, any[]>();
    if (animalIds.length) {
      const [{ data: an }, { data: hist }] = await Promise.all([
        sb.from("animais_pecuarista").select("id, numero").in("id", animalIds),
        sb.from("pesos_animais_pecuarista")
          .select("animal_id, peso_kg, created_at, pesagem_lote_id, pesagens_lote_pecuarista!inner(data_pesagem, lote_id, lotes_pecuarista!inner(nome_lote))")
          .in("animal_id", animalIds).neq("pesagem_lote_id", pesagemId).order("created_at", { ascending: false }),
      ]);
      for (const a of (an ?? []) as any[]) numeros.set(a.id, a.numero);
      for (const h of (hist ?? []) as any[]) {
        const arr = historico.get(h.animal_id) ?? [];
        arr.push(h);
        historico.set(h.animal_id, arr);
      }
    }
    identificados = rows.map((r) => {
      const prev: any = escolherPesoAnterior(historico.get(r.animal_id) ?? [], dataPesagem, pesagemId);
      const dataAnt = prev ? (prev.pesagens_lote_pecuarista?.data_pesagem ?? prev.created_at) : null;
      return {
        numero: numeros.get(r.animal_id) ?? "—",
        peso_kg: Number(r.peso_kg),
        data: dataPesagem,
        peso_anterior_kg: prev ? Number(prev.peso_kg) : null,
        data_anterior: dataAnt,
        lote_anterior: prev?.pesagens_lote_pecuarista?.lotes_pecuarista?.nome_lote ?? null,
        gmd_individual: r.gmd_individual != null ? Number(r.gmd_individual) : null,
        dias: dataAnt ? diasEntrePesagens(dataAnt, dataPesagem) : null,
      };
    });
  } else {
    const locais = loadLinhasSem<{ ordem: number; peso_kg: number }>(pesagemId);
    if (locais.length) semId = locais.map((l) => ({ ordem: Number(l.ordem), peso_kg: Number(l.peso_kg) }));
    const { data: ant } = await sb.from("pesagens_lote_pecuarista")
      .select("id, data_pesagem, peso_medio").eq("lote_id", lote.id).neq("id", pesagemId)
      .gt("quantidade_animais", 0).order("data_pesagem", { ascending: false }).limit(100);
    const diaAtual = dataLocalSP(dataPesagem);
    const a = ((ant as any[]) ?? []).find((x) => dataLocalSP(x.data_pesagem) < diaAtual);
    if (a) {
      mediaAnterior = Number(a.peso_medio);
      dataAnterior = a.data_pesagem;
      dias = diasEntrePesagens(a.data_pesagem, dataPesagem);
    }
  }

  const blob = await gerarPecuaristaLotePdf({
    header: {
      produtor: pc?.nome ?? "",
      nomeEmpresa: null,
      logoUrl: fz?.logo_url ?? null,
      fazenda: fz?.nome_fazenda ?? "",
      cidade: fz?.cidade ?? null,
      lote: lote.nome_lote, codigoLote: lote.codigo,
      categoria: categoriaLabel, identificado: !!lote.identificado,
      data: dataPesagem,
      horaInicio: p.hora_inicio ?? p.hora_fim ?? null,
      horaFim: p.hora_fim ?? null,
    },
    totais: {
      quantidade: qtd, peso_total, peso_medio,
      peso_medio_anterior: mediaAnterior, data_anterior: dataAnterior,
      dias, gmd: p.gmd != null ? Number(p.gmd) : null,
    },
    identificados,
    semId,
    leiturasBalancao: (ls ?? []).length ? (ls as any[]).map((l) => ({
      ordem: Number(l.ordem), peso_total: Number(l.peso_total),
      quantidade_animais: Number(l.quantidade_animais), peso_individual: Number(l.peso_individual),
    })) : undefined,
  });
  const path = `pecuarista/pesagens/${pesagemId}-${Date.now()}.pdf`;
  const { error: upErr } = await supabase.storage.from("relatorios")
    .upload(path, blob, { contentType: "application/pdf", upsert: true });
  if (upErr) throw new Error(upErr.message);
  const url = supabase.storage.from("relatorios").getPublicUrl(path).data.publicUrl;
  const { error: updErr } = await sb.from("pesagens_lote_pecuarista").update({ pdf_url: url }).eq("id", pesagemId);
  if (updErr) throw new Error(updErr.message);
  return url;
}
