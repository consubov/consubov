import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ScanLine, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import QrScanner from "@/components/capataz/QrScanner";
import ConferenciaResultado, { type DadosConferencia, type HistoricoEvento } from "@/components/conferencia/ConferenciaResultado";
import ConferenciaChecklist from "@/components/conferencia/ConferenciaChecklist";
import ConferenciaVisitaPastoForm from "@/components/conferencia/ConferenciaVisitaPastoForm";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { syncPendingChecklists } from "@/lib/conferenciaOffline";
import {
  getOrCreateConferenciaVisita,
  listConferenciaPastos,
  salvarPastoConferencia,
  encerrarConferenciaVisita,
  numeroMapConferencia,
  type ConferenciaVisita,
  type ConferenciaPastoRegistro,
} from "@/lib/conferenciaAdminVisita";
import { generateVisitaPdf, type VisitaPdfPasto } from "@/lib/visitaPdf";

type Etapa = "inicio" | "scan" | "carregando" | "resultado" | "checklist" | "visita_form";

function diasEntre(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function extractQrUuid(raw: string): string | null {
  const trimmed = raw.trim();
  // pode vir como UUID puro ou como URL contendo o UUID
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const match = trimmed.match(uuidRegex);
  return match ? match[0] : null;
}

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

  useEffect(() => {
    // sincroniza checklists pendentes ao montar e ao reconectar
    void syncPendingChecklists();
    const onOnline = () => { void syncPendingChecklists(); };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  // Retoma visita de conferência em andamento do Admin
  useEffect(() => {
    if (!isAdmin || !roleData.roleId) return;
    let cancelled = false;
    (async () => {
      try {
        const v = await getOrCreateConferenciaVisita(roleData.roleId!, null, null);
        if (cancelled) return;
        setVisita(v);
        setRegistros(await listConferenciaPastos(v.id));
      } catch { /* silencioso */ }
    })();
    return () => { cancelled = true; };
  }, [isAdmin, roleData.roleId]);

  const totalFotos = registros.reduce((acc, r) => acc + r.fotos.length, 0);

  const handleSalvarPasto = async (observacao: string, fotosDataUrls: string[]) => {
    if (!visita || !dados) return;
    setSavingPasto(true);
    try {
      await salvarPastoConferencia({
        visitaId: visita.id,
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
        observacao: observacao || null,
        fotosDataUrls,
      });
      setRegistros(await listConferenciaPastos(visita.id));
      toast.success("Pasto registrado na visita.");
      setDados(null);
      setEtapa("inicio");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar o registro.");
    } finally {
      setSavingPasto(false);
    }
  };

  const handleEncerrarVisita = async () => {
    if (!visita || registros.length === 0) return;
    setGerandoPdf(true);
    try {
      const numeroMap = numeroMapConferencia(registros);
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
        consumo_medio_g: r.consumo_medio_g,
      }));

      const { blob, fileName } = await generateVisitaPdf({
        visitaId: visita.id,
        modo: "conferencia",
        fazenda: { nome_fazenda: registros[0]?.fazenda_nome || "Conferência" },
        consultor: { nome: user?.email || "Administrador" },
        hora_inicio: visita.hora_inicio,
        hora_fim: new Date().toISOString(),
        observacoes_gerais: null,
        conclusao: null,
        pastos,
        numeroMap,
      });

      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);

      await encerrarConferenciaVisita(visita.id, null);
      toast.success(`Visita encerrada. PDF gerado: ${fileName}`);
      setVisita(null);
      setRegistros([]);
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
        .select("data_salga_informada, created_at, consumo_g_cab_dia, status_consumo, criado_por, mes_referencia, ano_referencia")
        .eq("pasto_id", pasto.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // 4) responsável (nome) da última salga
      let respNome: string | null = null;
      if (ultLanc?.criado_por) {
        const { data: g } = await supabase.from("gerentes").select("nome").eq("user_id", ultLanc.criado_por).maybeSingle();
        if (g?.nome) respNome = g.nome;
        if (!respNome) {
          const { data: a } = await supabase.from("administradores").select("nome").eq("user_id", ultLanc.criado_por).maybeSingle();
          respNome = a?.nome ?? null;
        }
      }

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
        supabase.from("lancamentos").select("created_at, num_sacos, data_salga_informada").eq("pasto_id", pasto.id).order("created_at", { ascending: false }).limit(5),
        supabase.from("mortalidades").select("created_at, data, quantidade").eq("pasto_id", pasto.id).order("created_at", { ascending: false }).limit(5),
        supabase.from("movimentacoes_animais").select("created_at, data, quantidade, pasto_origem_id, pasto_destino_id").or(`pasto_origem_id.eq.${pasto.id},pasto_destino_id.eq.${pasto.id}`).order("created_at", { ascending: false }).limit(5),
      ]);

      const historico: HistoricoEvento[] = [];
      lancHist.data?.forEach((l: any) => historico.push({
        tipo: "salga",
        data: l.data_salga_informada ?? l.created_at,
        descricao: `${l.num_sacos ?? 0} saco(s)`,
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
        consumo_medio_g: ultLanc?.consumo_g_cab_dia ?? null,
        status_consumo: ultLanc?.status_consumo ?? null,
        ultima_salga_data: ultSalgaData,
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
        onRegistrarConferencia={() => setEtapa("checklist")}
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

      <main className="flex-1 flex flex-col items-center justify-center px-6 gap-6 text-center max-w-md mx-auto">
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
      </main>
    </div>
  );
}
