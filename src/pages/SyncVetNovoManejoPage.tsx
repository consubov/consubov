import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Syringe, ClipboardCheck, LogOut } from "lucide-react";


type TipoManejo = "dg_us" | "iatf" | "retirada";

type Lote = { id: string; nome: string };
type Protocolo = { id: string; nome: string };
type Semen = { id: string; touro: string; codigo: string | null };
type Equipe = { id: string; nome: string };

export default function SyncVetNovoManejoPage() {
  const { fazendaId } = useParams<{ fazendaId: string }>();
  const navigate = useNavigate();

  const [fazendaNome, setFazendaNome] = useState("");
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [protocolos, setProtocolos] = useState<Protocolo[]>([]);
  const [semens, setSemens] = useState<Semen[]>([]);
  const [equipe, setEquipe] = useState<Equipe[]>([]);
  const [precos, setPrecos] = useState<{ tipo_servico: string; descricao: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  const [tipo, setTipo] = useState<TipoManejo>("dg_us");
  const [loteId, setLoteId] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [responsavelId, setResponsavelId] = useState("");
  const [codigoPreco, setCodigoPreco] = useState<string>("DG/US");

  // IATF
  const [fonteProtocolo, setFonteProtocolo] = useState<"veterinario" | "fazenda">("veterinario");
  const [protocoloId, setProtocoloId] = useState("");
  const [protocoloFazenda, setProtocoloFazenda] = useState("");
  const [fonteSemen, setFonteSemen] = useState<"veterinario" | "fazenda">("veterinario");
  const [semenId, setSemenId] = useState("");
  const [semenFazenda, setSemenFazenda] = useState("");

  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (!fazendaId) return;
      setLoading(true);
      const [{ data: f }, { data: ls }, { data: ps }, { data: ss }, { data: eq }, { data: me }] = await Promise.all([
        supabase.from("syncvet_fazendas").select("nome, empresa_id").eq("id", fazendaId).maybeSingle(),
        supabase.from("syncvet_lotes").select("id, nome").eq("fazenda_id", fazendaId).order("nome"),
        supabase.from("syncvet_protocolos").select("id, nome").order("nome"),
        supabase.from("syncvet_semen").select("id, touro, codigo").order("touro"),
        supabase.from("syncvet_equipe").select("id, nome, user_id").order("nome"),
        supabase.auth.getUser(),
      ]);
      setFazendaNome((f as any)?.nome ?? "");
      setLotes((ls as any) ?? []);
      setProtocolos((ps as any) ?? []);
      setSemens((ss as any) ?? []);
      setEquipe((eq as any) ?? []);
      // Pré-seleciona o próprio usuário se estiver na equipe
      const uid = me.user?.id;
      const meRec = (eq as any[] | null)?.find(e => e.user_id === uid);
      if (meRec) setResponsavelId(meRec.id);
      setLoading(false);
    })();
  }, [fazendaId]);

  // Carrega tabela de preços do responsável selecionado
  useEffect(() => {
    (async () => {
      if (!responsavelId) { setPrecos([]); return; }
      const { data } = await supabase.from("syncvet_tabela_precos")
        .select("tipo_servico, descricao").eq("veterinario_id", responsavelId).order("tipo_servico");
      setPrecos((data as any) ?? []);
    })();
  }, [responsavelId]);

  // Sugestão automática de codigo_preco por tipo
  useEffect(() => {
    const map: Record<TipoManejo, string[]> = {
      dg_us: ["DG/US", "DG", "US", "Diagnóstico"],
      iatf: ["IATF"],
      retirada: ["Retirada", "Retirada de Implante"],
    };
    const options = map[tipo];
    const match = precos.find(p => options.some(o => p.tipo_servico.toLowerCase().includes(o.toLowerCase())));
    if (match) setCodigoPreco(match.tipo_servico);
    else setCodigoPreco(options[0]);
  }, [tipo, precos]);

  async function handleIniciar() {
    if (!fazendaId) return;
    if (!loteId) { toast.error("Selecione um lote"); return; }
    if (!responsavelId) { toast.error("Selecione o responsável"); return; }

    setSaving(true);
    try {
      const payload: any = {
        fazenda_id: fazendaId,
        lote_id: loteId,
        tipo_manejo: tipo,
        responsavel_id: responsavelId,
        data_prevista: data,
        status: "em_andamento",
        hora_inicio: new Date().toISOString(),
      };

      if (tipo === "iatf") {
        payload.fonte_protocolo = fonteProtocolo;
        if (fonteProtocolo === "veterinario") {
          if (!protocoloId) { toast.error("Selecione o protocolo"); setSaving(false); return; }
          payload.protocolo_id = protocoloId;
        } else {
          if (!protocoloFazenda.trim()) { toast.error("Descreva o protocolo da fazenda"); setSaving(false); return; }
          payload.observacoes = `Protocolo (fazenda): ${protocoloFazenda.trim()}`;
        }
        payload.fonte_semen = fonteSemen;
        if (fonteSemen === "veterinario") {
          if (!semenId) { toast.error("Selecione o sêmen"); setSaving(false); return; }
          payload.semen_id = semenId;
        } else {
          if (!semenFazenda.trim()) { toast.error("Descreva o sêmen da fazenda"); setSaving(false); return; }
          payload.semen_descricao_fazenda = semenFazenda.trim();
        }
      }

      if (obs.trim()) {
        payload.observacoes = (payload.observacoes ? payload.observacoes + " | " : "") + obs.trim();
      }

      const { data: novo, error } = await (supabase as any)
        .from("syncvet_manejos")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;




      toast.success("Manejo iniciado");
      navigate(`/syncvet/manejos/${novo.id}/executar`);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao iniciar manejo");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/syncvet/fazendas/${fazendaId}`)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Novo Manejo</h1>
          <p className="text-sm text-muted-foreground">{fazendaNome}</p>
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <Label className="text-xs">Tipo de manejo</Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {([
            { v: "dg_us", label: "DG/US", icon: ClipboardCheck },
            { v: "iatf", label: "IATF", icon: Syringe },
            { v: "retirada", label: "Retirada", icon: LogOut },
          ] as const).map(({ v, label, icon: Icon }) => (
            <button
              key={v}
              type="button"
              onClick={() => setTipo(v)}
              className={`flex items-center gap-2 rounded-md border p-3 text-sm transition ${
                tipo === v ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border hover:bg-muted/50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Lote *</Label>
          <Select value={loteId} onValueChange={setLoteId}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {lotes.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Data</Label>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs">Responsável *</Label>
          <Select value={responsavelId} onValueChange={setResponsavelId}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {equipe.map(e => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {tipo === "iatf" && (
        <Card className="p-4 space-y-4">
          <div>
            <Label className="text-xs">Protocolo</Label>
            <RadioGroup value={fonteProtocolo} onValueChange={(v) => setFonteProtocolo(v as any)} className="flex gap-4 mt-1">
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="veterinario" /> Do veterinário</label>
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="fazenda" /> Fornecido pela fazenda</label>
            </RadioGroup>
            {fonteProtocolo === "veterinario" ? (
              <Select value={protocoloId} onValueChange={setProtocoloId}>
                <SelectTrigger className="mt-2"><SelectValue placeholder="Selecione o protocolo" /></SelectTrigger>
                <SelectContent>
                  {protocolos.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input className="mt-2" value={protocoloFazenda} onChange={(e) => setProtocoloFazenda(e.target.value)} placeholder="Descreva o protocolo" />
            )}
          </div>

          <div>
            <Label className="text-xs">Sêmen</Label>
            <RadioGroup value={fonteSemen} onValueChange={(v) => setFonteSemen(v as any)} className="flex gap-4 mt-1">
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="veterinario" /> Do veterinário</label>
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="fazenda" /> Fornecido pela fazenda</label>
            </RadioGroup>
            {fonteSemen === "veterinario" ? (
              <Select value={semenId} onValueChange={setSemenId}>
                <SelectTrigger className="mt-2"><SelectValue placeholder="Selecione o sêmen" /></SelectTrigger>
                <SelectContent>
                  {semens.map(s => <SelectItem key={s.id} value={s.id}>{s.touro}{s.codigo ? ` (${s.codigo})` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input className="mt-2" value={semenFazenda} onChange={(e) => setSemenFazenda(e.target.value)} placeholder="Descreva o sêmen" />
            )}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <Label className="text-xs">Observações</Label>
        <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} />
      </Card>

      <div className="flex justify-end gap-2 sticky bottom-2">
        <Button variant="ghost" onClick={() => navigate(`/syncvet/fazendas/${fazendaId}`)}>Cancelar</Button>
        <Button onClick={handleIniciar} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Iniciar Manejo
        </Button>
      </div>
    </div>
  );
}
