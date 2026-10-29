import { downloadGeneratedPdf, withReportExportDeadline } from "@/lib/reportPdfExport";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Loader2, FileDown, CheckCircle2, Trash2 } from "lucide-react";
import { gerarManejoPDF } from "@/lib/syncvetManejoPdf";

type Resultado = "prenha" | "vazia" | "realizado";

type Registro = {
  animal_id: string;
  numero: string;
  resultado: Resultado;
};

type Manejo = {
  id: string;
  tipo_manejo: string | null;
  fazenda_id: string | null;
  lote_id: string | null;
  responsavel_id: string | null;
  data_prevista: string;
  status: string;
  observacoes: string | null;
  protocolo_id: string | null;
  semen_id: string | null;
  semen_descricao_fazenda: string | null;
};

export default function SyncVetManejoExecucaoPage() {
  const { manejoId } = useParams<{ manejoId: string }>();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [manejo, setManejo] = useState<Manejo | null>(null);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [numero, setNumero] = useState("");
  const [fazendaNome, setFazendaNome] = useState("");
  const [loteNome, setLoteNome] = useState("");
  const [responsavelNome, setResponsavelNome] = useState("");
  const [empresaNome, setEmpresaNome] = useState("");
  const [protocoloNome, setProtocoloNome] = useState("");
  const [semenNome, setSemenNome] = useState("");
  const [obsFinais, setObsFinais] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const tipo = (manejo?.tipo_manejo as "dg_us" | "iatf" | "retirada") ?? "dg_us";
  const isDG = tipo === "dg_us";

  useEffect(() => {
    (async () => {
      if (!manejoId) return;
      setLoading(true);
      const { data: m, error } = await (supabase as any)
        .from("syncvet_manejos")
        .select("*")
        .eq("id", manejoId)
        .maybeSingle();
      if (error || !m) { toast.error(error?.message ?? "Manejo não encontrado"); setLoading(false); return; }
      setManejo(m as Manejo);
      setObsFinais((m as Manejo).observacoes ?? "");

      const [{ data: f }, { data: l }, { data: r }] = await Promise.all([
        supabase.from("syncvet_fazendas").select("nome, empresa_id").eq("id", m.fazenda_id).maybeSingle(),
        supabase.from("syncvet_lotes").select("nome").eq("id", m.lote_id).maybeSingle(),
        m.responsavel_id
          ? supabase.from("syncvet_equipe").select("nome").eq("id", m.responsavel_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      setFazendaNome((f as any)?.nome ?? "");
      setLoteNome((l as any)?.nome ?? "");
      setResponsavelNome((r as any)?.nome ?? "");

      if ((f as any)?.empresa_id) {
        const { data: emp } = await supabase.from("syncvet_empresas").select("nome").eq("id", (f as any).empresa_id).maybeSingle();
        setEmpresaNome((emp as any)?.nome ?? "");
      }
      if (m.protocolo_id) {
        const { data: p } = await supabase.from("syncvet_protocolos").select("nome").eq("id", m.protocolo_id).maybeSingle();
        setProtocoloNome((p as any)?.nome ?? "");
      }
      if (m.semen_id) {
        const { data: s } = await supabase.from("syncvet_semen").select("touro, codigo").eq("id", m.semen_id).maybeSingle();
        if (s) setSemenNome(`${(s as any).touro}${(s as any).codigo ? ` (${(s as any).codigo})` : ""}`);
      } else if (m.semen_descricao_fazenda) {
        setSemenNome(m.semen_descricao_fazenda);
      }

      // carrega resultados existentes + animais para exibir número
      const { data: rs } = await (supabase as any)
        .from("syncvet_manejo_resultados")
        .select("animal_id, resultado")
        .eq("manejo_id", manejoId);
      const animalIds = ((rs as any[]) ?? []).map((r: any) => r.animal_id);
      let animMap: Record<string, string> = {};
      if (animalIds.length > 0) {
        const { data: an } = await supabase
          .from("syncvet_animais")
          .select("id, numero, brinco")
          .in("id", animalIds);
        for (const a of ((an as any[]) ?? [])) {
          animMap[a.id] = a.numero || a.brinco || "";
        }
      }
      const regs: Registro[] = ((rs as any[]) ?? []).map((r: any) => ({
        animal_id: r.animal_id,
        numero: animMap[r.animal_id] ?? "",
        resultado: r.resultado as Resultado,
      }));
      setRegistros(regs);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    })();
  }, [manejoId]);

  const stats = useMemo(() => {
    const p = registros.filter(r => r.resultado === "prenha").length;
    const va = registros.filter(r => r.resultado === "vazia").length;
    const r = registros.filter(r => r.resultado === "realizado").length;
    const taxa = (p + va) > 0 ? (p / (p + va)) * 100 : 0;
    return { p, va, r, total: registros.length, taxa };
  }, [registros]);

  async function confirmar(resultado: Resultado) {
    if (!manejo?.lote_id) return;
    const num = numero.trim();
    if (!num) { inputRef.current?.focus(); return; }
    setConfirmando(true);
    try {
      // busca animal
      let { data: existing } = await supabase
        .from("syncvet_animais")
        .select("id, numero, brinco")
        .eq("lote_id", manejo.lote_id)
        .or(`numero.eq.${num},brinco.eq.${num}`)
        .maybeSingle();

      let animalId = (existing as any)?.id as string | undefined;
      if (!animalId) {
        const { data: created, error: cErr } = await supabase
          .from("syncvet_animais")
          .insert({ lote_id: manejo.lote_id, numero: num })
          .select("id")
          .single();
        if (cErr) throw cErr;
        animalId = (created as any).id;
      }

      // se já existe registro para esse animal, atualiza; senão insere
      const idx = registros.findIndex(r => r.animal_id === animalId);
      if (idx >= 0) {
        await (supabase as any).from("syncvet_manejo_resultados")
          .delete()
          .eq("manejo_id", manejo.id)
          .eq("animal_id", animalId);
      }
      const { error } = await (supabase as any)
        .from("syncvet_manejo_resultados")
        .insert({ manejo_id: manejo.id, animal_id: animalId, resultado });
      if (error) throw error;

      setRegistros(prev => {
        const next = prev.filter(r => r.animal_id !== animalId);
        return [{ animal_id: animalId!, numero: num, resultado }, ...next];
      });
      setNumero("");
      setTimeout(() => inputRef.current?.focus(), 30);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao registrar");
    } finally {
      setConfirmando(false);
    }
  }

  async function removerRegistro(animal_id: string) {
    if (!manejo) return;
    await (supabase as any).from("syncvet_manejo_resultados")
      .delete()
      .eq("manejo_id", manejo.id)
      .eq("animal_id", animal_id);
    setRegistros(prev => prev.filter(r => r.animal_id !== animal_id));
  }

  async function finalizar(gerarPdf: boolean) {
    if (!manejo) return;
    if (registros.length === 0) { toast.error("Registre pelo menos um animal"); return; }
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("syncvet_manejos")
        .update({
          status: "concluido",
          data_execucao: new Date().toISOString(),
          observacoes: obsFinais || null,
        })
        .eq("id", manejo.id);
      if (error) throw error;

      if (gerarPdf) {
        const pdfAnimais = registros.map(r => ({
          numero: r.numero,
          categoria: null,
          diagnostico: r.resultado,
        }));
        const blob = await withReportExportDeadline(gerarManejoPDF({
          tipo,
          data: manejo.data_prevista,
          empresa: empresaNome,
          fazenda: fazendaNome,
          lote: loteNome,
          responsavel: responsavelNome,
          protocolo: protocoloNome || null,
          semen: semenNome || null,
          observacoes: obsFinais || null,
          animais: pdfAnimais,
        }), "PDF do manejo", Date.now() + 60_000, 60_000);
        downloadGeneratedPdf(blob, `manejo-${tipo}-${manejo.data_prevista}.pdf`);
      }

      toast.success("Manejo finalizado");
      navigate(`/syncvet/agenda`);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao finalizar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!manejo) return null;

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">Execução — {tipo.toUpperCase().replace("_", "/")}</h1>
          <p className="text-xs text-muted-foreground truncate">{fazendaNome} • {loteNome}</p>
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <div>
          <Label className="text-xs">Número do animal</Label>
          <Input
            ref={inputRef}
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="Digite o número/brinco"
            inputMode="text"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && isDG) { e.preventDefault(); confirmar("prenha"); }
              else if (e.key === "Enter") { e.preventDefault(); confirmar("realizado"); }
            }}
          />
        </div>
        {isDG ? (
          <div className="grid grid-cols-2 gap-2">
            <Button size="lg" onClick={() => confirmar("prenha")} disabled={confirmando || !numero.trim()}>
              Prenha
            </Button>
            <Button size="lg" variant="destructive" onClick={() => confirmar("vazia")} disabled={confirmando || !numero.trim()}>
              Vazia
            </Button>
          </div>
        ) : (
          <Button size="lg" className="w-full" onClick={() => confirmar("realizado")} disabled={confirmando || !numero.trim()}>
            <CheckCircle2 className="w-4 h-4 mr-1" /> Confirmar
          </Button>
        )}
        <div className="text-center text-sm text-muted-foreground pt-1">
          <span className="font-semibold text-foreground">{stats.total}</span> {stats.total === 1 ? "animal diagnosticado" : "animais diagnosticados"}
          {isDG && stats.total > 0 && (
            <span className="ml-2">• Taxa de prenhez: <span className="font-semibold text-primary">{stats.taxa.toFixed(1)}%</span></span>
          )}
        </div>
      </Card>

      {registros.length > 0 && (
        <Card className="p-3">
          <div className="text-xs font-semibold mb-2 text-muted-foreground">Últimos registros</div>
          <div className="max-h-64 overflow-y-auto divide-y">
            {registros.map(r => (
              <div key={r.animal_id} className="flex items-center justify-between py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{r.numero}</span>
                  <Badge variant={r.resultado === "prenha" ? "default" : r.resultado === "vazia" ? "destructive" : "secondary"} className="text-[10px]">
                    {r.resultado === "prenha" ? "Prenha" : r.resultado === "vazia" ? "Vazia" : "Realizado"}
                  </Badge>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removerRegistro(r.animal_id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <Label className="text-xs">Observações finais</Label>
        <Textarea value={obsFinais} onChange={(e) => setObsFinais(e.target.value)} rows={3} />
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => finalizar(false)} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
          Finalizar
        </Button>
        <Button onClick={() => finalizar(true)} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <FileDown className="w-4 h-4 mr-1" />}
          Finalizar e Gerar PDF
        </Button>
      </div>
    </div>
  );
}
