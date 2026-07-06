import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Camera, X, ChevronUp, ChevronDown, Check, FileText, Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { generateVisitaPdf, uploadVisitaPdf } from "@/lib/visitaPdf";

const BUCKET = "visitas-consultor-fotos";

const PRODUTOS = [
  { value: "mineral", label: "Mineral" },
  { value: "racao", label: "Ração" },
  { value: "proteinado_0.1", label: "Proteinado 0,1%" },
  { value: "proteinado_0.3", label: "Proteinado 0,3%" },
  { value: "proteinado_0.5", label: "Proteinado 0,5%" },
  { value: "proteinado_1", label: "Proteinado 1%" },
  { value: "outro", label: "Outro" },
];

interface Foto { id: string; url: string; ordem: number; }
interface Pasto {
  id: string;
  letra: string;
  num_pasto: string | null;
  qtd_animais: number | null;
  tipo_produto: string | null;
  percentual_pv: string | null;
  consumo_kg_dia: number | null;
  observacao: string | null;
  ordem: number;
  scores: { fezes?: number; corporal?: number; bebedouro?: number };
  fotos: Foto[];
  signed: Record<string, string>;
}
interface Visita {
  id: string; status: string; hora_inicio: string; hora_fim: string | null;
  observacoes_gerais: string | null; conclusao: string | null;
  fazenda_consultor_id: string; consultor_id: string;
  pdf_url: string | null;
}

async function signPath(path: string): Promise<string> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 6);
  return data?.signedUrl || "";
}

export default function RevisaoVisitaPage() {
  const { visitaId } = useParams<{ visitaId: string }>();
  const navigate = useNavigate();
  const [visita, setVisita] = useState<Visita | null>(null);
  const [fazenda, setFazenda] = useState<any>(null);
  const [consultor, setConsultor] = useState<any>(null);
  const [pastos, setPastos] = useState<Pasto[]>([]);
  const [obsGerais, setObsGerais] = useState("");
  const [conclusao, setConclusao] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  useEffect(() => { if (visitaId) load(); }, [visitaId]);

  async function load() {
    setLoading(true);
    const { data: v } = await supabase.from("visitas_tecnicas").select("*").eq("id", visitaId!).maybeSingle();
    if (!v) { setLoading(false); return; }
    setVisita(v as any);
    setObsGerais(v.observacoes_gerais || "");
    setConclusao(v.conclusao || "");

    const [{ data: fz }, { data: cs }, { data: ps }] = await Promise.all([
      supabase.from("fazendas_consultor").select("*").eq("id", v.fazenda_consultor_id).maybeSingle(),
      supabase.from("consultores").select("*").eq("id", v.consultor_id).maybeSingle(),
      supabase.from("visita_pastos").select("*").eq("visita_id", visitaId!).order("ordem"),
    ]);
    setFazenda(fz); setConsultor(cs);

    const pastoRows = (ps as any[]) || [];
    const ids = pastoRows.map(p => p.id);
    let scoresByPasto: Record<string, any> = {};
    let fotosByPasto: Record<string, Foto[]> = {};
    if (ids.length) {
      const [{ data: sc }, { data: ft }] = await Promise.all([
        supabase.from("avaliacoes_score").select("visita_pasto_id, tipo, nota").in("visita_pasto_id", ids),
        supabase.from("visita_fotos").select("*").in("visita_pasto_id", ids).order("ordem"),
      ]);
      (sc || []).forEach((s: any) => {
        scoresByPasto[s.visita_pasto_id] = { ...(scoresByPasto[s.visita_pasto_id] || {}), [s.tipo]: s.nota };
      });
      (ft || []).forEach((f: any) => {
        fotosByPasto[f.visita_pasto_id] = [...(fotosByPasto[f.visita_pasto_id] || []), f];
      });
    }
    const built: Pasto[] = await Promise.all(pastoRows.map(async p => {
      const fotos = fotosByPasto[p.id] || [];
      const signed: Record<string, string> = {};
      await Promise.all(fotos.map(async f => { signed[f.id] = await signPath(f.url); }));
      return { ...p, scores: scoresByPasto[p.id] || {}, fotos, signed } as Pasto;
    }));
    setPastos(built);
    setLoading(false);
  }

  async function autosavePasto(pastoId: string, patch: Partial<Pasto>) {
    const dbPatch: any = {};
    ["letra","num_pasto","qtd_animais","tipo_produto","percentual_pv","consumo_kg_dia","observacao"].forEach(k => {
      if (k in patch) dbPatch[k] = (patch as any)[k];
    });
    if (Object.keys(dbPatch).length === 0) return;
    const { error } = await supabase.from("visita_pastos").update(dbPatch).eq("id", pastoId);
    if (error) toast.error("Erro ao salvar: " + error.message);
  }

  function updatePasto(id: string, patch: Partial<Pasto>) {
    setPastos(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
  }

  async function setScore(pastoId: string, tipo: "fezes"|"corporal"|"bebedouro", nota: number) {
    updatePasto(pastoId, { scores: { ...pastos.find(p => p.id === pastoId)!.scores, [tipo]: nota } });
    await supabase.from("avaliacoes_score").delete().eq("visita_pasto_id", pastoId).eq("tipo", tipo);
    const { error } = await supabase.from("avaliacoes_score").insert({ visita_pasto_id: pastoId, tipo, nota });
    if (error) toast.error("Erro ao salvar nota");
  }

  async function autosaveVisita(patch: Partial<Visita>) {
    const { error } = await supabase.from("visitas_tecnicas").update(patch).eq("id", visitaId!);
    if (error) toast.error("Erro ao salvar: " + error.message);
  }

  async function addFoto(pastoId: string, file: File) {
    const p = pastos.find(x => x.id === pastoId); if (!p) return;
    if (p.fotos.length >= 5) { toast.error("Máx. 5 fotos"); return; }
    const usadas = new Set(p.fotos.map(f => f.ordem));
    let ordem = 1;
    while (usadas.has(ordem) && ordem <= 5) ordem++;
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${pastoId}/${ordem}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
      if (error) throw error;
      const { data, error: insErr } = await supabase.from("visita_fotos")
        .insert({ visita_pasto_id: pastoId, url: path, ordem }).select().single();
      if (insErr) throw insErr;
      const url = await signPath((data as any).url);
      updatePasto(pastoId, {
        fotos: [...p.fotos, data as Foto].sort((a, b) => a.ordem - b.ordem),
        signed: { ...p.signed, [(data as any).id]: url },
      });
    } catch (err: any) {
      toast.error("Erro ao enviar foto: " + (err?.message || ""));
    }
  }

  async function delFoto(pastoId: string, f: Foto) {
    const p = pastos.find(x => x.id === pastoId); if (!p) return;
    await supabase.storage.from(BUCKET).remove([f.url]);
    await supabase.from("visita_fotos").delete().eq("id", f.id);
    updatePasto(pastoId, { fotos: p.fotos.filter(x => x.id !== f.id) });
  }

  async function moveFoto(pastoId: string, index: number, dir: -1 | 1) {
    const p = pastos.find(x => x.id === pastoId); if (!p) return;
    const arr = [...p.fotos];
    const j = index + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[index], arr[j]] = [arr[j], arr[index]];
    const updates = arr.map((f, i) => ({ ...f, ordem: i + 1 }));
    updatePasto(pastoId, { fotos: updates });
    await Promise.all(updates.map(u =>
      supabase.from("visita_fotos").update({ ordem: u.ordem }).eq("id", u.id)
    ));
  }

  async function confirmarRevisao() {
    setConfirmando(true);
    try {
      await autosaveVisita({ observacoes_gerais: obsGerais, conclusao, status: "revisao" as any });
      toast.success("Visita revisada. Pronta para gerar o PDF.");
      await load();
    } finally { setConfirmando(false); }
  }

  async function gerarPdf() {
    if (!visita || !fazenda || !consultor) return;
    setGerandoPdf(true);
    const t = toast.loading("Gerando PDF...");
    try {
      // Salva últimas edições antes
      await autosaveVisita({ observacoes_gerais: obsGerais, conclusao });

      const { blob, fileName } = await generateVisitaPdf({
        visitaId: visita.id,
        fazenda: {
          nome_fazenda: fazenda.nome_fazenda,
          proprietario: fazenda.proprietario,
          municipio: fazenda.municipio,
          uf: fazenda.uf,
        },
        consultor: { nome: consultor.nome },
        hora_inicio: visita.hora_inicio,
        hora_fim: visita.hora_fim || new Date().toISOString(),
        observacoes_gerais: obsGerais,
        conclusao,
        pastos: pastos.map(p => ({
          id: p.id, letra: p.letra, num_pasto: p.num_pasto, qtd_animais: p.qtd_animais,
          tipo_produto: p.tipo_produto, percentual_pv: p.percentual_pv,
          consumo_kg_dia: p.consumo_kg_dia, observacao: p.observacao,
          scores: p.scores, fotos: p.fotos,
        })),
      });

      const pdfUrl = await uploadVisitaPdf(blob, fileName, visita.consultor_id, visita.id);
      const { error } = await supabase.from("visitas_tecnicas").update({
        pdf_url: pdfUrl,
        status: "finalizada",
        hora_fim: visita.hora_fim || new Date().toISOString(),
      }).eq("id", visita.id);
      if (error) throw error;

      toast.dismiss(t);
      toast.success("PDF gerado e visita finalizada!");
      await load();
    } catch (err: any) {
      toast.dismiss(t);
      toast.error("Erro ao gerar PDF: " + (err?.message || "desconhecido"));
    } finally { setGerandoPdf(false); }
  }

  async function compartilhar() {
    if (!visita?.pdf_url) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Visita – ${fazenda?.nome_fazenda || ""}`,
          text: "Relatório de visita técnica Consubov",
          url: visita.pdf_url,
        });
      } else {
        await navigator.clipboard.writeText(visita.pdf_url);
        toast.success("Link copiado!");
      }
    } catch { /* user cancelou */ }
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!visita) return <div className="text-center py-12">Visita não encontrada</div>;

  const readOnly = visita.status === "finalizada";

  return (
    <div className="space-y-4 pb-24" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 -ml-2">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Button>

      {/* Cabeçalho estilo relatório */}
      <div
        className="rounded-lg p-4 text-white"
        style={{ background: "#14432B", fontFamily: "'Manrope', sans-serif" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center font-extrabold text-lg" style={{ background: "#C9A84C", color: "#14432B" }}>C</div>
          <div>
            <div className="text-[10px] uppercase tracking-widest opacity-80">Relatório de Visita</div>
            <div className="text-sm font-bold">Consubov Consultoria</div>
          </div>
        </div>
        <div className="text-lg font-extrabold leading-tight">{fazenda?.nome_fazenda || "—"}</div>
        <div className="text-xs opacity-80 mt-0.5">
          {[fazenda?.proprietario, fazenda?.municipio, fazenda?.uf].filter(Boolean).join(" · ") || "—"}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3 text-[11px]">
          <div>
            <div className="opacity-60">Consultor</div>
            <div className="font-semibold">{consultor?.nome || "—"}</div>
          </div>
          <div>
            <div className="opacity-60">Início</div>
            <div className="font-semibold">{format(new Date(visita.hora_inicio), "dd/MM HH:mm", { locale: ptBR })}</div>
          </div>
        </div>
      </div>

      {/* Blocos de pasto */}
      <div className="space-y-3">
        {pastos.map(p => (
          <div key={p.id} className="rounded-lg border bg-card" style={{ borderColor: "#E7E3D6" }}>
            <div className="flex items-center gap-3 p-3 border-b" style={{ borderColor: "#E7E3D6" }}>
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center font-extrabold text-lg"
                style={{ background: "#14432B", color: "#C9A84C", fontFamily: "'Manrope', sans-serif" }}
              >
                {p.letra}
              </div>
              <div className="flex-1 grid grid-cols-2 gap-2">
                <FieldInline
                  label="Nº Pasto"
                  value={p.num_pasto || ""}
                  onSave={v => { updatePasto(p.id, { num_pasto: v || null }); autosavePasto(p.id, { num_pasto: v || null }); }}
                  disabled={readOnly}
                />
                <FieldInline
                  label="Animais"
                  value={p.qtd_animais?.toString() || ""}
                  type="number"
                  onSave={v => { const n = v ? Number(v) : null; updatePasto(p.id, { qtd_animais: n }); autosavePasto(p.id, { qtd_animais: n }); }}
                  disabled={readOnly}
                />
              </div>
            </div>

            <div className="p-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "#767066" }}>Produto</div>
                  <Select
                    value={p.tipo_produto || ""}
                    onValueChange={v => { updatePasto(p.id, { tipo_produto: v }); autosavePasto(p.id, { tipo_produto: v }); }}
                    disabled={readOnly}
                  >
                    <SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {PRODUTOS.map(x => <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <FieldInline
                  label="% PV"
                  value={p.percentual_pv || ""}
                  onSave={v => { updatePasto(p.id, { percentual_pv: v || null }); autosavePasto(p.id, { percentual_pv: v || null }); }}
                  disabled={readOnly}
                />
              </div>
              <FieldInline
                label="Consumo (kg/dia)"
                type="number"
                value={p.consumo_kg_dia?.toString() || ""}
                onSave={v => { const n = v ? Number(v) : null; updatePasto(p.id, { consumo_kg_dia: n }); autosavePasto(p.id, { consumo_kg_dia: n }); }}
                disabled={readOnly}
              />

              {/* Scores */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <ScoreBlock label="Fezes" value={p.scores.fezes} onChange={n => setScore(p.id, "fezes", n)} disabled={readOnly} />
                <ScoreBlock label="Corporal" value={p.scores.corporal} onChange={n => setScore(p.id, "corporal", n)} disabled={readOnly} />
                <ScoreBlock label="Bebedouro" value={p.scores.bebedouro} onChange={n => setScore(p.id, "bebedouro", n)} disabled={readOnly} />
              </div>

              {/* Observação */}
              <div>
                <div className="text-[10px] uppercase tracking-wide font-semibold mb-1" style={{ color: "#767066" }}>Observação</div>
                <Textarea
                  defaultValue={p.observacao || ""}
                  onBlur={e => { const v = e.target.value; updatePasto(p.id, { observacao: v || null }); autosavePasto(p.id, { observacao: v || null }); }}
                  rows={2}
                  className="text-sm"
                  disabled={readOnly}
                />
              </div>

              {/* Fotos */}
              <PhotoManager
                pasto={p}
                readOnly={readOnly}
                onAdd={f => addFoto(p.id, f)}
                onDelete={f => delFoto(p.id, f)}
                onMove={(i, d) => moveFoto(p.id, i, d)}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Observações gerais & Conclusão */}
      <div className="rounded-lg border bg-card p-3 space-y-3" style={{ borderColor: "#E7E3D6" }}>
        <div>
          <div className="text-[11px] uppercase tracking-wide font-bold" style={{ color: "#14432B", fontFamily: "'Manrope', sans-serif" }}>Observações gerais</div>
          <Textarea
            value={obsGerais}
            onChange={e => setObsGerais(e.target.value)}
            onBlur={() => autosaveVisita({ observacoes_gerais: obsGerais })}
            rows={3}
            disabled={readOnly}
            className="mt-1"
          />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide font-bold" style={{ color: "#14432B", fontFamily: "'Manrope', sans-serif" }}>Conclusão</div>
          <Textarea
            value={conclusao}
            onChange={e => setConclusao(e.target.value)}
            onBlur={() => autosaveVisita({ conclusao })}
            rows={3}
            disabled={readOnly}
            className="mt-1"
          />
        </div>
      </div>

      {/* Botão fixo por status */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-background border-t z-10">
        <div className="max-w-md mx-auto flex gap-2">
          {visita.status === "rascunho" && (
            <Button
              onClick={confirmarRevisao}
              disabled={confirmando}
              className="w-full gap-2"
              style={{ background: "#1F7A4D", color: "white" }}
            >
              {confirmando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Confirmar Revisão
            </Button>
          )}
          {visita.status === "revisao" && (
            <Button
              onClick={gerarPdf}
              disabled={gerandoPdf}
              className="w-full gap-2"
              style={{ background: "#14432B", color: "white" }}
            >
              {gerandoPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Gerar PDF
            </Button>
          )}
          {visita.status === "finalizada" && visita.pdf_url && (
            <>
              <Button asChild variant="outline" className="flex-1 gap-1.5">
                <a href={visita.pdf_url} target="_blank" rel="noreferrer">
                  <FileText className="w-4 h-4" /> Ver
                </a>
              </Button>
              <Button asChild variant="outline" className="flex-1 gap-1.5">
                <a href={visita.pdf_url} download>
                  <Download className="w-4 h-4" /> Baixar
                </a>
              </Button>
              <Button onClick={compartilhar} className="flex-1 gap-1.5" style={{ background: "#1F7A4D", color: "white" }}>
                <Share2 className="w-4 h-4" /> Enviar
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldInline({ label, value, onSave, type, disabled }: {
  label: string; value: string; onSave: (v: string) => void; type?: string; disabled?: boolean;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: "#767066" }}>{label}</div>
      <Input
        value={v}
        type={type}
        disabled={disabled}
        onChange={e => setV(e.target.value)}
        onBlur={() => { if (v !== value) onSave(v); }}
        className="h-8 text-sm mt-0.5"
      />
    </div>
  );
}

function ScoreBlock({ label, value, onChange, disabled }: { label: string; value?: number; onChange: (n: number) => void; disabled?: boolean }) {
  return (
    <div className="rounded-md border p-2" style={{ borderColor: "#E7E3D6" }}>
      <div className="text-[10px] uppercase tracking-wide font-semibold text-center" style={{ color: "#767066" }}>{label}</div>
      <div className="flex justify-center gap-0.5 mt-1">
        {[1,2,3,4,5].map(n => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            className={cn(
              "w-6 h-6 rounded-full text-[11px] font-bold transition-colors",
              value === n ? "" : "bg-muted text-muted-foreground",
              disabled && "opacity-60"
            )}
            style={value === n ? { background: "#C9A84C", color: "#14432B" } : {}}
          >{n}</button>
        ))}
      </div>
    </div>
  );
}

function PhotoManager({ pasto, readOnly, onAdd, onDelete, onMove }: {
  pasto: Pasto; readOnly?: boolean;
  onAdd: (f: File) => void; onDelete: (f: Foto) => void; onMove: (i: number, d: -1 | 1) => void;
}) {
  const inputId = `photo-${pasto.id}`;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide font-semibold mb-1" style={{ color: "#767066" }}>
        Fotos ({pasto.fotos.length}/5)
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {pasto.fotos.map((f, i) => (
          <div key={f.id} className="aspect-square rounded-md overflow-hidden relative border" style={{ borderColor: "#E7E3D6" }}>
            {pasto.signed[f.id]
              ? <img src={pasto.signed[f.id]} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center bg-muted"><Loader2 className="w-3 h-3 animate-spin" /></div>}
            {!readOnly && (
              <>
                <button type="button" onClick={() => onDelete(f)}
                  className="absolute top-0.5 right-0.5 bg-destructive/90 rounded p-0.5">
                  <X className="w-3 h-3 text-destructive-foreground" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 flex justify-between px-0.5 pb-0.5">
                  <button type="button" onClick={() => onMove(i, -1)} disabled={i === 0}
                    className="bg-background/80 rounded p-0.5 disabled:opacity-30">
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button type="button" onClick={() => onMove(i, 1)} disabled={i === pasto.fotos.length - 1}
                    className="bg-background/80 rounded p-0.5 disabled:opacity-30">
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {!readOnly && pasto.fotos.length < 5 && (
          <label htmlFor={inputId} className="aspect-square rounded-md border border-dashed flex items-center justify-center cursor-pointer bg-muted/40"
            style={{ borderColor: "#E7E3D6" }}>
            <Camera className="w-4 h-4 text-muted-foreground" />
            <input id={inputId} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) onAdd(f); e.target.value = ""; }} />
          </label>
        )}
      </div>
    </div>
  );
}
