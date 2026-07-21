import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Loader2, FileDown } from "lucide-react";
import { gerarManejoPDF } from "@/lib/syncvetManejoPdf";

type Animal = {
  id: string;
  brinco: string | null;
  numero: string | null;
  categoria: string | null;
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
  fonte_protocolo: string | null;
};

type Resultado = "prenha" | "vazia" | "realizado";

export default function SyncVetManejoExecucaoPage() {
  const { manejoId } = useParams<{ manejoId: string }>();
  const navigate = useNavigate();

  const [manejo, setManejo] = useState<Manejo | null>(null);
  const [animais, setAnimais] = useState<Animal[]>([]);
  const [values, setValues] = useState<Record<string, Resultado>>({});
  const [fazendaNome, setFazendaNome] = useState("");
  const [loteNome, setLoteNome] = useState("");
  const [responsavelNome, setResponsavelNome] = useState("");
  const [empresaNome, setEmpresaNome] = useState("");
  const [protocoloNome, setProtocoloNome] = useState("");
  const [semenNome, setSemenNome] = useState("");
  const [obsFinais, setObsFinais] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState(0);

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

      const [{ data: an }, { data: f }, { data: l }, { data: r }] = await Promise.all([
        supabase.from("syncvet_animais").select("id, brinco, numero, categoria").eq("lote_id", m.lote_id).order("created_at"),
        supabase.from("syncvet_fazendas").select("nome, empresa_id").eq("id", m.fazenda_id).maybeSingle(),
        supabase.from("syncvet_lotes").select("nome").eq("id", m.lote_id).maybeSingle(),
        m.responsavel_id
          ? supabase.from("syncvet_equipe").select("nome").eq("id", m.responsavel_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      setAnimais((an as any) ?? []);
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

      // carrega resultados existentes
      const { data: rs } = await (supabase as any)
        .from("syncvet_manejo_resultados")
        .select("animal_id, resultado")
        .eq("manejo_id", manejoId);
      const v: Record<string, Resultado> = {};
      for (const row of (rs as any[]) ?? []) {
        v[row.animal_id] = row.resultado as Resultado;
      }
      setValues(v);
      setLoading(false);
    })();
  }, [manejoId]);

  const stats = useMemo(() => {
    const p = Object.values(values).filter(v => v === "prenha").length;
    const va = Object.values(values).filter(v => v === "vazia").length;
    const r = Object.values(values).filter(v => v === "realizado").length;
    const total = animais.length;
    const done = p + va + r;
    const taxa = (p + va) > 0 ? (p / (p + va)) * 100 : 0;
    return { p, va, r, total, done, taxa };
  }, [values, animais]);

  function setResult(animalId: string, r: Resultado) {
    setValues(prev => ({ ...prev, [animalId]: r }));
    // avança
    if (current < animais.length - 1) setCurrent(current + 1);
  }

  function marcarTodos(r: Resultado) {
    const next: Record<string, Resultado> = { ...values };
    for (const a of animais) next[a.id] = r;
    setValues(next);
  }

  async function persistResultados() {
    if (!manejoId) return;
    const rows = Object.entries(values).map(([animal_id, resultado]) => ({
      manejo_id: manejoId,
      animal_id,
      resultado,
    }));
    if (rows.length === 0) return;
    await (supabase as any).from("syncvet_manejo_resultados").delete().eq("manejo_id", manejoId);
    const { error } = await (supabase as any).from("syncvet_manejo_resultados").insert(rows);
    if (error) throw error;
  }

  async function handleFinalizarEGerarPdf() {
    if (!manejo) return;
    if (stats.done === 0) { toast.error("Registre pelo menos um resultado"); return; }
    setSaving(true);
    try {
      await persistResultados();
      const { error } = await (supabase as any)
        .from("syncvet_manejos")
        .update({
          status: "concluido",
          data_execucao: new Date().toISOString(),
          observacoes: obsFinais || null,
        })
        .eq("id", manejo.id);
      if (error) throw error;

      const pdfAnimais = animais.map(a => ({
        numero: a.brinco || a.numero || "(sem brinco)",
        categoria: a.categoria,
        diagnostico: values[a.id] ?? null,
      }));
      const blob = await gerarManejoPDF({
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
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `manejo-${tipo}-${manejo.data_prevista}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("Manejo finalizado");
      navigate(`/syncvet/agenda`);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao finalizar");
    } finally {
      setSaving(false);
    }
  }

  async function handleSalvarParcial() {
    setSaving(true);
    try {
      await persistResultados();
      toast.success("Progresso salvo");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!manejo) return null;

  const animal = animais[current];

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">Execução — {tipo.toUpperCase().replace("_", "/")}</h1>
          <p className="text-xs text-muted-foreground truncate">{fazendaNome} • {loteNome}</p>
        </div>
      </div>

      <Card className="p-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-[10px] text-muted-foreground">Progresso</div>
          <div className="text-lg font-bold">{stats.done}/{stats.total}</div>
        </div>
        {isDG ? (
          <>
            <div>
              <div className="text-[10px] text-muted-foreground">Prenhas</div>
              <div className="text-lg font-bold text-primary">{stats.p}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Taxa</div>
              <div className="text-lg font-bold">{stats.taxa.toFixed(1)}%</div>
            </div>
          </>
        ) : (
          <>
            <div>
              <div className="text-[10px] text-muted-foreground">Realizados</div>
              <div className="text-lg font-bold text-primary">{stats.r}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Restantes</div>
              <div className="text-lg font-bold">{stats.total - stats.done}</div>
            </div>
          </>
        )}
      </Card>

      <div className="flex gap-2">
        {isDG ? (
          <>
            <Button size="sm" variant="outline" className="flex-1" onClick={() => marcarTodos("prenha")}>Todas prenhas</Button>
            <Button size="sm" variant="outline" className="flex-1" onClick={() => marcarTodos("vazia")}>Todas vazias</Button>
          </>
        ) : (
          <Button size="sm" variant="outline" className="flex-1" onClick={() => marcarTodos("realizado")}>Marcar todos como realizado</Button>
        )}
      </div>

      {animal && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Animal {current + 1} de {animais.length}</div>
              <div className="text-2xl font-bold">{animal.brinco || animal.numero || "(sem brinco)"}</div>
              <div className="text-xs text-muted-foreground">{animal.categoria ?? "—"}</div>
            </div>
            {values[animal.id] && (
              <Badge className="text-[10px]">
                {values[animal.id] === "prenha" ? "Prenha" : values[animal.id] === "vazia" ? "Vazia" : "Realizado"}
              </Badge>
            )}
          </div>

          {isDG ? (
            <div className="grid grid-cols-2 gap-2">
              <Button size="lg" variant={values[animal.id] === "prenha" ? "default" : "outline"} onClick={() => setResult(animal.id, "prenha")}>
                Prenha
              </Button>
              <Button size="lg" variant={values[animal.id] === "vazia" ? "destructive" : "outline"} onClick={() => setResult(animal.id, "vazia")}>
                Vazia
              </Button>
            </div>
          ) : (
            <Button size="lg" className="w-full" variant={values[animal.id] === "realizado" ? "default" : "outline"} onClick={() => setResult(animal.id, "realizado")}>
              <CheckCircle2 className="w-4 h-4 mr-1" /> Marcar como realizado
            </Button>
          )}

          <div className="flex justify-between text-xs">
            <Button size="sm" variant="ghost" disabled={current === 0} onClick={() => setCurrent(current - 1)}>← Anterior</Button>
            <Button size="sm" variant="ghost" disabled={current >= animais.length - 1} onClick={() => setCurrent(current + 1)}>Próximo →</Button>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <Label className="text-xs">Observações finais</Label>
        <Textarea value={obsFinais} onChange={(e) => setObsFinais(e.target.value)} rows={3} />
      </Card>

      <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-3 flex gap-2 z-40">
        <Button variant="outline" className="flex-1" onClick={handleSalvarParcial} disabled={saving}>Salvar progresso</Button>
        <Button className="flex-1" onClick={handleFinalizarEGerarPdf} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <FileDown className="w-4 h-4 mr-1" />}
          Finalizar e Gerar PDF
        </Button>
      </div>
    </div>
  );
}
