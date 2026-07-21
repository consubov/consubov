import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, ChevronRight, ArrowLeft, CalendarDays } from "lucide-react";

type Lote = {
  id: string;
  nome: string;
  categoria: string | null;
  quantidade_animais: number | null;
  observacoes: string | null;
};

type Estacao = {
  id: string;
  fazenda_id: string;
  nome: string;
  data_inicio: string | null;
  data_fim: string | null;
  status: string;
  observacoes: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  planejada: "Planejada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export default function SyncVetFazendaDetalhePage() {
  const { fazendaId } = useParams<{ fazendaId: string }>();
  const navigate = useNavigate();
  const [fazendaNome, setFazendaNome] = useState("");
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [estacoes, setEstacoes] = useState<Estacao[]>([]);
  const [loading, setLoading] = useState(true);

  // Lote dialog
  const [loteOpen, setLoteOpen] = useState(false);
  const [loteSaving, setLoteSaving] = useState(false);
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [qtd, setQtd] = useState("");
  const [obs, setObs] = useState("");

  // Estacao dialog
  const [estOpen, setEstOpen] = useState(false);
  const [estSaving, setEstSaving] = useState(false);
  const [estNome, setEstNome] = useState("");
  const [estIni, setEstIni] = useState("");
  const [estFim, setEstFim] = useState("");
  const [estObs, setEstObs] = useState("");

  async function load() {
    if (!fazendaId) return;
    setLoading(true);
    const [{ data: f }, { data: ls, error: lerr }, { data: es, error: eerr }] = await Promise.all([
      supabase.from("syncvet_fazendas").select("nome").eq("id", fazendaId).maybeSingle(),
      supabase.from("syncvet_lotes").select("*").eq("fazenda_id", fazendaId).order("nome"),
      (supabase as any).from("syncvet_estacoes_monta").select("*").eq("fazenda_id", fazendaId).order("data_inicio", { ascending: false }),
    ]);
    if (lerr) toast.error(lerr.message);
    if (eerr) toast.error(eerr.message);
    setFazendaNome((f as any)?.nome ?? "");
    setLotes((ls as any) ?? []);
    setEstacoes((es as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [fazendaId]);

  function openNewLote() {
    setNome(""); setCategoria(""); setQtd(""); setObs(""); setLoteOpen(true);
  }
  async function saveLote() {
    if (!fazendaId) return;
    if (!nome.trim()) { toast.error("Nome do lote é obrigatório"); return; }
    setLoteSaving(true);
    const { error } = await supabase.from("syncvet_lotes").insert({
      fazenda_id: fazendaId,
      nome: nome.trim(),
      categoria: categoria || null,
      quantidade_animais: qtd ? Number(qtd) : null,
      observacoes: obs || null,
    } as any);
    if (error) toast.error(error.message);
    else { toast.success("Lote criado"); setLoteOpen(false); load(); }
    setLoteSaving(false);
  }

  function openNewEstacao() {
    setEstNome(""); setEstIni(""); setEstFim(""); setEstObs(""); setEstOpen(true);
  }
  async function saveEstacao() {
    if (!fazendaId) return;
    if (!estNome.trim()) { toast.error("Nome da estação é obrigatório"); return; }
    setEstSaving(true);
    const { error } = await (supabase as any).from("syncvet_estacoes_monta").insert({
      fazenda_id: fazendaId,
      nome: estNome.trim(),
      data_inicio: estIni || null,
      data_fim: estFim || null,
      status: "planejada",
      observacoes: estObs || null,
    });
    if (error) toast.error(error.message);
    else { toast.success("Estação criada"); setEstOpen(false); load(); }
    setEstSaving(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/syncvet/fazendas")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{fazendaNome || "Fazenda"}</h1>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Tabs defaultValue="lotes">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="lotes">Lotes</TabsTrigger>
            <TabsTrigger value="estacoes">Estação de Monta</TabsTrigger>
          </TabsList>

          <TabsContent value="lotes" className="space-y-3 mt-3">
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => navigate(`/syncvet/fazendas/${fazendaId}/novo-manejo`)}>
                <Plus className="w-4 h-4 mr-1" />Novo manejo
              </Button>
              <Dialog open={loteOpen} onOpenChange={setLoteOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openNewLote}><Plus className="w-4 h-4 mr-1" />Novo lote</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Novo lote</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label className="text-xs">Nome*</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
                    <div><Label className="text-xs">Categoria</Label><Input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Ex: Novilhas, Vacas em lactação" /></div>
                    <div><Label className="text-xs">Quantidade de animais</Label><Input type="number" value={qtd} onChange={(e) => setQtd(e.target.value)} /></div>
                    <div><Label className="text-xs">Observações</Label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} /></div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setLoteOpen(false)}>Cancelar</Button>
                    <Button onClick={saveLote} disabled={loteSaving}>
                      {loteSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {lotes.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum lote cadastrado nesta fazenda.</Card>
            ) : (
              <div className="space-y-2">
                {lotes.map((l) => (
                  <Card
                    key={l.id}
                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/syncvet/fazendas/${fazendaId}/lotes/${l.id}`)}
                  >
                    <div>
                      <div className="font-semibold">{l.nome}</div>
                      <div className="text-xs text-muted-foreground">
                        {[l.categoria, l.quantidade_animais ? `${l.quantidade_animais} animais` : null]
                          .filter(Boolean).join(" • ")}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="estacoes" className="space-y-3 mt-3">
            <div className="flex justify-end">
              <Dialog open={estOpen} onOpenChange={setEstOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openNewEstacao}><Plus className="w-4 h-4 mr-1" />Nova Estação de Monta</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Nova estação de monta</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label className="text-xs">Nome*</Label><Input value={estNome} onChange={(e) => setEstNome(e.target.value)} placeholder="Ex: Estação 2026" /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label className="text-xs">Data início</Label><Input type="date" value={estIni} onChange={(e) => setEstIni(e.target.value)} /></div>
                      <div><Label className="text-xs">Data fim</Label><Input type="date" value={estFim} onChange={(e) => setEstFim(e.target.value)} /></div>
                    </div>
                    <div><Label className="text-xs">Observações</Label><Textarea value={estObs} onChange={(e) => setEstObs(e.target.value)} /></div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setEstOpen(false)}>Cancelar</Button>
                    <Button onClick={saveEstacao} disabled={estSaving}>
                      {estSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {estacoes.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">Nenhuma estação cadastrada.</Card>
            ) : (
              <div className="space-y-2">
                {estacoes.map((e) => (
                  <Card
                    key={e.id}
                    className="p-3 flex items-center gap-3 cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/syncvet/fazendas/${fazendaId}/estacoes/${e.id}`)}
                  >
                    <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <CalendarDays className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{e.nome}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {fmtDate(e.data_inicio)} → {fmtDate(e.data_fim)} • {STATUS_LABEL[e.status] ?? e.status}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
