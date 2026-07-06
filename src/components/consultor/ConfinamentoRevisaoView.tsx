import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Camera, X, ChevronUp, ChevronDown, Check } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const BUCKET = "visitas-consultor-fotos";
const MAX_FOTOS = 10;

type ScoreKey = "fezes" | "corporal" | "bebedouro";

interface Foto { id: string; url: string; ordem: number; }
interface Curral {
  id: string;
  num_curral: string;
  organizacao_fabrica_nota: number | null;
  organizacao_insumos_nota: number | null;
  ordem: number;
  scores: { fezes?: number; corporal?: number; bebedouro?: number };
  fotos: Foto[];
  signed: Record<string, string>;
}
interface Visita {
  id: string; status: string; hora_inicio: string; hora_fim: string | null;
  observacoes_gerais: string | null; conclusao: string | null;
  fazenda_consultor_id: string; consultor_id: string;
}

async function signPath(path: string): Promise<string> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 6);
  return data?.signedUrl || "";
}

export default function ConfinamentoRevisaoView({ visitaId }: { visitaId: string }) {
  const navigate = useNavigate();
  const [visita, setVisita] = useState<Visita | null>(null);
  const [fazenda, setFazenda] = useState<any>(null);
  const [consultor, setConsultor] = useState<any>(null);
  const [currais, setCurrais] = useState<Curral[]>([]);
  const [obsGerais, setObsGerais] = useState("");
  const [conclusao, setConclusao] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => { load(); }, [visitaId]);

  async function load() {
    setLoading(true);
    const { data: v } = await supabase.from("visitas_tecnicas").select("*").eq("id", visitaId).maybeSingle();
    if (!v) { setLoading(false); return; }
    setVisita(v as any);
    setObsGerais(v.observacoes_gerais || "");
    setConclusao(v.conclusao || "");

    const [{ data: fz }, { data: cs }, { data: cr }] = await Promise.all([
      supabase.from("fazendas_consultor").select("*").eq("id", v.fazenda_consultor_id).maybeSingle(),
      supabase.from("consultores").select("*").eq("id", v.consultor_id).maybeSingle(),
      supabase.from("visita_currais").select("*").eq("visita_id", visitaId).order("ordem"),
    ]);
    setFazenda(fz); setConsultor(cs);

    const rows = (cr as any[]) || [];
    const ids = rows.map(r => r.id);
    const scoresBy: Record<string, any> = {};
    const fotosBy: Record<string, Foto[]> = {};
    if (ids.length) {
      const [{ data: sc }, { data: ft }] = await Promise.all([
        supabase.from("avaliacoes_score").select("visita_curral_id, tipo, nota").in("visita_curral_id", ids),
        supabase.from("visita_fotos").select("*").in("visita_curral_id", ids).order("ordem"),
      ]);
      (sc || []).forEach((s: any) => {
        scoresBy[s.visita_curral_id] = { ...(scoresBy[s.visita_curral_id] || {}), [s.tipo]: s.nota };
      });
      (ft || []).forEach((f: any) => {
        fotosBy[f.visita_curral_id] = [...(fotosBy[f.visita_curral_id] || []), f];
      });
    }
    const built: Curral[] = await Promise.all(rows.map(async r => {
      const fotos = fotosBy[r.id] || [];
      const signed: Record<string, string> = {};
      await Promise.all(fotos.map(async f => { signed[f.id] = await signPath(f.url); }));
      return { ...r, scores: scoresBy[r.id] || {}, fotos, signed } as Curral;
    }));
    setCurrais(built);
    setLoading(false);
  }

  function updateCurral(id: string, patch: Partial<Curral>) {
    setCurrais(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  }

  async function autosaveCurral(curralId: string, patch: Partial<Curral>) {
    const db: any = {};
    ["num_curral", "organizacao_fabrica_nota", "organizacao_insumos_nota"].forEach(k => {
      if (k in patch) db[k] = (patch as any)[k];
    });
    if (Object.keys(db).length === 0) return;
    const { error } = await supabase.from("visita_currais").update(db).eq("id", curralId);
    if (error) toast.error("Erro ao salvar: " + error.message);
  }

  async function setScore(curralId: string, tipo: ScoreKey, nota: number) {
    updateCurral(curralId, { scores: { ...currais.find(c => c.id === curralId)!.scores, [tipo]: nota } });
    await supabase.from("avaliacoes_score").delete().eq("visita_curral_id", curralId).eq("tipo", tipo);
    const { error } = await supabase.from("avaliacoes_score").insert({ visita_curral_id: curralId, tipo, nota });
    if (error) toast.error("Erro ao salvar nota");
  }

  async function autosaveVisita(patch: Partial<Visita>) {
    const { error } = await supabase.from("visitas_tecnicas").update(patch).eq("id", visitaId);
    if (error) toast.error("Erro ao salvar: " + error.message);
  }

  async function addFoto(curralId: string, file: File) {
    const c = currais.find(x => x.id === curralId); if (!c) return;
    if (c.fotos.length >= MAX_FOTOS) { toast.error(`Máx. ${MAX_FOTOS} fotos`); return; }
    const usadas = new Set(c.fotos.map(f => f.ordem));
    let ordem = 1;
    while (usadas.has(ordem) && ordem <= MAX_FOTOS) ordem++;
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `currais/${curralId}/${ordem}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
      if (error) throw error;
      const { data, error: insErr } = await supabase.from("visita_fotos")
        .insert({ visita_curral_id: curralId, url: path, ordem }).select().single();
      if (insErr) throw insErr;
      const url = await signPath((data as any).url);
      updateCurral(curralId, {
        fotos: [...c.fotos, data as Foto].sort((a, b) => a.ordem - b.ordem),
        signed: { ...c.signed, [(data as any).id]: url },
      });
    } catch (err: any) {
      toast.error("Erro ao enviar foto: " + (err?.message || ""));
    }
  }

  async function delFoto(curralId: string, f: Foto) {
    const c = currais.find(x => x.id === curralId); if (!c) return;
    await supabase.storage.from(BUCKET).remove([f.url]);
    await supabase.from("visita_fotos").delete().eq("id", f.id);
    updateCurral(curralId, { fotos: c.fotos.filter(x => x.id !== f.id) });
  }

  async function moveFoto(curralId: string, index: number, dir: -1 | 1) {
    const c = currais.find(x => x.id === curralId); if (!c) return;
    const arr = [...c.fotos];
    const j = index + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[index], arr[j]] = [arr[j], arr[index]];
    const updates = arr.map((f, i) => ({ ...f, ordem: i + 1 }));
    updateCurral(curralId, { fotos: updates });
    await Promise.all(updates.map(u =>
      supabase.from("visita_fotos").update({ ordem: u.ordem }).eq("id", u.id)
    ));
  }

  async function confirmarRevisao() {
    setConfirmando(true);
    try {
      await autosaveVisita({ observacoes_gerais: obsGerais, conclusao, status: "revisao" as any });
      toast.success("Visita revisada.");
      await load();
    } finally { setConfirmando(false); }
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!visita) return <div className="text-center py-12">Visita não encontrada</div>;

  const readOnly = visita.status === "finalizada";

  return (
    <div className="space-y-4 pb-24" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 -ml-2">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Button>

      {/* Header */}
      <div
        className="rounded-lg p-4 text-white"
        style={{ background: "#14432B", fontFamily: "'Manrope', sans-serif" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center font-extrabold text-lg" style={{ background: "#C9A84C", color: "#14432B" }}>C</div>
          <div>
            <div className="text-[10px] uppercase tracking-widest opacity-80">Revisão · Confinamento</div>
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

      {/* Blocos de curral */}
      <div className="space-y-3">
        {currais.map(c => (
          <div key={c.id} className="rounded-lg border bg-card" style={{ borderColor: "#E7E3D6" }}>
            <div className="flex items-center gap-3 p-3 border-b" style={{ borderColor: "#E7E3D6" }}>
              <div
                className="min-w-11 h-11 px-2 rounded-lg flex items-center justify-center font-extrabold text-base"
                style={{ background: "#14432B", color: "#C9A84C", fontFamily: "'Manrope', sans-serif" }}
              >
                {c.num_curral}
              </div>
              <div className="flex-1">
                <FieldInline
                  label="Nº Curral"
                  value={c.num_curral}
                  onSave={v => {
                    if (!v.trim()) return;
                    updateCurral(c.id, { num_curral: v });
                    autosaveCurral(c.id, { num_curral: v });
                  }}
                  disabled={readOnly}
                />
              </div>
            </div>

            <div className="p-3 space-y-3">
              {/* Scores 1-5 */}
              <div className="grid grid-cols-3 gap-2">
                <ScoreBlock label="Fezes" value={c.scores.fezes} onChange={n => setScore(c.id, "fezes", n)} disabled={readOnly} />
                <ScoreBlock label="Corporal" value={c.scores.corporal} onChange={n => setScore(c.id, "corporal", n)} disabled={readOnly} />
                <ScoreBlock label="Bebedouro" value={c.scores.bebedouro} onChange={n => setScore(c.id, "bebedouro", n)} disabled={readOnly} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ScoreBlock
                  label="Org. Fábrica"
                  value={c.organizacao_fabrica_nota ?? undefined}
                  onChange={n => { updateCurral(c.id, { organizacao_fabrica_nota: n }); autosaveCurral(c.id, { organizacao_fabrica_nota: n }); }}
                  disabled={readOnly}
                />
                <ScoreBlock
                  label="Org. Insumos"
                  value={c.organizacao_insumos_nota ?? undefined}
                  onChange={n => { updateCurral(c.id, { organizacao_insumos_nota: n }); autosaveCurral(c.id, { organizacao_insumos_nota: n }); }}
                  disabled={readOnly}
                />
              </div>

              {/* Fotos */}
              <PhotoManager
                curral={c}
                readOnly={readOnly}
                onAdd={f => addFoto(c.id, f)}
                onDelete={f => delFoto(c.id, f)}
                onMove={(i, d) => moveFoto(c.id, i, d)}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Observações & Conclusão */}
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

      {/* Botão fixo */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-background border-t z-10">
        <div className="max-w-md mx-auto flex gap-2">
          {visita.status !== "finalizada" && (
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

function PhotoManager({ curral, readOnly, onAdd, onDelete, onMove }: {
  curral: Curral; readOnly?: boolean;
  onAdd: (f: File) => void; onDelete: (f: Foto) => void; onMove: (i: number, d: -1 | 1) => void;
}) {
  const inputId = `photo-curral-${curral.id}`;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide font-semibold mb-1" style={{ color: "#767066" }}>
        Fotos ({curral.fotos.length}/{MAX_FOTOS})
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {curral.fotos.map((f, i) => (
          <div key={f.id} className="aspect-square rounded-md overflow-hidden relative border" style={{ borderColor: "#E7E3D6" }}>
            {curral.signed[f.id]
              ? <img src={curral.signed[f.id]} alt="" className="w-full h-full object-cover" />
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
                  <button type="button" onClick={() => onMove(i, 1)} disabled={i === curral.fotos.length - 1}
                    className="bg-background/80 rounded p-0.5 disabled:opacity-30">
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {!readOnly && curral.fotos.length < MAX_FOTOS && (
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
