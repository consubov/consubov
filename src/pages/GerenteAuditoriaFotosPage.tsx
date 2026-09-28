import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { GerenteFazendaSelect, useGerenteFazendaAtiva } from "@/components/gerente/GerenteFazendaSelect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Pencil } from "lucide-react";
import {
  AUDITORIA_FOTOS_PADRAO, EXIGIR_FOTO_COCHO_PADRAO, descreverAuditoria, resolverAuditoria,
  salvarAuditoriaFazenda, salvarAuditoriaRetiro,
} from "@/lib/auditoriaConfig";
import IntervaloSalgasCard from "@/components/gerente/IntervaloSalgasCard";

interface RetiroCfg { id: string; nome: string; auditoria_fotos_por_bloco: number | null; exigir_foto_cocho: boolean | null }
interface FazCfg { auditoria_fotos_por_bloco: number | null; exigir_foto_cocho: boolean | null }

const SEGUIR = "seguir";
const fotosOpts = Array.from({ length: 11 }, (_, i) => i);

function fotosLabel(n: number) {
  return n === 0 ? "Não exigir foto" : `${n} foto${n > 1 ? "s" : ""} a cada 10 salgas`;
}

export default function GerenteAuditoriaFotosPage() {
  const navigate = useNavigate();
  const { roleData } = useAuth();
  const { fazendas, fazendaId, setFazendaId, carregado } = useGerenteFazendaAtiva();
  const [faz, setFaz] = useState<FazCfg>({ auditoria_fotos_por_bloco: null, exigir_foto_cocho: null });
  const [retiros, setRetiros] = useState<RetiroCfg[]>([]);
  const [draftFaz, setDraftFaz] = useState<FazCfg>(faz);
  const [draftRet, setDraftRet] = useState<RetiroCfg[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editInt, setEditInt] = useState(false);

  // Fazenda ativa compartilhada com o Painel do Gerente.
  useEffect(() => { if (carregado && !fazendaId) setLoading(false); }, [carregado, fazendaId]);

  async function load(id: string) {
    setLoading(true);
    const [{ data: f }, { data: r }] = await Promise.all([
      supabase.from("fazendas").select("auditoria_fotos_por_bloco, exigir_foto_cocho").eq("id", id).maybeSingle(),
      supabase.from("retiros").select("id, nome, auditoria_fotos_por_bloco, exigir_foto_cocho").eq("fazenda_id", id).order("nome"),
    ]);
    setFaz({ auditoria_fotos_por_bloco: (f as any)?.auditoria_fotos_por_bloco ?? null, exigir_foto_cocho: (f as any)?.exigir_foto_cocho ?? null });
    setRetiros((r ?? []) as any);
    setEditing(false);
    setLoading(false);
  }

  useEffect(() => { if (fazendaId) void load(fazendaId); }, [fazendaId]);

  function startEdit() {
    setDraftFaz({
      auditoria_fotos_por_bloco: faz.auditoria_fotos_por_bloco ?? AUDITORIA_FOTOS_PADRAO,
      exigir_foto_cocho: faz.exigir_foto_cocho ?? EXIGIR_FOTO_COCHO_PADRAO,
    });
    setDraftRet(retiros.map((r) => ({ ...r })));
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    try {
      const { error } = await salvarAuditoriaFazenda(fazendaId, {
        auditoria_fotos_por_bloco: draftFaz.auditoria_fotos_por_bloco ?? AUDITORIA_FOTOS_PADRAO,
        exigir_foto_cocho: draftFaz.exigir_foto_cocho ?? EXIGIR_FOTO_COCHO_PADRAO,
      });
      if (error) throw error;
      for (const r of draftRet) {
        const orig = retiros.find((o) => o.id === r.id);
        if (orig && orig.auditoria_fotos_por_bloco === r.auditoria_fotos_por_bloco && orig.exigir_foto_cocho === r.exigir_foto_cocho) continue;
        const { error: e2 } = await salvarAuditoriaRetiro(r.id, { auditoria_fotos_por_bloco: r.auditoria_fotos_por_bloco, exigir_foto_cocho: r.exigir_foto_cocho });
        if (e2) throw e2;
      }
      toast.success("Configuração salva");
      await load(fazendaId);
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message ?? ""));
    } finally {
      setSaving(false);
    }
  }

  const fazEf = resolverAuditoria(null, faz);
  const draftFazEf = resolverAuditoria(null, draftFaz);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground p-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/gerente")} className="text-primary-foreground hover:bg-primary-foreground/10">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-base font-bold">Intervalo e Auditoria</h1>
      </header>
      <main className="p-4 space-y-4 max-w-2xl mx-auto">
        <GerenteFazendaSelect fazendas={fazendas} value={fazendaId} onChange={setFazendaId} dirty={editing || editInt} />
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : !fazendaId ? (
          <p className="text-sm text-muted-foreground">Nenhuma fazenda vinculada.</p>
        ) : (
          <>
            <IntervaloSalgasCard fazendaId={fazendaId} onEditingChange={setEditInt} />
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Padrão da fazenda</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {!editing ? (
                  <p className="text-sm text-foreground">{descreverAuditoria(fazEf.fotosPorBloco, fazEf.exigirFotoCocho)}</p>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Fotos de auditoria da salga</label>
                      <Select value={String(draftFazEf.fotosPorBloco)} onValueChange={(v) => setDraftFaz((d) => ({ ...d, auditoria_fotos_por_bloco: Number(v) }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{fotosOpts.map((n) => <SelectItem key={n} value={String(n)}>{fotosLabel(n)}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Foto do Cocho Cheio</label>
                      <Select value={draftFazEf.exigirFotoCocho ? "sim" : "nao"} onValueChange={(v) => setDraftFaz((d) => ({ ...d, exigir_foto_cocho: v === "sim" }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sim">Obrigatória</SelectItem>
                          <SelectItem value="nao">Opcional</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Por retiro</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {(editing ? draftRet : retiros).map((r) => {
                  const base = editing ? draftFaz : faz;
                  const ef = resolverAuditoria(r, base);
                  if (!editing) {
                    const proprio = r.auditoria_fotos_por_bloco != null || r.exigir_foto_cocho != null;
                    return (
                      <div key={r.id} className="text-sm border rounded-md p-2">
                        <span className="font-medium">{r.nome}:</span>{" "}
                        <span className="text-muted-foreground">{descreverAuditoria(ef.fotosPorBloco, ef.exigirFotoCocho)}{proprio ? "" : " (segue a fazenda)"}</span>
                      </div>
                    );
                  }
                  const upd = (patch: Partial<RetiroCfg>) => setDraftRet((list) => list.map((x) => (x.id === r.id ? { ...x, ...patch } : x)));
                  return (
                    <div key={r.id} className="border rounded-md p-2 space-y-2">
                      <div className="text-sm font-medium">{r.nome}</div>
                      <Select value={r.auditoria_fotos_por_bloco == null ? SEGUIR : String(r.auditoria_fotos_por_bloco)} onValueChange={(v) => upd({ auditoria_fotos_por_bloco: v === SEGUIR ? null : Number(v) })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SEGUIR}>Fotos: seguir a fazenda</SelectItem>
                          {fotosOpts.map((n) => <SelectItem key={n} value={String(n)}>{fotosLabel(n)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={r.exigir_foto_cocho == null ? SEGUIR : r.exigir_foto_cocho ? "sim" : "nao"} onValueChange={(v) => upd({ exigir_foto_cocho: v === SEGUIR ? null : v === "sim" })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SEGUIR}>Cocho: seguir a fazenda</SelectItem>
                          <SelectItem value="sim">Cocho: foto obrigatória</SelectItem>
                          <SelectItem value="nao">Cocho: foto opcional</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
                {retiros.length === 0 && <p className="text-sm text-muted-foreground">Nenhum retiro nesta fazenda.</p>}
              </CardContent>
            </Card>

            {!editing ? (
              <Button onClick={startEdit} className="w-full gap-2"><Pencil className="w-4 h-4" /> Editar</Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditing(false)} disabled={saving}>Cancelar</Button>
                <Button className="flex-1" onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Salvar</Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">O Capataz recebe a nova configuração quando abrir o retiro com internet.</p>
          </>
        )}
      </main>
    </div>
  );
}
