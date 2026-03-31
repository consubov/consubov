import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Camera, Plus, Save, X } from "lucide-react";
import type { Observacao, LancamentoOffline } from "@/lib/offlineDb";

interface SalgaFormProps {
  pastoId: string;
  pastoNome: string;
  retiroNome?: string;
  fazendaNome?: string;
  cicloId: string;
  tipo: 'salga' | 'falha_qr';
  justificativaFalhaQr?: string;
  auditoriaExigida: boolean;
  onSave: (lancamento: Omit<LancamentoOffline, 'id' | 'data' | 'status'>) => void;
  onBack: () => void;
}

export default function SalgaForm({
  pastoId, pastoNome, retiroNome, fazendaNome, cicloId, tipo, justificativaFalhaQr,
  auditoriaExigida, onSave, onBack
}: SalgaFormProps) {
  const [sacos, setSacos] = useState<string>("");
  const [observacoes, setObservacoes] = useState<Observacao[]>([]);
  const [fotoAuditoria, setFotoAuditoria] = useState<string | null>(null);
  const [addingObs, setAddingObs] = useState(false);
  const [obsTexto, setObsTexto] = useState("");
  const [obsFoto, setObsFoto] = useState<string | null>(null);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const obsFileRef = useRef<HTMLInputElement>(null);
  const auditFileRef = useRef<HTMLInputElement>(null);

  const capturePhoto = useCallback((callback: (dataUrl: string) => void, inputRef: React.RefObject<HTMLInputElement>) => {
    if (inputRef.current) {
      inputRef.current.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = () => callback(reader.result as string);
          reader.readAsDataURL(file);
        }
      };
      inputRef.current.click();
    }
  }, []);

  const handleAddObs = () => {
    setAddingObs(true);
    setObsFoto(null);
    setObsTexto("");
    setTimeout(() => capturePhoto((url) => setObsFoto(url), obsFileRef), 100);
  };

  const saveObs = () => {
    if (!obsFoto) return;
    setObservacoes((prev) => [...prev, { foto_url: obsFoto!, texto: obsTexto }]);
    setAddingObs(false);
    setObsFoto(null);
    setObsTexto("");
  };

  const removeObs = (idx: number) => {
    setObservacoes((prev) => prev.filter((_, i) => i !== idx));
  };

  // Auto-open camera for mandatory audit
  useEffect(() => {
    if (auditoriaExigida && !fotoAuditoria) {
      const timer = setTimeout(() => capturePhoto((url) => setFotoAuditoria(url), auditFileRef), 300);
      return () => clearTimeout(timer);
    }
  }, [auditoriaExigida]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSave = () => {
    if (sacos === "" || parseInt(sacos) < 0 || isNaN(parseInt(sacos))) return false;
    if (auditoriaExigida && !fotoAuditoria) return false;
    return true;
  };

  const handleSave = () => {
    if (!canSave()) return;
    setSaving(true);
    onSave({
      tipo,
      pasto_id: pastoId,
      pasto_nome: pastoNome,
      sacos: parseInt(sacos),
      foto_auditoria_url: fotoAuditoria,
      foto_auditoria_exigida: auditoriaExigida,
      observacoes,
      ciclo_id: cicloId,
      justificativa_falha_qr: justificativaFalhaQr,
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="text-primary-foreground hover:bg-primary/80">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-bold">Registrar Salga</h1>
      </header>

      {/* Hidden file inputs for camera */}
      <input ref={obsFileRef} type="file" accept="image/*" capture="environment" className="hidden" />
      <input ref={auditFileRef} type="file" accept="image/*" capture="environment" className="hidden" />

      <main className="flex-1 px-4 py-4 space-y-4 overflow-y-auto pb-24">
        {/* Pasto name */}
        <Card>
          <CardContent className="p-3">
            <label className="text-xs text-muted-foreground">Pasto</label>
            <p className="font-semibold text-foreground">{pastoNome}</p>
            {retiroNome && (
              <p className="text-xs text-muted-foreground mt-0.5">Retiro: {retiroNome}</p>
            )}
            {fazendaNome && (
              <p className="text-xs text-muted-foreground">Fazenda: {fazendaNome}</p>
            )}
            {tipo === 'falha_qr' && (
              <p className="text-xs text-destructive mt-1">⚠ Seleção manual (falha QR)</p>
            )}
          </CardContent>
        </Card>

        {/* Sacos */}
        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">Quantidade de sacos *</label>
          <Input
            type="number"
            inputMode="numeric"
            min="1"
            value={sacos}
            onChange={(e) => setSacos(e.target.value)}
            placeholder="0"
            className="text-lg"
          />
        </div>

        {/* Foto Auditoria */}
        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">
            Foto de auditoria {auditoriaExigida ? <span className="text-destructive">* (obrigatória)</span> : '(opcional)'}
          </label>
          {auditoriaExigida && !fotoAuditoria && (
            <p className="text-xs text-destructive mb-2">📸 Foto de auditoria obrigatória nesta salga</p>
          )}
          {fotoAuditoria ? (
            <div className="relative w-20 h-20">
              <img src={fotoAuditoria} className="w-20 h-20 rounded-lg object-cover" onClick={() => setPreviewImg(fotoAuditoria)} />
              <button onClick={() => setFotoAuditoria(null)} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center">
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <Button variant="outline" className="gap-2" onClick={() => capturePhoto((url) => setFotoAuditoria(url), auditFileRef)}>
              <Camera className="w-4 h-4" />
              {auditoriaExigida ? '📷 Tirar Foto de Auditoria (obrigatória)' : '+ Foto de auditoria'}
            </Button>
          )}
        </div>

        {/* Observações */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-foreground">Observações ({observacoes.length})</label>
            {!addingObs && (
              <Button variant="outline" size="sm" className="gap-1" onClick={handleAddObs}>
                <Plus className="w-3 h-3" />
                Observação
              </Button>
            )}
          </div>

          {/* Thumbnails */}
          {observacoes.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-3">
              {observacoes.map((obs, i) => (
                <div key={i} className="relative">
                  <img
                    src={obs.foto_url}
                    className="w-16 h-16 rounded-lg object-cover cursor-pointer border border-border"
                    onClick={() => setPreviewImg(obs.foto_url)}
                  />
                  <button onClick={() => removeObs(i)} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center">
                    <X className="w-2.5 h-2.5" />
                  </button>
                  {obs.texto && <p className="text-[10px] text-muted-foreground mt-0.5 truncate w-16">{obs.texto}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Adding obs form */}
          {addingObs && (
            <Card>
              <CardContent className="p-3 space-y-2">
                {obsFoto ? (
                  <img src={obsFoto} className="w-full max-h-40 rounded-lg object-cover" />
                ) : (
                  <Button variant="outline" className="w-full gap-2" onClick={() => capturePhoto((url) => setObsFoto(url), obsFileRef)}>
                    <Camera className="w-4 h-4" />
                    Tirar foto
                  </Button>
                )}
                <Textarea
                  placeholder="Descrição (opcional)"
                  value={obsTexto}
                  onChange={(e) => setObsTexto(e.target.value)}
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveObs} disabled={!obsFoto} className="flex-1">Salvar</Button>
                  <Button size="sm" variant="outline" onClick={() => setAddingObs(false)} className="flex-1">Cancelar</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* Fixed bottom save button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
        <Button onClick={handleSave} disabled={!canSave() || saving} className="w-full gap-2" size="lg">
          <Save className="w-5 h-5" />
          {saving ? 'Salvando...' : 'Salvar Salga'}
        </Button>
      </div>

      {/* Image preview modal */}
      {previewImg && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewImg(null)}>
          <img src={previewImg} className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
