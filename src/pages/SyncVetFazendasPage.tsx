import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, ChevronRight, MapPin } from "lucide-react";

type Modelo = "protocolo_completo" | "mao_obra_km";
const MODELO_LABEL: Record<Modelo, string> = {
  protocolo_completo: "Protocolo Completo",
  mao_obra_km: "Mão de Obra + KM",
};

type Fazenda = {
  id: string;
  nome: string;
  proprietario: string | null;
  municipio: string | null;
  estado: string | null;
  modelo_cobranca: Modelo;
};

export default function SyncVetFazendasPage() {
  const { roleData } = useAuth();
  const empresaId = roleData.syncvetEmpresaId ?? null;
  const navigate = useNavigate();
  const [rows, setRows] = useState<Fazenda[]>([]);
  const [matrizes, setMatrizes] = useState<Fazenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [nome, setNome] = useState("");
  const [proprietario, setProprietario] = useState("");
  const [fazendaMatrizId, setFazendaMatrizId] = useState<string>("__none__");
  const [municipio, setMunicipio] = useState("");
  const [estado, setEstado] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [telefone, setTelefone] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [modelo, setModelo] = useState<Modelo>("protocolo_completo");

  async function load() {
    if (!empresaId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("syncvet_fazendas")
      .select("id, nome, proprietario, municipio, estado, modelo_cobranca")
      .eq("empresa_id", empresaId)
      .order("nome");
    if (error) toast.error(error.message);
    setRows((data as any) ?? []);
    setMatrizes((data as any) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [empresaId]);

  function openNew() {
    setNome(""); setProprietario(""); setFazendaMatrizId("__none__");
    setMunicipio(""); setEstado(""); setLatitude(""); setLongitude("");
    setTelefone(""); setObservacoes(""); setModelo("protocolo_completo");
    setOpen(true);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) { toast.error("GPS não disponível"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        toast.success("Localização capturada");
      },
      () => toast.error("Não foi possível obter a localização"),
    );
  }

  async function handleSave() {
    if (!empresaId) return;
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    const payload = {
      empresa_id: empresaId,
      nome: nome.trim(),
      proprietario: proprietario || null,
      fazenda_matriz_id: fazendaMatrizId === "__none__" ? null : fazendaMatrizId,
      municipio: municipio || null,
      estado: estado || null,
      latitude: latitude ? Number(latitude) : null,
      longitude: longitude ? Number(longitude) : null,
      telefone: telefone || null,
      observacoes: observacoes || null,
      modelo_cobranca: modelo,
    };
    const { error } = await supabase.from("syncvet_fazendas").insert(payload as any);
    if (error) toast.error(error.message);
    else { toast.success("Fazenda cadastrada"); setOpen(false); load(); }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Fazendas</h1>
          <p className="text-sm text-muted-foreground">Clientes atendidos</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" />Nova fazenda</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nova fazenda</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label className="text-xs">Nome*</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
                <div><Label className="text-xs">Proprietário</Label><Input value={proprietario} onChange={(e) => setProprietario(e.target.value)} /></div>
                <div>
                  <Label className="text-xs">Fazenda matriz</Label>
                  <Select value={fazendaMatrizId} onValueChange={setFazendaMatrizId}>
                    <SelectTrigger><SelectValue placeholder="Nenhuma (matriz)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhuma (matriz)</SelectItem>
                      {matrizes.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Modelo de cobrança</Label>
                  <Select value={modelo} onValueChange={(v) => setModelo(v as Modelo)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="protocolo_completo">Protocolo Completo</SelectItem>
                      <SelectItem value="mao_obra_km">Mão de Obra + KM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Município</Label><Input value={municipio} onChange={(e) => setMunicipio(e.target.value)} /></div>
                <div><Label className="text-xs">Estado (UF)</Label><Input maxLength={2} value={estado} onChange={(e) => setEstado(e.target.value.toUpperCase())} /></div>
                <div><Label className="text-xs">Latitude</Label><Input value={latitude} onChange={(e) => setLatitude(e.target.value)} /></div>
                <div><Label className="text-xs">Longitude</Label><Input value={longitude} onChange={(e) => setLongitude(e.target.value)} /></div>
              </div>
              <Button variant="outline" size="sm" onClick={useCurrentLocation}>
                <MapPin className="w-4 h-4 mr-1" />Usar localização atual
              </Button>
              <div><Label className="text-xs">Telefone</Label><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} /></div>
              <div><Label className="text-xs">Observações</Label><Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Nenhuma fazenda cadastrada ainda.</Card>
      ) : (
        <div className="space-y-2">
          {rows.map((f) => (
            <Card
              key={f.id}
              className="p-3 flex items-center justify-between cursor-pointer hover:bg-muted/50"
              onClick={() => navigate(`/syncvet/fazendas/${f.id}`)}
            >
              <div>
                <div className="font-semibold">{f.nome}</div>
                <div className="text-xs text-muted-foreground">
                  {[f.proprietario, [f.municipio, f.estado].filter(Boolean).join("/"), MODELO_LABEL[f.modelo_cobranca]]
                    .filter(Boolean).join(" • ")}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
