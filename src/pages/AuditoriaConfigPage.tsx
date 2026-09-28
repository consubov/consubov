import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Camera } from "lucide-react";
import { salvarAuditoriaFazenda, resolverAuditoria, descreverAuditoria, retiroTemConfigPropria } from "@/lib/auditoriaConfig";

export default function AuditoriaConfigPage() {
  const [fazendas, setFazendas] = useState<{ id: string; nome: string; auditoria_fotos_por_bloco: number }[]>([]);
  const [selectedFazendaId, setSelectedFazendaId] = useState("");
  const [fotosPorBloco, setFotosPorBloco] = useState(3);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retirosProprios, setRetirosProprios] = useState<{ id: string; nome: string; auditoria_fotos_por_bloco: number | null; exigir_foto_cocho: boolean | null }[]>([]);
  const [fazendaCocho, setFazendaCocho] = useState<boolean | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("fazendas")
        .select("id, nome, auditoria_fotos_por_bloco")
        .eq("ativo", true)
        .order("nome");
      if (data) {
        setFazendas(data);
        if (data.length > 0 && !selectedFazendaId) {
          setSelectedFazendaId(data[0].id);
          setFotosPorBloco(data[0].auditoria_fotos_por_bloco ?? 3);
        }
      }
      setLoading(false);
    };
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const f = fazendas.find(f => f.id === selectedFazendaId);
    if (f) setFotosPorBloco(f.auditoria_fotos_por_bloco ?? 3);
  }, [selectedFazendaId, fazendas]);

  useEffect(() => {
    if (!selectedFazendaId) return;
    (async () => {
      const [{ data: rets }, { data: faz }] = await Promise.all([
        supabase.from("retiros").select("id, nome, auditoria_fotos_por_bloco, exigir_foto_cocho").eq("fazenda_id", selectedFazendaId).order("nome"),
        supabase.from("fazendas").select("exigir_foto_cocho").eq("id", selectedFazendaId).maybeSingle(),
      ]);
      setRetirosProprios(((rets ?? []) as any[]).filter(retiroTemConfigPropria));
      setFazendaCocho((faz as any)?.exigir_foto_cocho ?? null);
    })();
  }, [selectedFazendaId]);

  const handleSave = async () => {
    if (!selectedFazendaId) return;
    setSaving(true);
    const { error } = await salvarAuditoriaFazenda(selectedFazendaId, { auditoria_fotos_por_bloco: fotosPorBloco });

    if (error) {
      toast.error("Erro ao salvar configuração");
    } else {
      toast.success("Configuração salva com sucesso");
      setFazendas(prev => prev.map(f => f.id === selectedFazendaId ? { ...f, auditoria_fotos_por_bloco: fotosPorBloco } : f));
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="p-6 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Camera className="w-6 h-6" />
          Intervalo / Auditoria
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure quantas fotos de auditoria são sorteadas por bloco de 10 salgas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuração de Auditoria</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Fazenda</label>
            <Select value={selectedFazendaId} onValueChange={setSelectedFazendaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a fazenda" />
              </SelectTrigger>
              <SelectContent>
                {fazendas.map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">
              Fotos obrigatórias a cada 10 salgas
            </label>
            <Input
              type="number"
              min={0}
              max={10}
              value={fotosPorBloco}
              onChange={e => {
                const v = parseInt(e.target.value);
                if (!isNaN(v) && v >= 0 && v <= 10) setFotosPorBloco(v);
              }}
              className="max-w-32"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {fotosPorBloco === 0 && "Nenhuma foto será exigida"}
              {fotosPorBloco === 10 && "Toda salga exigirá foto obrigatória"}
              {fotosPorBloco > 0 && fotosPorBloco < 10 && `${fotosPorBloco} de cada 10 salgas terão foto obrigatória (sorteio aleatório)`}
            </p>
          </div>

          <Button onClick={handleSave} disabled={saving || !selectedFazendaId} className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Retiros com configuração própria</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {retirosProprios.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todos os retiros seguem a configuração da fazenda.</p>
          ) : (
            retirosProprios.map(r => {
              const ef = resolverAuditoria(r, { auditoria_fotos_por_bloco: fotosPorBloco, exigir_foto_cocho: fazendaCocho });
              return (
                <div key={r.id} className="text-sm border rounded-md p-2">
                  <span className="font-medium text-foreground">{r.nome}:</span>{" "}
                  <span className="text-muted-foreground">{descreverAuditoria(ef.fotosPorBloco, ef.exigirFotoCocho)}</span>
                </div>
              );
            })
          )}
          <p className="text-xs text-muted-foreground">Definido pelos gerentes. Somente leitura.</p>
        </CardContent>
      </Card>
    </div>
  );
}
