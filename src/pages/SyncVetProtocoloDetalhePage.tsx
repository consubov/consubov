import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, ArrowLeft, Trash2, Pencil, Save } from "lucide-react";

type Proto = { id: string; nome: string; descricao: string | null };
type Etapa = { id: string; protocolo_id: string; dia_offset: number; nome_etapa: string | null; codigo_preco: string | null };
type Item = {
  id: string;
  etapa_id: string;
  medicamento_id: string | null;
  descricao: string;
  dosagem: string | null;
  observacoes: string | null;
  ordem: number;
};
type Med = { id: string; nome_comercial: string; dosagem_padrao: string | null };
type PrecoOpt = { tipo_servico: string; descricao: string | null; valor: number };

export default function SyncVetProtocoloDetalhePage() {
  const { protocoloId } = useParams<{ protocoloId: string }>();
  const navigate = useNavigate();
  const { user, roleData } = useAuth();
  const empresaId = roleData.syncvetEmpresaId ?? null;

  const [proto, setProto] = useState<Proto | null>(null);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [itens, setItens] = useState<Item[]>([]);
  const [meds, setMeds] = useState<Med[]>([]);
  const [precos, setPrecos] = useState<PrecoOpt[]>([]);
  const [loading, setLoading] = useState(true);

  const [editHeader, setEditHeader] = useState(false);
  const [headerNome, setHeaderNome] = useState("");
  const [headerDesc, setHeaderDesc] = useState("");

  // Etapa dialog
  const [etapaOpen, setEtapaOpen] = useState(false);
  const [etapaEditing, setEtapaEditing] = useState<Etapa | null>(null);
  const [dia, setDia] = useState<string>("0");
  const [nomeEtapa, setNomeEtapa] = useState("");
  const [codigoPreco, setCodigoPreco] = useState<string>("__none__");

  // Item dialog
  const [itemOpen, setItemOpen] = useState(false);
  const [itemEtapaId, setItemEtapaId] = useState<string | null>(null);
  const [itemEditing, setItemEditing] = useState<Item | null>(null);
  const [itemTipo, setItemTipo] = useState<"medicamento" | "procedimento">("medicamento");
  const [itemMedId, setItemMedId] = useState<string>("");
  const [itemDesc, setItemDesc] = useState("");
  const [itemDosagem, setItemDosagem] = useState("");
  const [itemObs, setItemObs] = useState("");

  async function load() {
    if (!protocoloId) return;
    setLoading(true);
    // resolve vetId (equipe do usuário logado nessa empresa)
    let vetId: string | null = null;
    if (empresaId && user?.id) {
      const { data: eq } = await supabase.from("syncvet_equipe")
        .select("id").eq("empresa_id", empresaId).eq("user_id", user.id).eq("ativo", true).maybeSingle();
      vetId = (eq as any)?.id ?? null;
    }
    const [p, e, i, m, pr] = await Promise.all([
      supabase.from("syncvet_protocolos").select("*").eq("id", protocoloId).maybeSingle(),
      supabase.from("syncvet_protocolo_etapas").select("*").eq("protocolo_id", protocoloId),
      supabase.from("syncvet_protocolo_etapa_itens").select("*"),
      empresaId
        ? supabase.from("syncvet_medicamentos").select("id, nome_comercial, dosagem_padrao").eq("empresa_id", empresaId).order("nome_comercial")
        : Promise.resolve({ data: [], error: null } as any),
      vetId
        ? supabase.from("syncvet_tabela_precos").select("tipo_servico, descricao, valor").eq("veterinario_id", vetId).order("tipo_servico")
        : Promise.resolve({ data: [], error: null } as any),
    ]);
    if (p.error) toast.error(p.error.message);
    if (p.data) {
      setProto(p.data as Proto);
      setHeaderNome((p.data as Proto).nome);
      setHeaderDesc((p.data as Proto).descricao ?? "");
    }
    const et = ((e.data as Etapa[]) ?? []).sort((a, b) => a.dia_offset - b.dia_offset);
    setEtapas(et);
    const etIds = new Set(et.map((x) => x.id));
    setItens(((i.data as Item[]) ?? []).filter((x) => etIds.has(x.etapa_id)).sort((a, b) => a.ordem - b.ordem));
    setMeds((m.data as Med[]) ?? []);
    setPrecos((pr.data as PrecoOpt[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [protocoloId, empresaId, user?.id]);

  async function saveHeader() {
    if (!proto) return;
    const { error } = await supabase
      .from("syncvet_protocolos")
      .update({ nome: headerNome.trim(), descricao: headerDesc || null })
      .eq("id", proto.id);
    if (error) toast.error(error.message);
    else { toast.success("Protocolo atualizado"); setEditHeader(false); load(); }
  }

  function openNewEtapa() {
    setEtapaEditing(null); setDia("0"); setNomeEtapa(""); setCodigoPreco("__none__"); setEtapaOpen(true);
  }
  function openEditEtapa(e: Etapa) {
    setEtapaEditing(e); setDia(String(e.dia_offset)); setNomeEtapa(e.nome_etapa ?? "");
    setCodigoPreco(e.codigo_preco ?? "__none__");
    setEtapaOpen(true);
  }
  async function saveEtapa() {
    if (!protocoloId) return;
    const d = parseInt(dia, 10);
    if (isNaN(d) || d < 0) { toast.error("Dia (D+) deve ser um número ≥ 0"); return; }
    const payload = {
      protocolo_id: protocoloId,
      dia_offset: d,
      nome_etapa: nomeEtapa || null,
      codigo_preco: codigoPreco === "__none__" ? null : codigoPreco,
    };
    if (etapaEditing) {
      const { error } = await supabase.from("syncvet_protocolo_etapas").update(payload).eq("id", etapaEditing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("syncvet_protocolo_etapas").insert(payload as any);
      if (error) return toast.error(error.message);
    }
    toast.success("Etapa salva");
    setEtapaOpen(false); load();
  }
  async function deleteEtapa(e: Etapa) {
    if (!confirm(`Remover etapa D+${e.dia_offset}?`)) return;
    const { error } = await supabase.from("syncvet_protocolo_etapas").delete().eq("id", e.id);
    if (error) toast.error(error.message);
    else { toast.success("Removida"); load(); }
  }

  function openNewItem(etapaId: string) {
    setItemEtapaId(etapaId); setItemEditing(null);
    setItemTipo("medicamento"); setItemMedId(""); setItemDesc(""); setItemDosagem(""); setItemObs("");
    setItemOpen(true);
  }
  function openEditItem(it: Item) {
    setItemEtapaId(it.etapa_id); setItemEditing(it);
    setItemTipo(it.medicamento_id ? "medicamento" : "procedimento");
    setItemMedId(it.medicamento_id ?? "");
    setItemDesc(it.descricao); setItemDosagem(it.dosagem ?? ""); setItemObs(it.observacoes ?? "");
    setItemOpen(true);
  }
  function onMedChange(id: string) {
    setItemMedId(id);
    const m = meds.find((x) => x.id === id);
    if (m) {
      setItemDesc(m.nome_comercial);
      if (!itemDosagem) setItemDosagem(m.dosagem_padrao ?? "");
    }
  }
  async function saveItem() {
    if (!itemEtapaId) return;
    if (itemTipo === "medicamento" && !itemMedId) { toast.error("Selecione um medicamento"); return; }
    if (!itemDesc.trim()) { toast.error("Descrição é obrigatória"); return; }
    const currentCount = itens.filter((x) => x.etapa_id === itemEtapaId).length;
    const payload = {
      etapa_id: itemEtapaId,
      medicamento_id: itemTipo === "medicamento" ? itemMedId : null,
      descricao: itemDesc.trim(),
      dosagem: itemDosagem || null,
      observacoes: itemObs || null,
      ordem: itemEditing ? itemEditing.ordem : currentCount,
    };
    if (itemEditing) {
      const { error } = await supabase.from("syncvet_protocolo_etapa_itens").update(payload).eq("id", itemEditing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("syncvet_protocolo_etapa_itens").insert(payload as any);
      if (error) return toast.error(error.message);
    }
    toast.success("Item salvo");
    setItemOpen(false); load();
  }
  async function deleteItem(it: Item) {
    if (!confirm("Remover item?")) return;
    const { error } = await supabase.from("syncvet_protocolo_etapa_itens").delete().eq("id", it.id);
    if (error) toast.error(error.message);
    else { toast.success("Removido"); load(); }
  }

  const itensPorEtapa = useMemo(() => {
    const map: Record<string, Item[]> = {};
    for (const it of itens) (map[it.etapa_id] ||= []).push(it);
    return map;
  }, [itens]);

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!proto) {
    return <Card className="p-6 text-center text-sm text-muted-foreground">Protocolo não encontrado.</Card>;
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate("/syncvet/protocolos")}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
      </Button>

      <Card className="p-4">
        {editHeader ? (
          <div className="space-y-3">
            <div><Label className="text-xs">Nome*</Label><Input value={headerNome} onChange={(e) => setHeaderNome(e.target.value)} /></div>
            <div><Label className="text-xs">Descrição</Label><Textarea rows={2} value={headerDesc} onChange={(e) => setHeaderDesc(e.target.value)} /></div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => { setEditHeader(false); setHeaderNome(proto.nome); setHeaderDesc(proto.descricao ?? ""); }}>Cancelar</Button>
              <Button onClick={saveHeader}><Save className="w-4 h-4 mr-1" />Salvar</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">{proto.nome}</h1>
              {proto.descricao && <p className="text-sm text-muted-foreground">{proto.descricao}</p>}
            </div>
            <Button variant="ghost" size="icon" onClick={() => setEditHeader(true)}><Pencil className="w-4 h-4" /></Button>
          </div>
        )}
      </Card>

      {/* Resumo visual — linha do tempo */}
      {etapas.length > 0 && (
        <Card className="p-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Linha do tempo</div>
          <div className="flex items-center gap-1 flex-wrap">
            {etapas.map((e, idx) => (
              <div key={e.id} className="flex items-center gap-1">
                <div className="px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  D+{e.dia_offset}
                </div>
                {idx < etapas.length - 1 && <span className="text-muted-foreground">→</span>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">Etapas</h2>
        <Button size="sm" onClick={openNewEtapa}><Plus className="w-4 h-4 mr-1" />Etapa</Button>
      </div>

      {etapas.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Adicione a primeira etapa (ex: D+0).</Card>
      ) : (
        <div className="space-y-3">
          {etapas.map((e) => {
            const list = itensPorEtapa[e.id] ?? [];
            return (
              <Card key={e.id} className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">D+{e.dia_offset}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{e.nome_etapa || `Etapa D+${e.dia_offset}`}</div>
                    {e.codigo_preco && (
                      <div className="text-[10px] text-muted-foreground">Preço: <span className="font-semibold text-primary">{e.codigo_preco}</span></div>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => openEditEtapa(e)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteEtapa(e)}><Trash2 className="w-4 h-4" /></Button>
                </div>

                {list.length === 0 ? (
                  <div className="text-xs text-muted-foreground pl-1 mb-2">Sem itens ainda.</div>
                ) : (
                  <div className="space-y-1.5 mb-2">
                    {list.map((it) => (
                      <div key={it.id} className="flex items-start gap-2 p-2 rounded-md bg-muted/40">
                        <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${it.medicamento_id ? "bg-primary" : "bg-secondary"}`} />
                        <div className="flex-1 min-w-0 text-sm">
                          <div className="font-medium truncate">{it.descricao}</div>
                          {(it.dosagem || it.observacoes) && (
                            <div className="text-xs text-muted-foreground">
                              {[it.dosagem, it.observacoes].filter(Boolean).join(" • ")}
                            </div>
                          )}
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => openEditItem(it)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteItem(it)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    ))}
                  </div>
                )}

                <Button variant="outline" size="sm" onClick={() => openNewItem(e.id)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar item
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {/* Etapa dialog */}
      <Dialog open={etapaOpen} onOpenChange={setEtapaOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{etapaEditing ? "Editar etapa" : "Nova etapa"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Dia (D+)*</Label><Input type="number" min="0" value={dia} onChange={(e) => setDia(e.target.value)} /></div>
            <div><Label className="text-xs">Nome da etapa</Label><Input value={nomeEtapa} onChange={(e) => setNomeEtapa(e.target.value)} placeholder="Ex: Implante + BE" /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEtapaOpen(false)}>Cancelar</Button>
            <Button onClick={saveEtapa}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item dialog */}
      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{itemEditing ? "Editar item" : "Novo item"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={itemTipo} onValueChange={(v) => setItemTipo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="medicamento">Medicamento</SelectItem>
                  <SelectItem value="procedimento">Procedimento (sem medicamento)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {itemTipo === "medicamento" ? (
              <>
                <div>
                  <Label className="text-xs">Medicamento*</Label>
                  <Select value={itemMedId} onValueChange={onMedChange}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {meds.length === 0 ? (
                        <div className="p-2 text-xs text-muted-foreground">Nenhum medicamento cadastrado.</div>
                      ) : meds.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.nome_comercial}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Descrição*</Label><Input value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} /></div>
                <div><Label className="text-xs">Dosagem</Label><Input value={itemDosagem} onChange={(e) => setItemDosagem(e.target.value)} placeholder="Padrão do medicamento — pode sobrescrever" /></div>
              </>
            ) : (
              <>
                <div><Label className="text-xs">Descrição*</Label><Input value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} placeholder="Ex: Ultrassom, IATF, DG" /></div>
              </>
            )}
            <div><Label className="text-xs">Observações</Label><Textarea rows={2} value={itemObs} onChange={(e) => setItemObs(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setItemOpen(false)}>Cancelar</Button>
            <Button onClick={saveItem}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
