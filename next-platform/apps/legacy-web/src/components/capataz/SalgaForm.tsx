import { LocalizedText, useStaticUiText } from "@/components/i18n/LocalizedText";
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Camera, Plus, Save, X, PackageOpen } from "lucide-react";
import type { Observacao, LancamentoOffline } from "@/lib/offlineDb";
import { useCriticalOperation } from "@/lib/criticalOperations";
import { prepareCapatazCameraBlob } from "@/lib/capatazPhoto";
import CapatazCameraCapture from "@/components/capataz/CapatazCameraCapture";

export interface SalgaFormDraft {
  sacos: string;
  observacoes: Observacao[];
  fotoAuditoria: string | null;
  addingObs: boolean;
  obsTexto: string;
  obsFoto: string | null;
  cochoChecked?: boolean;
  fotoCocho?: string | null;
}

export interface SalgaSugestao {
  sacosSugeridos: number;
  numAnimais: number;
  intervaloDias: number;
  pesoAtual: number;
  produtoNome: string;
  consumoPor100kg?: number;
  categoria?: string;
  pesoSacoKg?: number;
}

interface SalgaFormProps {
  pastoId: string;
  pastoNome: string;
  retiroNome?: string;
  fazendaNome?: string;
  cicloId: string;
  tipo: 'salga' | 'falha_qr';
  justificativaFalhaQr?: string;
  auditoriaExigida: boolean;
  exigirFotoCocho?: boolean;
  initialDraft?: SalgaFormDraft | null;
  onDraftChange?: (draft: SalgaFormDraft) => void;
  onSave: (lancamento: Omit<LancamentoOffline, 'id' | 'data' | 'status'>) => Promise<void>;
  onBack: () => void;
  numAnimais: number;
  sugestao: SalgaSugestao | null;
}

export default function SalgaForm({
  pastoId, pastoNome, retiroNome, fazendaNome, cicloId, tipo, justificativaFalhaQr,
  auditoriaExigida, exigirFotoCocho = true, initialDraft, onDraftChange, onSave, onBack, numAnimais, sugestao
}: SalgaFormProps) {
  const uiText = useStaticUiText();
  const [sacos, setSacos] = useState<string>(initialDraft?.sacos ?? (sugestao ? String(sugestao.sacosSugeridos) : ""));
  const [observacoes, setObservacoes] = useState<Observacao[]>(initialDraft?.observacoes ?? []);
  const [fotoAuditoria, setFotoAuditoria] = useState<string | null>(initialDraft?.fotoAuditoria ?? null);
  const [addingObs, setAddingObs] = useState(initialDraft?.addingObs ?? false);
  const [obsTexto, setObsTexto] = useState(initialDraft?.obsTexto ?? "");
  const [obsFoto, setObsFoto] = useState<string | null>(initialDraft?.obsFoto ?? null);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cochoChecked, setCochoChecked] = useState(initialDraft?.cochoChecked ?? false);
  const [fotoCocho, setFotoCocho] = useState<string | null>(initialDraft?.fotoCocho ?? null);
  type PhotoSlot = "auditoria" | "cocho" | "observacao";
  const [photoProcessing, setPhotoProcessing] = useState<PhotoSlot | null>(null);
  const [cameraSlot, setCameraSlot] = useState<PhotoSlot | null>(null);
  const [photoError, setPhotoError] = useState<{ slot: PhotoSlot; message: string } | null>(null);
  const photoRequestRef = useRef(0);
  const produtoNaoConfigurado = !sugestao && numAnimais > 0;
  useCriticalOperation(true, "salga-form");

  const capturePhoto = useCallback((slot: PhotoSlot) => {
    if (photoProcessing !== null || cameraSlot !== null) return;
    setPhotoError(null);
    setCameraSlot(slot);
  }, [photoProcessing, cameraSlot]);

  const handleCapturedPhoto = async (blob: Blob) => {
    const slot = cameraSlot;
    if (!slot || photoProcessing !== null) throw new Error("Foto não disponível. Tente novamente.");
    const request = ++photoRequestRef.current;
    setPhotoProcessing(slot);
    setPhotoError(null);
    try {
      const dataUrl = await prepareCapatazCameraBlob(blob);
      if (request !== photoRequestRef.current) throw new Error("Captura cancelada.");
      if (slot === "auditoria") setFotoAuditoria(dataUrl);
      if (slot === "cocho") setFotoCocho(dataUrl);
      if (slot === "observacao") setObsFoto(dataUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível carregar a foto. Tente novamente.";
      if (request === photoRequestRef.current) setPhotoError({ slot, message });
      throw new Error(message);
    } finally {
      if (request === photoRequestRef.current) setPhotoProcessing(null);
    }
  };

  useEffect(() => () => { photoRequestRef.current += 1; }, []);

  const handleAddObs = () => {
    setAddingObs(true);
    setObsFoto(null);
    setObsTexto("");
    capturePhoto("observacao");
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

  const toggleCochoChecked = () => {
    if (photoProcessing !== null) return;
    setPhotoError(null);
    const next = !cochoChecked;
    setCochoChecked(next);
    if (next) {
      setSacos("0");
      setFotoCocho(null);
    } else {
      setSacos(sugestao ? String(sugestao.sacosSugeridos) : "");
      setFotoCocho(null);
    }
  };


  useEffect(() => {
    onDraftChange?.({ sacos, observacoes, fotoAuditoria, addingObs, obsTexto, obsFoto, cochoChecked, fotoCocho });
  }, [addingObs, fotoAuditoria, obsFoto, obsTexto, observacoes, onDraftChange, sacos, cochoChecked, fotoCocho]);

  const canSave = () => {
    if (photoProcessing !== null) return false;
    if (photoError?.slot === "cocho" && cochoChecked && exigirFotoCocho) return false;
    if (photoError?.slot === "auditoria" && !cochoChecked && auditoriaExigida) return false;
    if (cochoChecked) {
      return exigirFotoCocho ? !!fotoCocho : true;
    }
    if (sacos === "" || parseInt(sacos) < 0 || isNaN(parseInt(sacos))) return false;
    if (auditoriaExigida && !fotoAuditoria) return false;
    return true;
  };

  const handleSave = async () => {
    if (saving || photoProcessing !== null || !canSave()) return;
    setSaving(true);
    try {
      await onSave({
      tipo,
      pasto_id: pastoId,
      pasto_nome: pastoNome,
      sacos: cochoChecked ? 0 : parseInt(sacos),
      foto_auditoria_url: cochoChecked ? null : fotoAuditoria,
      foto_auditoria_exigida: cochoChecked ? false : auditoriaExigida,
      observacoes,
      ciclo_id: cicloId,
      justificativa_falha_qr: justificativaFalhaQr,
      cocho_cheio: cochoChecked,
      foto_cocho_url: cochoChecked ? fotoCocho : null,
      });
    } finally {
      // A failed IndexedDB write leaves the draft on screen and re-enables retry.
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="text-primary-foreground hover:bg-primary/80">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-bold"><LocalizedText source={"Registrar Salga"} /></h1>
      </header>

      <main className="flex-1 px-4 py-4 space-y-4 overflow-y-auto pb-24">
        {/* Pasto name */}
        <Card>
          <CardContent className="p-3">
            <label className="text-xs text-muted-foreground"><LocalizedText source={"Pasto"} /></label>
            <p className="font-semibold text-foreground">{pastoNome}</p>
            {retiroNome && (
              <p className="text-xs text-muted-foreground mt-0.5"><LocalizedText source={"Retiro:"} />{" "}{retiroNome}</p>
            )}
            {fazendaNome && (
              <p className="text-xs text-muted-foreground"><LocalizedText source={"Fazenda:"} />{" "}{fazendaNome}</p>
            )}
            <p className="text-sm text-foreground mt-1 font-medium"><LocalizedText source={"Animais:"} />{" "}{numAnimais} cab</p>
            {tipo === 'falha_qr' && (
              <p className="text-xs text-destructive mt-1"><LocalizedText source={"⚠ Seleção manual (falha QR)"} /></p>
            )}
          </CardContent>
        </Card>

        {/* Cocho Cheio Toggle */}
        <Button
          variant={cochoChecked ? "default" : "outline"}
          className={`w-full gap-2 text-base ${cochoChecked ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'border-blue-400 text-blue-700 hover:bg-blue-50'}`}
          onClick={toggleCochoChecked}
          disabled={photoProcessing !== null}
        >
          <PackageOpen className="w-5 h-5" />
          {cochoChecked ? '✓ Cocho Cheio selecionado' : 'Cocho Cheio (sem salga)'}
        </Button>

        {/* Cocho Cheio photo */}
        {cochoChecked && (
          <Card className="border-blue-300 bg-blue-50">
            <CardContent className="p-3 space-y-2">
              <label className="text-sm font-medium text-blue-800 block"><LocalizedText source={"📸 Foto do cocho ("} />{exigirFotoCocho ? "obrigatória" : "opcional"})</label>
              {!fotoCocho && exigirFotoCocho && (
                <p className="text-xs text-blue-600 font-semibold"><LocalizedText source={"⚠ Tire a foto do cocho cheio antes de salvar"} /></p>
              )}
              {photoProcessing === "cocho" && <p role="status" className="text-xs text-blue-700">Processando foto do cocho...</p>}
              {photoError?.slot === "cocho" && <p role="alert" className="text-xs text-destructive">{photoError.message}</p>}
              {fotoCocho ? (
                <div className="relative w-20 h-20">
                  <img src={fotoCocho} alt="Foto do cocho capturada" className="w-20 h-20 rounded-lg object-cover" onClick={() => setPreviewImg(fotoCocho)} />
                  <button onClick={() => setFotoCocho(null)} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <>
                <Button
                  variant={exigirFotoCocho ? "destructive" : "outline"}
                  size={exigirFotoCocho ? "lg" : "default"}
                  className={exigirFotoCocho ? "w-full gap-2 text-base" : "gap-2 border-blue-500 text-blue-700 hover:bg-blue-100"}
                  onClick={() => capturePhoto("cocho")}
                  disabled={photoProcessing !== null}
                >
                  <Camera className="w-4 h-4" />
                  {exigirFotoCocho ? "Tirar foto (obrigatório)" : "Tirar foto do cocho"}</Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Sugestão de sacos */}
        {!cochoChecked && (
          <>
            {sugestao ? (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className="bg-primary text-primary-foreground"><LocalizedText source={"Sugestão:"} />{" "}{sugestao.sacosSugeridos} {uiText(sugestao.sacosSugeridos === 1 ? "saco" : "sacos")}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <LocalizedText source={"Base:"} />{" "}{sugestao.numAnimais} <LocalizedText source={"animais ×"} />{" "}{sugestao.intervaloDias} <LocalizedText source={"dias ×"} />{" "}{sugestao.produtoNome}
                  </p>

                </CardContent>
              </Card>
            ) : (
              !produtoNaoConfigurado ? null : (
                <Card className="border-destructive/30 bg-destructive/5">
                  <CardContent className="p-3">
                    <p className="text-xs text-destructive font-medium">
                      Sugestão indisponível. Confira produto, peso e parâmetros de consumo do pasto.
                    </p>
                  </CardContent>
                </Card>
              )
            )}
          </>
        )}

        {/* Sacos */}
        {!cochoChecked && (
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block"><LocalizedText source={"Quantidade de sacos *"} /></label>
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
        )}

        {/* Foto Auditoria — only for normal salga */}
        {!cochoChecked && (
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">
              {auditoriaExigida
                ? '📸 Foto de auditoria OBRIGATÓRIA'
                : 'Foto de auditoria (opcional)'}
            </label>
            {auditoriaExigida && !fotoAuditoria && (
              <p className="text-xs text-destructive mb-2 font-semibold"><LocalizedText source={"⚠ Você deve tirar a foto antes de salvar"} /></p>
            )}
            {photoProcessing === "auditoria" && <p role="status" className="text-xs text-muted-foreground mb-2">Processando foto, aguarde...</p>}
            {photoError?.slot === "auditoria" && <p role="alert" className="text-xs text-destructive mb-2">{photoError.message}</p>}
            {fotoAuditoria ? (
              <div className="relative w-20 h-20">
                <img src={fotoAuditoria} alt="Foto de auditoria capturada" className="w-20 h-20 rounded-lg object-cover" onClick={() => setPreviewImg(fotoAuditoria)} />
                <button onClick={() => setFotoAuditoria(null)} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <>
              <Button
                variant={auditoriaExigida ? "destructive" : "outline"}
                size={auditoriaExigida ? "lg" : "default"}
                className={`gap-2 ${auditoriaExigida ? 'w-full text-base' : ''}`}
                onClick={() => capturePhoto("auditoria")}
                disabled={photoProcessing !== null}
              >
                <Camera className="w-4 h-4" />
                {auditoriaExigida ? 'Tirar foto (obrigatório)' : 'Tirar foto de auditoria'}
              </Button>

              </>
            )}
          </div>
        )}

        {/* Observações */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-foreground"><LocalizedText source={"Observações ("} />{observacoes.length})</label>
            {!addingObs && (
              <Button variant="outline" size="sm" className="gap-1" onClick={handleAddObs}>
                <Plus className="w-3 h-3" />
                <LocalizedText source={"Observação"} /></Button>
            )}
          </div>

          {/* Thumbnails */}
          {observacoes.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-3">
              {observacoes.map((obs, i) => (
                <div key={i} className="relative">
                  <img
                    src={obs.foto_url}
                    alt={`Foto de observação ${i + 1}`}
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
          {photoProcessing === "observacao" && <p role="status" className="text-xs text-muted-foreground">Processando foto da observação...</p>}
          {photoError?.slot === "observacao" && <p role="alert" className="text-xs text-destructive">{photoError.message}</p>}
          {addingObs && (
            <Card>
              <CardContent className="p-3 space-y-2">
                {obsFoto ? (
                  <img src={obsFoto} alt="Foto de observação capturada" className="w-full max-h-40 rounded-lg object-cover" />
                ) : (
                  <>
                  <Button variant="outline" className="w-full gap-2" disabled={photoProcessing !== null} onClick={() => capturePhoto("observacao")}>
                    <Camera className="w-4 h-4" />
                    <LocalizedText source={"Tirar foto"} /></Button>

                  </>
                )}
                <Textarea
                  placeholder={uiText("Descrição (opcional)")}
                  value={obsTexto}
                  onChange={(e) => setObsTexto(e.target.value)}
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveObs} disabled={!obsFoto} className="flex-1"><LocalizedText source={"Salvar"} /></Button>
                  <Button size="sm" variant="outline" onClick={() => setAddingObs(false)} className="flex-1"><LocalizedText source={"Cancelar"} /></Button>
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
          {saving ? 'Salvando...' : cochoChecked ? 'Salvar Cocho Cheio' : 'Salvar Salga'}
        </Button>
      </div>

      {cameraSlot && (
        <CapatazCameraCapture
          label={cameraSlot === "cocho" ? "cocho" : cameraSlot === "auditoria" ? "auditoria" : "observação"}
          onPhoto={handleCapturedPhoto}
          onClose={() => setCameraSlot(null)}
        />
      )}

      {/* Image preview modal */}
      {previewImg && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewImg(null)}>
          <img src={previewImg} alt="Prévia ampliada da foto" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
