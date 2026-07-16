import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Loader2, MapPin, ChevronRight, Landmark, Image as ImageIcon, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface Fazenda {
  id: string;
  nome_fazenda: string;
  proprietario: string | null;
  responsavel: string | null;
  municipio: string | null;
  uf: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface Form {
  nome_fazenda: string;
  proprietario: string;
  responsavel: string;
  municipio: string;
  uf: string;
  latitude: string;
  longitude: string;
}

const emptyForm: Form = { nome_fazenda: "", proprietario: "", responsavel: "", municipio: "", uf: "", latitude: "", longitude: "" };

export default function ConsultorFazendasPage() {
  const { roleData } = useAuth();
  const navigate = useNavigate();
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [logoDialogOpen, setLogoDialogOpen] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (roleData?.consultorId) load(); }, [roleData?.consultorId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("fazendas_consultor")
      .select("*")
      .eq("consultor_id", roleData.consultorId!)
      .order("nome_fazenda");
    setFazendas((data as Fazenda[]) || []);
    setLoading(false);
  }

  async function handleSave() {
    if (!form.nome_fazenda.trim()) return toast.error("Nome da fazenda é obrigatório");
    setSaving(true);
    try {
      const { error } = await supabase.from("fazendas_consultor").insert({
        consultor_id: roleData.consultorId!,
        nome_fazenda: form.nome_fazenda.trim(),
        proprietario: form.proprietario.trim() || null,
        responsavel: form.responsavel.trim() || null,
        municipio: form.municipio.trim() || null,
        uf: form.uf.trim().toUpperCase() || null,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
      });
      if (error) throw error;
      toast.success("Fazenda cadastrada!");
      setDialogOpen(false);
      setForm(emptyForm);
      load();
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "desconhecido"));
    } finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Landmark className="w-5 h-5" /> Minhas Fazendas
        </h1>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setLogoDialogOpen(true)}
            size="sm"
            variant="outline"
            className="gap-1.5"
            title="Personalizar logo do relatório"
          >
            <ImageIcon className="w-4 h-4" />
          </Button>
          <Button onClick={() => { setForm(emptyForm); setDialogOpen(true); }} size="sm" className="gap-1.5 bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4" /> Nova
          </Button>
        </div>
      </div>

      {fazendas.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          Nenhuma fazenda cadastrada ainda.<br />Toque em "Nova" para começar.
        </Card>
      ) : (
        <div className="space-y-2">
          {fazendas.map(f => (
            <Card
              key={f.id}
              className="p-3 flex items-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate(`/consultor/fazendas/${f.id}`)}
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Landmark className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground truncate">{f.nome_fazenda}</div>
                <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                  {f.proprietario && <span>{f.proprietario}</span>}
                  {f.proprietario && (f.municipio || f.uf) && <span>·</span>}
                  {(f.municipio || f.uf) && (
                    <span className="flex items-center gap-0.5">
                      <MapPin className="w-3 h-3" />
                      {[f.municipio, f.uf].filter(Boolean).join("/")}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Fazenda</DialogTitle>
            <DialogDescription>Cadastre uma fazenda que você atende como consultor.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome da fazenda *</Label><Input value={form.nome_fazenda} onChange={e => setForm(f => ({ ...f, nome_fazenda: e.target.value }))} /></div>
            <div><Label>Proprietário</Label><Input value={form.proprietario} onChange={e => setForm(f => ({ ...f, proprietario: e.target.value }))} /></div>
            <div><Label>Responsável</Label><Input placeholder="Nome do gerente ou responsável" value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2"><Label>Município</Label><Input value={form.municipio} onChange={e => setForm(f => ({ ...f, municipio: e.target.value }))} /></div>
              <div><Label>UF</Label><Input maxLength={2} value={form.uf} onChange={e => setForm(f => ({ ...f, uf: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Latitude</Label><Input type="number" step="any" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} /></div>
              <div><Label>Longitude</Label><Input type="number" step="any" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PersonalizarLogoModal
        open={logoDialogOpen}
        onOpenChange={setLogoDialogOpen}
        consultorId={roleData?.consultorId || null}
      />
    </div>
  );
}

// ============================================================================
// Modal — Personalizar Logo do Relatório (2 slots independentes)
// ============================================================================

function LogoSlot({
  title,
  toggleLabel,
  toggleOn,
  onToggle,
  previewUrl,
  onSelectFile,
  onRemove,
  showRemove,
  saving,
  isDefaultConsubov,
}: {
  title: string;
  toggleLabel: string;
  toggleOn: boolean;
  onToggle: (v: boolean) => void;
  previewUrl: string | null;
  onSelectFile: (f: File) => void;
  onRemove: () => void;
  showRemove: boolean;
  saving: boolean;
  isDefaultConsubov?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className="text-xs text-muted-foreground">{toggleLabel}</span>
          <Switch checked={toggleOn} onCheckedChange={onToggle} />
        </label>
      </div>

      {toggleOn && (
        <div className="space-y-2">
          <Input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (!/^image\/(png|jpe?g|webp|svg\+xml)$/.test(f.type)) {
                toast.error("Envie um arquivo de imagem (PNG, JPG, WebP ou SVG)");
                return;
              }
              onSelectFile(f);
            }}
          />
          {previewUrl && (
            <div className="flex items-center gap-3 pt-1">
              <img src={previewUrl} alt="Prévia" className="h-14 w-auto object-contain bg-muted rounded border p-1" />
              {showRemove && (
                <Button variant="ghost" size="sm" onClick={onRemove} disabled={saving} className="text-destructive gap-1">
                  <Trash2 className="w-4 h-4" /> Remover
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {!toggleOn && isDefaultConsubov && (
        <div className="text-xs text-muted-foreground">Usando a logo Consubov padrão.</div>
      )}
      {!toggleOn && !isDefaultConsubov && (
        <div className="text-xs text-muted-foreground">Nenhuma logo será exibida nessa posição.</div>
      )}
    </div>
  );
}

function PersonalizarLogoModal({
  open, onOpenChange, consultorId,
}: { open: boolean; onOpenChange: (v: boolean) => void; consultorId: string | null }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Left slot
  const [esquerdaCustom, setEsquerdaCustom] = useState(false); // toggle OFF => Consubov padrão
  const [esquerdaPath, setEsquerdaPath] = useState<string | null>(null);
  const [esquerdaPreview, setEsquerdaPreview] = useState<string | null>(null);
  const [esquerdaFile, setEsquerdaFile] = useState<File | null>(null);

  // Right slot
  const [direitaOn, setDireitaOn] = useState(false);
  const [direitaPath, setDireitaPath] = useState<string | null>(null);
  const [direitaPreview, setDireitaPreview] = useState<string | null>(null);
  const [direitaFile, setDireitaFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open || !consultorId) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("consultores")
        .select("logo_esquerda_url, logo_direita_url" as any)
        .eq("id", consultorId)
        .maybeSingle();
      const c = data as any;
      const eUrl = c?.logo_esquerda_url || null;
      const dUrl = c?.logo_direita_url || null;

      setEsquerdaPath(eUrl);
      setEsquerdaCustom(!!eUrl);
      setEsquerdaFile(null);
      if (eUrl) {
        const { data: signed } = await supabase.storage.from("logos-consultor").createSignedUrl(eUrl, 60 * 60);
        setEsquerdaPreview(signed?.signedUrl || null);
      } else setEsquerdaPreview(null);

      setDireitaPath(dUrl);
      setDireitaOn(!!dUrl);
      setDireitaFile(null);
      if (dUrl) {
        const { data: signed } = await supabase.storage.from("logos-consultor").createSignedUrl(dUrl, 60 * 60);
        setDireitaPreview(signed?.signedUrl || null);
      } else setDireitaPreview(null);

      setLoading(false);
    })();
  }, [open, consultorId]);

  async function handleSave() {
    if (!consultorId) return;
    setSaving(true);
    try {
      let newEsquerda = esquerdaPath;
      let newDireita = direitaPath;

      if (esquerdaCustom && esquerdaFile) {
        const ext = esquerdaFile.name.split(".").pop() || "png";
        const path = `${consultorId}/logo-esq-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("logos-consultor")
          .upload(path, esquerdaFile, { upsert: true, contentType: esquerdaFile.type });
        if (error) throw error;
        newEsquerda = path;
      } else if (!esquerdaCustom) {
        newEsquerda = null;
      }

      if (direitaOn && direitaFile) {
        const ext = direitaFile.name.split(".").pop() || "png";
        const path = `${consultorId}/logo-dir-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("logos-consultor")
          .upload(path, direitaFile, { upsert: true, contentType: direitaFile.type });
        if (error) throw error;
        newDireita = path;
      } else if (!direitaOn) {
        newDireita = null;
      }

      const { error } = await supabase
        .from("consultores")
        .update({ logo_esquerda_url: newEsquerda, logo_direita_url: newDireita } as any)
        .eq("id", consultorId);
      if (error) throw error;
      toast.success("Preferência de logo salva!");
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "desconhecido"));
    } finally {
      setSaving(false);
    }
  }

  async function removeEsquerda() {
    if (!consultorId) return;
    setSaving(true);
    try {
      if (esquerdaPath) await supabase.storage.from("logos-consultor").remove([esquerdaPath]);
      const { error } = await supabase.from("consultores")
        .update({ logo_esquerda_url: null } as any).eq("id", consultorId);
      if (error) throw error;
      setEsquerdaPath(null);
      setEsquerdaPreview(null);
      setEsquerdaFile(null);
      setEsquerdaCustom(false);
      toast.success("Logo esquerda removida");
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "desconhecido"));
    } finally { setSaving(false); }
  }

  async function removeDireita() {
    if (!consultorId) return;
    setSaving(true);
    try {
      if (direitaPath) await supabase.storage.from("logos-consultor").remove([direitaPath]);
      const { error } = await supabase.from("consultores")
        .update({ logo_direita_url: null } as any).eq("id", consultorId);
      if (error) throw error;
      setDireitaPath(null);
      setDireitaPreview(null);
      setDireitaFile(null);
      setDireitaOn(false);
      toast.success("Logo direita removida");
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "desconhecido"));
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Personalizar Logo do Relatório</DialogTitle>
          <DialogDescription>
            Configure as duas posições de logo do cabeçalho dos PDFs de visita de forma independente.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-3">
            <LogoSlot
              title="Logo à Esquerda"
              toggleLabel={esquerdaCustom ? "Minha logo" : "Consubov (padrão)"}
              toggleOn={esquerdaCustom}
              onToggle={(v) => {
                setEsquerdaCustom(v);
                if (!v) { setEsquerdaFile(null); setEsquerdaPreview(esquerdaPath ? esquerdaPreview : null); }
              }}
              previewUrl={esquerdaPreview}
              onSelectFile={(f) => { setEsquerdaFile(f); setEsquerdaPreview(URL.createObjectURL(f)); }}
              onRemove={removeEsquerda}
              showRemove={!!esquerdaPath && !esquerdaFile}
              saving={saving}
              isDefaultConsubov={!esquerdaCustom}
            />

            <LogoSlot
              title="Logo à Direita"
              toggleLabel={direitaOn ? "Ativada" : "Desativada"}
              toggleOn={direitaOn}
              onToggle={(v) => {
                setDireitaOn(v);
                if (!v) { setDireitaFile(null); }
              }}
              previewUrl={direitaPreview}
              onSelectFile={(f) => { setDireitaFile(f); setDireitaPreview(URL.createObjectURL(f)); }}
              onRemove={removeDireita}
              showRemove={!!direitaPath && !direitaFile}
              saving={saving}
              isDefaultConsubov={false}
            />

            <p className="text-xs text-muted-foreground pt-1">
              Envie a logo com fundo branco, ou em PNG transparente (sem fundo), para melhor encaixe no cabeçalho do relatório.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || loading} className="bg-primary hover:bg-primary/90">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

