import { useEffect, useState } from "react";
import { diasCalendarioSP } from "@/lib/diasCalendario";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ScanLine, Loader2, FileText, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import QrScanner from "@/components/capataz/QrScanner";
import ConferenciaResultado, { type DadosConferencia, type HistoricoEvento } from "@/components/conferencia/ConferenciaResultado";
import ConferenciaChecklist from "@/components/conferencia/ConferenciaChecklist";
import ConferenciaVisitaPastoForm, { type FotoExistente } from "@/components/conferencia/ConferenciaVisitaPastoForm";
import VisitaTopicosSection, { type Topico } from "@/components/consultor/VisitaTopicosSection";
import useNumeroMapFotos from "@/hooks/useNumeroMapFotos";
import { getCachedSignedUrl } from "@/lib/consultorOffline/signedUrlCache";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { syncPendingChecklists } from "@/lib/conferenciaOffline";
import {
  getOrCreateConferenciaVisita,
  findConferenciaAtiva,
  reabrirConferenciaSeFinalizada,
  listConferenciasHistorico,
  excluirConferencia,
  listConferenciaPastos,
  salvarPastoConferencia,
  atualizarPastoConferencia,
  excluirPastoConferencia,
  encerrarConferenciaVisita,
  type ConferenciaVisita,
  type ConferenciaPastoRegistro,
  type ConferenciaHistoricoItem,
} from "@/lib/conferenciaAdminVisita";
import { uploadVisitaPdf } from "@/lib/visitaPdf";
import { generateVisitaPdf, type VisitaPdfPasto } from "@/lib/visitaPdf";
import PdfViewerDialog from "@/components/consultor/PdfViewerDialog";
import ConferenciaAssinaturasSection, { type ConferenciaAssinante } from "@/components/conferencia/ConferenciaAssinaturasSection";

type Etapa = "inicio" | "scan" | "carregando" | "resultado" | "checklist" | "visita_form" | "editar_pasto";


function diasEntre(iso: string | null): number | null {
  if (!iso) return null;
  const dias = diasCalendarioSP(iso);
  if (dias === null) return null;
  return Math.max(0, dias);
}

function extractQrUuid(raw: string): string | null {
  const trimmed = raw.trim();
  // pode vir como UUID puro ou como URL contendo o UUID
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const match = trimmed.match(uuidRegex);
  return match ? match[0] : null;
}

const fmtSalgaInfo = (iso: string | null, sacos: number | null | undefined) => {
  if (!iso) return null;
  const d = new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `Última salga: ${d}${sacos != null ? ` — ${sacos} sacos` : ""}`;
};

export default function ConferenciaPage() {
  const navigate = useNavigate();
  const { user, role, roleData } = useAuth();
  const isAdmin = role === "administrador";
  const [etapa, setEtapa] = useState<Etapa>("inicio");
  const [dados, setDados] = useState<DadosConferencia | null>(null);
  const [visita, setVisita] = useState<ConferenciaVisita | null>(null);
  const [registros, setRegistros] = useState<ConferenciaPastoRegistro[]>([]);
  const [savingPasto, setSavingPasto] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [pdfGerado, setPdfGerado] = useState<{ url: string; fileName: string } | null>(null);
  const [pdfAberto, setPdfAberto] = useState(false);
  const [topicos, setTopicos] = useState<Topico[]>([]);
  const [editando, setEditando] = useState<ConferenciaPastoRegistro | null>(null);
  const [fotosEdicao, setFotosEdicao] = useState<FotoExistente[]>([]);
  const [confirmarExclusao, setConfirmarExclusao] = useState<ConferenciaPastoRegistro | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [assinantes, setAssinantes] = useState<ConferenciaAssinante[]>([]);
  const [adminNome, setAdminNome] = useState<string>("");
  const [fazendaIdConf, setFazendaIdConf] = useState<string | null>(null);

  const numeroMap = useNumeroMapFotos({
    visitaId: visita?.id,
    tipo: "rotina",
    topicos,
    itens: registros.map(r => ({ id: r.id, fotos: r.fotos.map(f => ({ id: f.id, ordem: f.ordem })) })),
  });

  const proximoNumeroFoto = Object.values(numeroMap).reduce((m, n) => Math.max(m, n), 0) + 1;

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("administradores").select("nome").eq("user_id", user.id).maybeSingle();
      if (!cancelled) setAdminNome(data?.nome || "");
    })();
    return () => { cancelled = true; };
  }, [user?.id]);



  useEffect(() => {
    // sincroniza checklists pendentes ao montar e ao reconectar
    void syncPendingChecklists();
    const onOnline = () => { void syncPendingChecklists(); };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  // Retoma (apenas leitura) a conferência formal já iniciada pelo Admin.
  // Nada é criado aqui: o modo padrão é verificação livre.
  useEffect(() => {
    if (!isAdmin || !roleData.roleId) return;
    let cancelled = false;
    (async () => {
      try {
        const v = await findConferenciaAtiva(roleData.roleId!);
        if (cancelled || !v) return;
        setVisita(v);
        setRegistros(await listConferenciaPastos(v.id));
      } catch { /* modo verificação livre segue disponível */ }
    })();
    return () => { cancelled = true; };
  }, [isAdmin, roleData.roleId]);

  const totalFotos = registros.reduce((acc, r) => acc + r.fotos.length, 0);

  /** Garante o registro formal da conferência (cria sob demanda). */
  const garantirVisita = async (): Promise<ConferenciaVisita> => {
    if (visita) return visita;
    if (!roleData.roleId) throw new Error("Perfil de administrador não identificado.");
    const v = await getOrCreateConferenciaVisita(roleData.roleId, fazendaIdConf, dados?.fazenda.nome ?? null);
    setVisita(v);
    setRegistros(await listConferenciaPastos(v.id));
    return v;
  };

  /** Editou algo depois do PDF? Invalida o PDF antigo e volta para revisão. */
  const invalidarPdf = async (v: ConferenciaVisita | null) => {
    const reaberta = await reabrirConferenciaSeFinalizada(v);
    if (reaberta && v) {
      setVisita({ ...v, status: "revisao", pdf_url: null });
      setPdfGerado(null);
    }
  };

  const handleSalvarPasto = async (observacao: string, fotosDataUrls: string[]) => {
    if (!dados) return;
    setSavingPasto(true);
    try {
      const v = await garantirVisita();
      await invalidarPdf(v);
      await salvarPastoConferencia({
        visitaId: v.id,
        pasto_id: dados.pasto.id,
        num_pasto: dados.pasto.nome,
        fazenda_nome: dados.fazenda.nome,
        retiro_nome: dados.retiro.nome,
        categoria: dados.categoria,
        sexo: dados.sexo,
        peso_medio_kg: dados.peso_medio_kg,
        qtd_animais: dados.num_animais,
        consumo_medio_g: dados.consumo_medio_g,
        ultima_salga: dados.ultima_salga_data,
        ultima_salga_sacos: dados.ultima_salga_sacos,
        observacao: observacao || null,
        fotosDataUrls,
      });
      if (dados.fazenda.id) setFazendaIdConf(dados.fazenda.id);
      setRegistros(await listConferenciaPastos(v.id));
      toast.success("Pasto registrado na visita.");
      setDados(null);
      setEtapa("inicio");

    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar o registro.");
    } finally {
      setSavingPasto(false);
    }
  };

  const abrirEdicao = async (r: ConferenciaPastoRegistro) => {
    setEditando(r);
    setFotosEdicao(r.fotos.map(f => ({ id: f.id, url: f.url })));
    setEtapa("editar_pasto");
    const comSrc = await Promise.all(
      [...r.fotos].sort((a, b) => a.ordem - b.ordem).map(async f => ({
        id: f.id, url: f.url, src: await getCachedSignedUrl(f.url).catch(() => undefined),
      })),
    );
    setFotosEdicao(comSrc);
  };

  const handleSalvarEdicao = async (values: {
    observacao: string; qtd_animais: number | null; peso_medio_kg: number | null;
    consumo_medio_g: number | null; novasFotos: string[]; fotosRemovidas: FotoExistente[];
  }) => {
    if (!editando || !visita) return;
    setSavingPasto(true);
    try {
      await atualizarPastoConferencia({
        registroId: editando.id,
        visitaId: visita.id,
        observacao: values.observacao || null,
        qtd_animais: values.qtd_animais,
        peso_medio_kg: values.peso_medio_kg,
        consumo_medio_g: values.consumo_medio_g,
        fotosRemovidas: values.fotosRemovidas.map(f => ({ id: f.id, url: f.url })),
        novasFotosDataUrls: values.novasFotos,
      });
      setRegistros(await listConferenciaPastos(visita.id));
      toast.success("Pasto atualizado.");
      setEditando(null);
      setFotosEdicao([]);
      setEtapa("inicio");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar as alterações.");
    } finally {
      setSavingPasto(false);
    }
  };

  const handleExcluirRegistro = async () => {
    if (!confirmarExclusao || !visita) return;
    setExcluindo(true);
    try {
      await excluirPastoConferencia(confirmarExclusao, visita.id);
      setRegistros(await listConferenciaPastos(visita.id));
      toast.success("Pasto removido da conferência.");
      setConfirmarExclusao(null);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível excluir o pasto.");
    } finally {
      setExcluindo(false);
    }
  };

  const handleEncerrarVisita = async () => {
    if (!visita || registros.length === 0) return;
    setGerandoPdf(true);
    try {

      const pastos: VisitaPdfPasto[] = registros.map(r => ({
        id: r.id,
        letra: r.letra,
        num_pasto: r.num_pasto,
        qtd_animais: r.qtd_animais,
        tipo_produto: null,
        percentual_pv: null,
        consumo_kg_dia: null,
        categoria: r.categoria,
        peso_medio_kg: r.peso_medio_kg,
        observacao: r.observacao,
        scores: {},
        fotos: r.fotos,
        fazenda_nome: r.fazenda_nome,
        retiro_nome: r.retiro_nome,
        sexo: r.sexo,
        ultima_salga: r.ultima_salga,
        ultima_salga_sacos: r.ultima_salga_sacos,
        consumo_medio_g: r.consumo_medio_g,
      }));

      const responsavelNome: string | null = adminNome || null;

      // Cabeçalho: fazenda, proprietário (administrador) e gerente.
      const fazendaNome = registros[0]?.fazenda_nome || "Conferência";
      let fazendaId = fazendaIdConf;
      if (!fazendaId && registros[0]?.fazenda_nome) {
        const { data: f } = await supabase
          .from("fazendas").select("id").eq("nome", registros[0].fazenda_nome).maybeSingle();
        fazendaId = f?.id ?? null;
      }
      let proprietario: string | null = null;
      let gerente: string | null = null;
      if (fazendaId) {
        const [{ data: faz }, { data: ger }] = await Promise.all([
          supabase.from("fazendas").select("administrador_id").eq("id", fazendaId).maybeSingle(),
          supabase.from("gerentes").select("nome").eq("fazenda_id", fazendaId).limit(1).maybeSingle(),
        ]);
        gerente = ger?.nome ?? null;
        if (faz?.administrador_id) {
          const { data: adm } = await supabase
            .from("administradores").select("nome").eq("id", faz.administrador_id).maybeSingle();
          proprietario = adm?.nome ?? null;
        }
      }

      const { blob, fileName } = await generateVisitaPdf({
        visitaId: visita.id,
        modo: "conferencia",
        fazenda: { nome_fazenda: fazendaNome, proprietario, gerente },
        consultor: { nome: responsavelNome || "Administrador" },
        hora_inicio: visita.hora_inicio,
        hora_fim: new Date().toISOString(),
        observacoes_gerais: null,
        conclusao: null,
        topicos: topicos.map(t => ({
          id: t.id,
          titulo: t.titulo,
          texto: t.texto,
          ordem: t.ordem,
          zona: t.zona,
          fotos: t.fotos.map(f => ({ id: f.id, url: f.url, ordem: f.ordem, signedUrl: t.signed?.[f.id] })),
        })),
        pastos,
        numeroMap,
        assinantes: assinantes
          .filter(a => (a.nome || "").trim())
          .map(a => ({ nome: a.nome, cargo_funcao: a.cargo_funcao })),
      });

      const url = URL.createObjectURL(blob);
      setPdfGerado({ url, fileName });

      await encerrarConferenciaVisita(visita.id, null);
      toast.success(`Visita encerrada. PDF gerado: ${fileName}`);
      setVisita(null);
      setRegistros([]);
      setTopicos([]);
      setAssinantes([]);
      setFazendaIdConf(null);


      if (roleData.roleId) {
        const nova = await getOrCreateConferenciaVisita(roleData.roleId, null, null);
        setVisita(nova);
      }
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível gerar o PDF.");
    } finally {
      setGerandoPdf(false);
    }
  };


  const handleScan = async (raw: string) => {
    const qrUuid = extractQrUuid(raw);
    if (!qrUuid) {
      toast.error("QR Code não encontrado ou inativo.");
      setEtapa("inicio");
      return;
    }
    setEtapa("carregando");

    try {
      // 1) pasto + retiro + fazenda + produto
      const { data: pasto, error: pErr } = await supabase
        .from("pastos")
        .select(`
          id, nome, qr_uuid, num_animais, peso_medio_kg, categoria, sexo, ativo,
          retiro:retiros!inner(
            id, nome, fazenda_id, produto_id,
            fazenda:fazendas(id, nome),
            produto:produtos(id, nome)
          ),
          produto:produtos(id, nome)
        `)
        .eq("qr_uuid", qrUuid)
        .maybeSingle();

      if (pErr || !pasto || !pasto.ativo) {
        toast.error("QR Code não encontrado ou inativo.");
        setEtapa("inicio");
        return;
      }

      const retiro = (pasto as any).retiro;
      const fazenda = retiro?.fazenda;
      const produtoNome = (pasto as any).produto?.nome ?? retiro?.produto?.nome ?? null;

      // 2) auditoria automática (não bloqueia)
      const recordAudit = async (lat: number | null, lng: number | null) => {
        if (!user) return;
        try {
          await supabase.from("audit_conferencias").insert({
            fazenda_id: fazenda?.id ?? null,
            retiro_id: retiro?.id ?? null,
            pasto_id: pasto.id,
            user_id: user.id,
            perfil: role ?? null,
            qr_code: qrUuid,
            latitude: lat,
            longitude: lng,
          });
        } catch { /* silencioso */ }
      };

      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => void recordAudit(pos.coords.latitude, pos.coords.longitude),
          () => void recordAudit(null, null),
          { timeout: 4000, maximumAge: 60000 }
        );
      } else {
        void recordAudit(null, null);
      }

      // 3) último lançamento (salga) do pasto
      const { data: ultLanc } = await supabase
        .from("lancamentos")
        .select("data_salga_informada, created_at, criado_por, mes_referencia, ano_referencia, num_sacos")
        .eq("pasto_id", pasto.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // 3b) consumo/status — fonte única: view_painel_mae_pasto_atual (Consumo Global, sem filtro de mês)
      const { data: maePasto } = await supabase
        .from("view_painel_mae_pasto_atual")
        .select("consumo_global_g_cab_dia, status_global")
        .eq("pasto_id", pasto.id)
        .maybeSingle();


      // 4) responsável (nome) da última salga
      // Ordem de resolução: 1) capataz por user_id; 2) gerente/admin por user_id;
      // 3) capataz do retiro; 4) campo texto retiros.capataz. Nunca exibir e-mail.
      let respNome: string | null = null;
      if (ultLanc?.criado_por) {
        const { data: c } = await supabase.from("capatazes").select("nome").eq("user_id", ultLanc.criado_por).maybeSingle();
        if (c?.nome) respNome = c.nome;
        if (!respNome) {
          const { data: g } = await supabase.from("gerentes").select("nome").eq("user_id", ultLanc.criado_por).maybeSingle();
          if (g?.nome) respNome = g.nome;
        }
        if (!respNome) {
          const { data: a } = await supabase.from("administradores").select("nome").eq("user_id", ultLanc.criado_por).maybeSingle();
          if (a?.nome) respNome = a.nome;
        }
      }
      if (!respNome && retiro?.id) {
        const { data: cRet } = await supabase.from("capatazes").select("nome").eq("retiro_id", retiro.id).maybeSingle();
        if (cRet?.nome) {
          respNome = cRet.nome;
        } else {
          const { data: r } = await supabase.from("retiros").select("capataz").eq("id", retiro.id).maybeSingle();
          if (r?.capataz && !r.capataz.includes("@")) respNome = r.capataz;
        }
      }
      if (!respNome || respNome.includes("@")) respNome = null;

      // 5) últimas movimentações
      const { data: ultMov } = await supabase
        .from("movimentacoes_animais")
        .select("data")
        .or(`pasto_origem_id.eq.${pasto.id},pasto_destino_id.eq.${pasto.id}`)
        .order("data", { ascending: false })
        .limit(1)
        .maybeSingle();

      // 6) eventos do mês corrente
      const hoje = new Date();
      const mes = hoje.getMonth() + 1;
      const ano = hoje.getFullYear();
      const inicioMes = new Date(ano, mes - 1, 1).toISOString();

      const [{ count: nLanc }, { count: nMort }, { count: nMov }] = await Promise.all([
        supabase.from("lancamentos").select("id", { count: "exact", head: true }).eq("pasto_id", pasto.id).eq("mes_referencia", mes).eq("ano_referencia", ano),
        supabase.from("mortalidades").select("id", { count: "exact", head: true }).eq("pasto_id", pasto.id).eq("mes", mes).eq("ano", ano),
        supabase.from("movimentacoes_animais").select("id", { count: "exact", head: true }).or(`pasto_origem_id.eq.${pasto.id},pasto_destino_id.eq.${pasto.id}`).gte("data", inicioMes),
      ]);
      const eventosMes = (nLanc ?? 0) + (nMort ?? 0) + (nMov ?? 0);

      // 7) histórico rápido (5 últimos eventos combinados)
      const [lancHist, mortHist, movHist] = await Promise.all([
        supabase.from("lancamentos").select("created_at, num_sacos, data_salga_informada, cocho_cheio").eq("pasto_id", pasto.id).order("created_at", { ascending: false }).limit(5),
        supabase.from("mortalidades").select("created_at, data, quantidade").eq("pasto_id", pasto.id).order("created_at", { ascending: false }).limit(5),
        supabase.from("movimentacoes_animais").select("created_at, data, quantidade, pasto_origem_id, pasto_destino_id").or(`pasto_origem_id.eq.${pasto.id},pasto_destino_id.eq.${pasto.id}`).order("created_at", { ascending: false }).limit(5),
      ]);

      const historico: HistoricoEvento[] = [];
      lancHist.data?.forEach((l: any) => historico.push({
        tipo: "salga",
        data: l.data_salga_informada ?? l.created_at,
        descricao: l.cocho_cheio ? "C (cheio)" : `${l.num_sacos ?? 0} saco(s)`,
      }));
      mortHist.data?.forEach((m: any) => historico.push({
        tipo: "morte",
        data: m.data ?? m.created_at,
        descricao: `${m.quantidade} animal(is)`,
      }));
      movHist.data?.forEach((mv: any) => historico.push({
        tipo: mv.pasto_origem_id === pasto.id ? "movimentacao" : "transferencia",
        data: mv.data ?? mv.created_at,
        descricao: `${mv.quantidade} animal(is)`,
      }));
      historico.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
      const top5 = historico.slice(0, 5);

      const ultSalgaData = ultLanc?.data_salga_informada ?? ultLanc?.created_at ?? null;

      const dadosFinais: DadosConferencia = {
        fazenda: { id: fazenda?.id ?? null, nome: fazenda?.nome ?? "—" },
        retiro: { id: retiro?.id ?? null, nome: retiro?.nome ?? "—" },
        pasto: { id: pasto.id, nome: pasto.nome, qr_uuid: pasto.qr_uuid },
        num_animais: pasto.num_animais ?? 0,
        peso_medio_kg: pasto.peso_medio_kg ?? null,
        categoria: pasto.categoria ?? null,
        sexo: pasto.sexo ?? null,
        produto_nome: produtoNome,
        consumo_medio_g: maePasto?.consumo_global_g_cab_dia != null ? Number(maePasto.consumo_global_g_cab_dia) : null,
        status_consumo: maePasto?.status_global ?? null,
        ultima_salga_data: ultSalgaData,
        ultima_salga_sacos: ultLanc?.num_sacos ?? null,
        ultima_salga_responsavel: respNome,
        ultima_movimentacao_data: ultMov?.data ?? null,
        dias_desde_salga: diasEntre(ultSalgaData),
        dias_desde_movimentacao: diasEntre(ultMov?.data ?? null),
        eventos_mes: eventosMes,
        historico: top5,
      };

      setDados(dadosFinais);
      setEtapa("resultado");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao consultar dados do pasto.");
      setEtapa("inicio");
    }
  };

  if (etapa === "scan") {
    return (
      <QrScanner
        onScan={handleScan}
        onBack={() => setEtapa("inicio")}
        onManualSelect={() => setEtapa("inicio")}
      />
    );
  }

  if (etapa === "carregando") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Consultando dados do pasto...</p>
        </div>
      </div>
    );
  }

  if (etapa === "resultado" && dados) {
    return (
      <ConferenciaResultado
        dados={dados}
        onVoltar={() => { setDados(null); setEtapa("inicio"); }}
        onRegistrarConferencia={() => setEtapa(isAdmin ? "visita_form" : "checklist")}
      />
    );
  }

  if (etapa === "visita_form" && dados) {
    return (
      <ConferenciaVisitaPastoForm
        titulo={`Registrar ${dados.pasto.nome}`}
        subtitulo={`${dados.retiro.nome} • ${dados.fazenda.nome}`}
        infoUltimaSalga={fmtSalgaInfo(dados.ultima_salga_data, dados.ultima_salga_sacos)}
        numeroInicial={proximoNumeroFoto}
        saving={savingPasto}
        onBack={() => setEtapa("resultado")}
        onSalvar={(v) => void handleSalvarPasto(v.observacao, v.novasFotos)}
      />
    );
  }

  if (etapa === "editar_pasto" && editando) {
    return (
      <ConferenciaVisitaPastoForm
        titulo={`Editar ${editando.num_pasto || editando.letra}`}
        subtitulo={`${editando.retiro_nome || "—"} • ${editando.fazenda_nome || "—"}`}
        infoUltimaSalga={fmtSalgaInfo(editando.ultima_salga, editando.ultima_salga_sacos)}
        numeroInicial={proximoNumeroFoto}
        numerosExistentes={fotosEdicao.map(f => numeroMap[f.id])}
        saving={savingPasto}
        edicao
        initial={{
          observacao: editando.observacao,
          qtd_animais: editando.qtd_animais,
          peso_medio_kg: editando.peso_medio_kg,
          consumo_medio_g: editando.consumo_medio_g,
          fotos: fotosEdicao,
        }}
        onBack={() => { setEditando(null); setFotosEdicao([]); setEtapa("inicio"); }}
        onSalvar={(v) => void handleSalvarEdicao(v)}
      />
    );
  }


  if (etapa === "checklist" && dados && user) {
    return (
      <ConferenciaChecklist
        dados={dados}
        userId={user.id}
        perfil={role ?? ""}
        onBack={() => setEtapa("resultado")}
        onSaved={() => { setDados(null); setEtapa("inicio"); }}
      />
    );
  }


  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-primary-foreground hover:bg-primary/80">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-bold">Conferência</h1>
      </header>

      <main className="flex-1 flex flex-col items-center px-6 py-6 gap-6 text-center max-w-md mx-auto w-full">
        <div className="w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center">
          <ScanLine className="w-12 h-12 text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Conferência via QR Code</h2>
          <p className="text-sm text-muted-foreground">
            Aponte a câmera para o QR do pasto e consulte instantaneamente a situação atual do lote e da mineralização.
          </p>
        </div>
        <Button size="lg" onClick={() => setEtapa("scan")} className="w-full gap-2">
          <ScanLine className="w-5 h-5" />
          INICIAR CONFERÊNCIA
        </Button>

        {isAdmin && registros.length > 0 && (
          <div className="w-full space-y-2 border-t pt-4 text-left">
            <p className="text-xs uppercase tracking-wide font-bold text-primary">
              Pastos registrados ({registros.length})
            </p>
            {registros.map(r => (
              <div key={r.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm shrink-0">
                  {r.letra}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{r.num_pasto || "Pasto"}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {[r.retiro_nome, r.fazenda_nome].filter(Boolean).join(" • ") || "—"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {r.qtd_animais ?? 0} animais · {r.fotos.length} foto(s)
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Editar pasto"
                  onClick={() => void abrirEdicao(r)}
                  className="p-2 rounded hover:bg-muted"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label="Excluir pasto"
                  onClick={() => setConfirmarExclusao(r)}
                  className="p-2 rounded hover:bg-destructive/10 text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {isAdmin && visita && (
          <div className="w-full border-t pt-4 text-left">
            <p className="text-xs uppercase tracking-wide font-bold text-primary mb-2">Tópicos do relatório</p>
            <VisitaTopicosSection
              visitaId={visita.id}
              onChange={setTopicos}
              numeroMap={numeroMap}
            />
          </div>
        )}

        {isAdmin && visita && (
          <div className="w-full border-t pt-4 text-left">
            <ConferenciaAssinaturasSection
              visitaId={visita.id}
              nomePadrao={adminNome}
              onChange={setAssinantes}
            />
          </div>
        )}

        {isAdmin && registros.length > 0 && (
          <div className="w-full space-y-2 border-t pt-4">
            <p className="text-sm text-muted-foreground">
              Visita em andamento: {registros.length} pasto(s), {totalFotos} foto(s).
            </p>
            <Button
              size="lg"
              variant="secondary"
              className="w-full gap-2"
              disabled={gerandoPdf}
              onClick={() => void handleEncerrarVisita()}
            >
              {gerandoPdf ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
              ENCERRAR VISITA E GERAR PDF
            </Button>
          </div>
        )}

        <AlertDialog open={!!confirmarExclusao} onOpenChange={(o) => { if (!o) setConfirmarExclusao(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
              <AlertDialogDescription>
                Essa ação não pode ser desfeita. O pasto {confirmarExclusao?.num_pasto || ""} e suas fotos serão
                removidos desta conferência.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={excluindo}
                onClick={(e) => { e.preventDefault(); void handleExcluirRegistro(); }}
              >
                {excluindo ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>


        {isAdmin && pdfGerado && (
          <div className="w-full space-y-2 border-t pt-4">
            <p className="text-sm text-muted-foreground">
              PDF gerado: {pdfGerado.fileName}
            </p>
            <Button size="lg" className="w-full gap-2" onClick={() => setPdfAberto(true)}>
              <FileText className="w-5 h-5" />
              ABRIR PDF
            </Button>
          </div>
        )}

        <PdfViewerDialog
          url={pdfAberto && pdfGerado ? pdfGerado.url : null}
          fileName={pdfGerado?.fileName}
          title="Visita de Rotina"
          onClose={() => setPdfAberto(false)}
        />



      </main>
    </div>
  );
}
