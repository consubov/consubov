import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Trash2, FileText, Download, Loader2, Receipt as ReceiptIcon, Fuel } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { gerarDespesasPdf } from "@/lib/despesasPdf";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subDays, differenceInWeeks, addWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Despesa {
  id: string;
  consultor_id: string;
  foto_cupom_url: string;
  valor: number;
  data_despesa: string;
  relatorio_despesa_id: string | null;
  created_at: string;
  signedUrl?: string;
}

interface Relatorio {
  id: string;
  tipo_periodo: string;
  data_inicio: string;
  data_fim: string;
  valor_total: number;
  pdf_url: string | null;
  gerado_em: string;
}

type TipoPeriodo = "semanal" | "quinzenal" | "mensal" | "personalizado";

function extractRelatorioPath(url: string | null): string | null {
  if (!url) return null;
  const marker = "/relatorios/";
  const idx = url.indexOf(marker);
  return idx >= 0 ? url.slice(idx + marker.length).split("?")[0] : null;
}
const WEEK_COLORS = ["#1F7A4D", "#C9A84C", "#B91C1C", "#0EA5E9", "#7C3AED", "#F97316"];

export default function ConsultorDespesasPage() {
  const { user } = useAuth();
  const [consultorId, setConsultorId] = useState<string | null>(null);
  const [consultorNome, setConsultorNome] = useState("");
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [relatorios, setRelatorios] = useState<Relatorio[]>([]);
  const [loading, setLoading] = useState(true);

  // Add modal
  const [addOpen, setAddOpen] = useState(false);
  const [addFile, setAddFile] = useState<File | null>(null);
  const [addValor, setAddValor] = useState("");
  const [addData, setAddData] = useState(format(new Date(), "yyyy-MM-dd"));
  const [uploading, setUploading] = useState(false);

  // Generate modal
  const [genOpen, setGenOpen] = useState(false);
  const [genTipo, setGenTipo] = useState<TipoPeriodo>("mensal");
  const [genIni, setGenIni] = useState("");
  const [genFim, setGenFim] = useState("");
  const [generating, setGenerating] = useState(false);

  // Delete
  const [toDelete, setToDelete] = useState<Despesa | null>(null);
  const [toDeleteRel, setToDeleteRel] = useState<Relatorio | null>(null);

  useEffect(() => { if (user) void init(); }, [user]);

  async function init() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("consultores").select("id, nome").eq("user_id", user.id).maybeSingle();
    if (!data) { setLoading(false); return; }
    setConsultorId(data.id);
    setConsultorNome((data as any).nome ?? "");
    await Promise.all([loadDespesas(data.id), loadRelatorios(data.id)]);
    setLoading(false);
  }

  async function loadDespesas(cid: string) {
    const { data } = await supabase.from("despesas_combustivel")
      .select("*").eq("consultor_id", cid).order("data_despesa", { ascending: false });
    const items = (data ?? []) as Despesa[];
    // Generate signed URLs for previews
    for (const d of items) {
      const path = extractPath(d.foto_cupom_url);
      if (path) {
        const { data: signed } = await supabase.storage.from("despesas-consultor-fotos").createSignedUrl(path, 3600);
        d.signedUrl = signed?.signedUrl;
      }
    }
    setDespesas(items);
  }

  async function loadRelatorios(cid: string) {
    const { data } = await supabase.from("relatorios_despesas")
      .select("*").eq("consultor_id", cid).order("gerado_em", { ascending: false }).limit(30);
    setRelatorios((data ?? []) as Relatorio[]);
  }

  function extractPath(url: string) {
    // Storage path we save; if it's a raw path use as-is, otherwise try to extract after bucket name
    if (!url) return null;
    if (!url.startsWith("http")) return url;
    const marker = "/despesas-consultor-fotos/";
    const idx = url.indexOf(marker);
    return idx >= 0 ? url.slice(idx + marker.length).split("?")[0] : null;
  }

  async function handleAdd() {
    if (!user || !consultorId || !addFile || !addValor) {
      toast.error("Preencha valor e foto");
      return;
    }
    setUploading(true);
    try {
      const ext = addFile.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("despesas-consultor-fotos").upload(path, addFile, { upsert: false });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("despesas_combustivel").insert({
        consultor_id: consultorId,
        foto_cupom_url: path,
        valor: Number(addValor.replace(",", ".")),
        data_despesa: addData,
      });
      if (insErr) throw insErr;
      toast.success("Cupom adicionado");
      setAddOpen(false);
      setAddFile(null); setAddValor(""); setAddData(format(new Date(), "yyyy-MM-dd"));
      await loadDespesas(consultorId);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao adicionar");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!toDelete || !consultorId) return;
    if (toDelete.relatorio_despesa_id) {
      toast.error("Cupom já vinculado a um relatório");
      setToDelete(null);
      return;
    }
    const path = extractPath(toDelete.foto_cupom_url);
    if (path) await supabase.storage.from("despesas-consultor-fotos").remove([path]);
    await supabase.from("despesas_combustivel").delete().eq("id", toDelete.id);
    toast.success("Cupom removido");
    setToDelete(null);
    await loadDespesas(consultorId);
  }

  async function handleDeleteRelatorio() {
    if (!toDeleteRel || !consultorId) return;
    try {
      const path = extractRelatorioPath(toDeleteRel.pdf_url);
      if (path) {
        await supabase.storage.from("relatorios").remove([path]);
      }
      const { error } = await supabase.from("relatorios_despesas").delete().eq("id", toDeleteRel.id);
      if (error) throw error;
      toast.success("Relatório excluído");
      setToDeleteRel(null);
      await loadRelatorios(consultorId);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao excluir relatório");
    }
  }


  function autoRange(t: TipoPeriodo) {
    const now = new Date();
    if (t === "semanal") return { ini: format(subDays(now, 7), "yyyy-MM-dd"), fim: format(now, "yyyy-MM-dd") };
    if (t === "quinzenal") return { ini: format(subDays(now, 15), "yyyy-MM-dd"), fim: format(now, "yyyy-MM-dd") };
    if (t === "mensal") return { ini: format(startOfMonth(now), "yyyy-MM-dd"), fim: format(endOfMonth(now), "yyyy-MM-dd") };
    return { ini: "", fim: "" };
  }

  useEffect(() => {
    if (genTipo !== "personalizado") {
      const r = autoRange(genTipo);
      setGenIni(r.ini); setGenFim(r.fim);
    }
  }, [genTipo]);

  async function handleGerar() {
    if (!consultorId || !genIni || !genFim) { toast.error("Selecione o período"); return; }
    setGenerating(true);
    try {
      const pendentes = despesas.filter(d => !d.relatorio_despesa_id && d.data_despesa >= genIni && d.data_despesa <= genFim);
      if (!pendentes.length) { toast.error("Sem cupons pendentes no período"); setGenerating(false); return; }

      const valor_total = pendentes.reduce((s, d) => s + Number(d.valor), 0);

      // Public URLs for the PDF (create signed URLs then fetch)
      const items = await Promise.all(pendentes.map(async (d) => {
        const path = extractPath(d.foto_cupom_url) || d.foto_cupom_url;
        const { data: signed } = await supabase.storage.from("despesas-consultor-fotos").createSignedUrl(path, 3600);
        return { data_despesa: d.data_despesa, valor: Number(d.valor), foto_cupom_url: signed?.signedUrl ?? "" };
      }));

      const blob = await gerarDespesasPdf({
        consultor_nome: consultorNome,
        data_inicio: genIni,
        data_fim: genFim,
        tipo_periodo: genTipo,
        despesas: items,
        valor_total,
      });

      const pdfPath = `${consultorId}/relatorios/${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage.from("relatorios").upload(pdfPath, blob, { contentType: "application/pdf", upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("relatorios").getPublicUrl(pdfPath);

      const { data: rel, error: relErr } = await supabase.from("relatorios_despesas").insert({
        consultor_id: consultorId,
        tipo_periodo: genTipo,
        data_inicio: genIni,
        data_fim: genFim,
        valor_total,
        pdf_url: pub.publicUrl,
      }).select().single();
      if (relErr) throw relErr;

      await supabase.from("despesas_combustivel").update({ relatorio_despesa_id: rel.id }).in("id", pendentes.map(p => p.id));

      toast.success("Relatório gerado");
      setGenOpen(false);
      await Promise.all([loadDespesas(consultorId), loadRelatorios(consultorId)]);
      window.open(pub.publicUrl, "_blank");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar relatório");
    } finally {
      setGenerating(false);
    }
  }

  const pendentes = despesas.filter(d => !d.relatorio_despesa_id);
  const totalPendente = pendentes.reduce((s, d) => s + Number(d.valor), 0);

  // Donut: current-month spend per week
  const donutData = useMemo(() => {
    const now = new Date();
    const mIni = startOfMonth(now);
    const mFim = endOfMonth(now);
    const buckets: { name: string; value: number }[] = [];
    let wIni = startOfWeek(mIni, { locale: ptBR });
    let idx = 1;
    while (wIni <= mFim) {
      const wFim = endOfWeek(wIni, { locale: ptBR });
      const val = despesas.filter(d => {
        const dd = new Date(d.data_despesa);
        return dd >= wIni && dd <= wFim && dd >= mIni && dd <= mFim;
      }).reduce((s, d) => s + Number(d.valor), 0);
      if (val > 0) buckets.push({ name: `Sem ${idx}`, value: val });
      wIni = addWeeks(wIni, 1);
      idx++;
    }
    return buckets;
  }, [despesas]);

  const totalMes = donutData.reduce((s, b) => s + b.value, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2"><Fuel className="w-5 h-5" /> Despesas de Combustível</h1>
          <p className="text-sm text-muted-foreground">Cupons e relatórios</p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="w-4 h-4 mr-1" /> Cupom</Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Cupons pendentes</div>
          <div className="text-2xl font-bold">{pendentes.length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Valor pendente</div>
          <div className="text-2xl font-bold text-primary">{totalPendente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
        </Card>
      </div>

      <Card className="p-3">
        <div className="text-sm font-semibold mb-2">Gastos do mês por semana</div>
        {donutData.length === 0 ? (
          <div className="text-xs text-muted-foreground py-6 text-center">Sem despesas no mês atual.</div>
        ) : (
          <div className="flex items-center gap-3">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={donutData} dataKey="value" innerRadius={40} outerRadius={70} strokeWidth={0}>
                  {donutData.map((_, i) => <Cell key={i} fill={WEEK_COLORS[i % WEEK_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1 text-xs">
              {donutData.map((d, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: WEEK_COLORS[i % WEEK_COLORS.length] }} />{d.name}</span>
                  <span className="font-medium">{d.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                </div>
              ))}
              <div className="pt-1 mt-1 border-t flex items-center justify-between font-semibold">
                <span>Total</span>
                <span>{totalMes.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
              </div>
            </div>
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Cupons pendentes</h2>
        <Button size="sm" variant="outline" onClick={() => setGenOpen(true)} disabled={!pendentes.length}>
          <FileText className="w-4 h-4 mr-1" /> Gerar relatório
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-6 text-muted-foreground">Carregando…</div>
      ) : pendentes.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum cupom pendente.</Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {pendentes.map(d => (
            <Card key={d.id} className="p-2 space-y-2">
              {d.signedUrl && <img src={d.signedUrl} alt="Cupom" className="w-full h-32 object-cover rounded" />}
              <div className="text-xs">
                <div className="font-semibold">{Number(d.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
                <div className="text-muted-foreground">{format(new Date(d.data_despesa + "T00:00:00"), "dd/MM/yyyy")}</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setToDelete(d)} className="w-full text-destructive">
                <Trash2 className="w-3 h-3 mr-1" /> Excluir
              </Button>
            </Card>
          ))}
        </div>
      )}

      {relatorios.length > 0 && (
        <>
          <h2 className="text-sm font-semibold mt-4">Relatórios anteriores</h2>
          <div className="space-y-2">
            {relatorios.map(r => (
              <Card key={r.id} className="p-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold flex items-center gap-1"><ReceiptIcon className="w-4 h-4" />{r.tipo_periodo}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(r.data_inicio + "T00:00:00"), "dd/MM/yyyy")} — {format(new Date(r.data_fim + "T00:00:00"), "dd/MM/yyyy")}
                  </div>
                  <div className="text-sm font-bold text-primary">{Number(r.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
                </div>
                <div className="flex items-center gap-2">
                  {r.pdf_url && (
                    <Button size="sm" variant="outline" onClick={() => window.open(r.pdf_url!, "_blank")}>
                      <Download className="w-4 h-4" />
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setToDeleteRel(r)} className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Add cupom modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo cupom</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Foto do cupom</Label>
              <Input type="file" accept="image/*" onChange={(e) => setAddFile(e.target.files?.[0] ?? null)} />
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" inputMode="decimal" value={addValor} onChange={(e) => setAddValor(e.target.value)} />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={addData} onChange={(e) => setAddData(e.target.value)} />
            </div>
            <Button onClick={handleAdd} disabled={uploading} className="w-full">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generate modal */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Gerar relatório</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {(["semanal","quinzenal","mensal","personalizado"] as TipoPeriodo[]).map(t => (
                <Button key={t} size="sm" variant={genTipo === t ? "default" : "outline"} onClick={() => setGenTipo(t)}>
                  {t === "semanal" ? "7 dias" : t === "quinzenal" ? "15 dias" : t === "mensal" ? "Mensal" : "Personalizado"}
                </Button>
              ))}
            </div>
            <div>
              <Label>Início</Label>
              <Input type="date" value={genIni} onChange={(e) => setGenIni(e.target.value)} disabled={genTipo !== "personalizado"} />
            </div>
            <div>
              <Label>Fim</Label>
              <Input type="date" value={genFim} onChange={(e) => setGenFim(e.target.value)} disabled={genTipo !== "personalizado"} />
            </div>
            <div className="text-xs text-muted-foreground">
              Cupons no período: <strong>{despesas.filter(d => !d.relatorio_despesa_id && d.data_despesa >= genIni && d.data_despesa <= genFim).length}</strong>
            </div>
            <Button onClick={handleGerar} disabled={generating} className="w-full">
              {generating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <FileText className="w-4 h-4 mr-1" />} Gerar PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cupom?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!toDeleteRel} onOpenChange={(o) => !o && setToDeleteRel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir relatório?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? Essa ação não pode ser desfeita. Os cupons vinculados continuarão marcados como já reportados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRelatorio}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
