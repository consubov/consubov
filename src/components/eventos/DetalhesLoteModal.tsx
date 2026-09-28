import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Beef, Scale, Syringe, History, Camera } from "lucide-react";
import CarenciaBadge from "./CarenciaBadge";
import { supabase } from "@/integrations/supabase/client";
import PhotoResultModal from "@/components/pesagem/PhotoResultModal";

interface PastoInfo {
  id: string;
  nome: string;
  num_animais: number;
  peso_medio_kg: number | null;
  categoria: string | null;
  sexo: string | null;
  ultima_movimentacao?: string | null;
  ultima_salga?: string | null;
  data_fim_carencia?: string | null;
  ultima_pesagem_em?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  pasto: PastoInfo | null;
  onVerHistorico: () => void;
}

const TZ_SP = "America/Sao_Paulo";

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: TZ_SP });
}

function fmtShortDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: TZ_SP });
}

const catLabels: Record<string, string> = {
  vermifugo: "Vermífugo",
  vacina: "Vacina",
  vitamina: "Vitamina",
  antibiotico: "Antibiótico",
  outro: "Outro",
};

// Paleta unificada do Consumo Global (mesma do RelatorioPDF)
const statusClasses: Record<string, string> = {
  Baixo: "bg-[#E53935]/10 text-[#E53935] border-[#E53935]/30",
  "Atenção": "bg-[#FBC02D]/15 text-[#A17E00] border-[#FBC02D]/40",
  Ideal: "bg-[#43A047]/10 text-[#43A047] border-[#43A047]/30",
  Alto: "bg-[#1E88E5]/10 text-[#1E88E5] border-[#1E88E5]/30",
};

function calcCarenciaDias(dataFimCarencia: string | null | undefined): number {
  if (!dataFimCarencia) return 0;
  const fim = new Date(dataFimCarencia);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  fim.setHours(0, 0, 0, 0);
  const diff = Math.ceil((fim.getTime() - hoje.getTime()) / 86400000);
  return Math.max(0, diff);
}

export default function DetalhesLoteModal({ open, onClose, pasto, onVerHistorico }: Props) {
  const [pesagem, setPesagem] = useState<any>(null);
  const [sanitario, setSanitario] = useState<any>(null);
  const [consumoGlobal, setConsumoGlobal] = useState<number | null>(null);
  const [statusGlobal, setStatusGlobal] = useState<string | null>(null);
  const [ultimaSalga, setUltimaSalga] = useState<{ data: string; sacos: number } | null>(null);
  const [ultimoCocho, setUltimoCocho] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleShareClick() {
    fileInputRef.current?.click();
  }
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
    setPhotoModalOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }
  function fecharFotoModal() {
    setPhotoModalOpen(false);
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
  }

  // Fetch fresh data every time modal opens
  useEffect(() => {
    if (!open || !pasto?.id) {
      setPesagem(null);
      setSanitario(null);
      setConsumoGlobal(null);
      setStatusGlobal(null);
      setUltimaSalga(null);
      setUltimoCocho(null);
      return;
    }

    // Fetch última pesagem
    (supabase.from("pesagens") as any)
      .select("*")
      .eq("lote_id", pasto.id)
      .order("data_pesagem", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }: any) => setPesagem(data));

    // Fetch último sanitário
    (supabase.from("eventos_sanitarios") as any)
      .select("*")
      .eq("lote_id", pasto.id)
      .order("data_aplicacao", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }: any) => setSanitario(data));

    // Fetch consumo global e status da mesma fonte do Mapa
    supabase
      .from("view_painel_mae_pasto_atual")
      .select("consumo_global_g_cab_dia, status_global")
      .eq("pasto_id", pasto.id)
      .maybeSingle()
      .then(({ data }) => {
        setConsumoGlobal(data?.consumo_global_g_cab_dia != null ? Number(data.consumo_global_g_cab_dia) : null);
        setStatusGlobal(data?.status_global ?? null);
      });

    supabase
      .from("lancamentos")
      .select("cocho_cheio, num_sacos, data_salga_informada, created_at, origem, observacao")
      .eq("pasto_id", pasto.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const rows = data ?? [];
        const effectiveDate = (row: typeof rows[number]) => row.data_salga_informada || row.created_at;
        const salgas = rows.filter((row) => !row.cocho_cheio && row.num_sacos > 0).sort((a, b) => new Date(effectiveDate(b)).getTime() - new Date(effectiveDate(a)).getTime());
        const cochos = rows.filter((row) => row.cocho_cheio).sort((a, b) => new Date(effectiveDate(b)).getTime() - new Date(effectiveDate(a)).getTime());
        const salga = salgas[0];
        const cocho = cochos[0];
        setUltimaSalga(salga ? { data: effectiveDate(salga), sacos: salga.num_sacos, motivo: (salga as any).origem === "manual" ? (salga as any).observacao ?? null : null } : null);
        setUltimoCocho(cocho ? effectiveDate(cocho) : null);
        setMotivoCocho(cocho && (cocho as any).origem === "manual" ? (cocho as any).observacao ?? null : null);
      });
  }, [open, pasto?.id]);

  if (!pasto) return null;

  const carenciaDias = sanitario ? calcCarenciaDias(sanitario.data_fim_carencia) : 0;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Beef className="w-4 h-4" />
              {pasto.nome}
            </DialogTitle>
            <DialogDescription>Detalhes do lote</DialogDescription>
          </DialogHeader>

          <CarenciaBadge dataFimCarencia={pasto.data_fim_carencia} className="mb-2" />

          {/* Seção 1 — Informações Gerais */}
          <div className="space-y-1">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Informações Gerais</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Item label="Animais" value={String(pasto.num_animais)} />
              <Item label="Peso médio" value={pasto.peso_medio_kg != null ? `${pasto.peso_medio_kg} kg` : "—"} />
              <Item
                label="Consumo global"
                value={
                  consumoGlobal != null ? (
                    <span className="flex items-center gap-1.5 flex-wrap">
                      <span>{consumoGlobal.toFixed(1).replace(".", ",")} g/cab/dia</span>
                      {statusGlobal && (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${statusClasses[statusGlobal] || "bg-muted text-muted-foreground border-muted"}`}>
                          {statusGlobal}
                        </span>
                      )}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <Item label="Categoria" value={pasto.categoria || "—"} />
              <Item label="Sexo" value={pasto.sexo || "—"} />
              <Item label="Última movimentação" value={fmtDate(pasto.ultima_movimentacao)} />
              <Item label="Última salga" value={ultimaSalga ? `${fmtShortDate(ultimaSalga.data)} (${ultimaSalga.sacos} sacos)` : "—"} />
              {ultimoCocho && (!ultimaSalga || new Date(ultimoCocho).getTime() > new Date(ultimaSalga.data).getTime()) && (
                <Item label="Último Cocho Cheio" value={fmtShortDate(ultimoCocho)} />
              )}
              {ultimaSalga?.motivo && <Item label="Motivo (salga manual)" value={ultimaSalga.motivo} />}
              {motivoCocho && ultimoCocho && (!ultimaSalga || new Date(ultimoCocho).getTime() > new Date(ultimaSalga.data).getTime()) && (
                <Item label="Motivo (cocho cheio manual)" value={motivoCocho} />
              )}
            </div>
          </div>

          {/* Seção 2 — Pesagem */}
          <div className="space-y-1 border-t pt-3">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1">
              <Scale className="w-3 h-3" /> Pesagem
            </h4>
            {pesagem ? (
              <div className="text-sm space-y-0.5">
                <p className="flex items-center gap-2 flex-wrap">
                  <span>Última pesagem: <strong>{fmtDate(pesagem.data_pesagem)}</strong></span>
                  <button
                    type="button"
                    onClick={handleShareClick}
                    className="inline-flex items-center gap-1 text-green-600 text-xs hover:underline"
                    aria-label="Compartilhar resultado"
                  >
                    <Camera className="w-4 h-4" />
                    Compartilhar
                  </button>
                </p>
                <p>Animais pesados: <strong>{pesagem.total_pesado}</strong></p>
                <p>Peso médio calculado: <strong>{pesagem.media_calculada != null ? `${pesagem.media_calculada} kg` : "—"}</strong></p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma pesagem registrada</p>
            )}
          </div>

          {/* Seção 3 — Sanidade */}
          <div className="space-y-1 border-t pt-3">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1">
              <Syringe className="w-3 h-3" /> Sanidade
            </h4>
            {sanitario ? (
              <div className="text-sm space-y-0.5">
                <p><strong>{catLabels[sanitario.categoria] || sanitario.categoria}</strong>: {sanitario.medicamento}</p>
                <p className="text-muted-foreground">Dose: {sanitario.dose}</p>
                <p className="text-muted-foreground">Data: {fmtDate(sanitario.data_aplicacao)}</p>
                {carenciaDias > 0 && (
                  <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium bg-destructive/10 text-destructive border border-destructive/30">
                    Carência restante: {carenciaDias} dias
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum evento sanitário registrado</p>
            )}
          </div>

          <Button variant="outline" className="w-full mt-2" onClick={onVerHistorico}>
            <History className="w-4 h-4 mr-2" />
            Ver histórico completo
          </Button>
        </DialogContent>
      </Dialog>

      <PhotoResultModal
        open={photoModalOpen}
        onClose={fecharFotoModal}
        photoUrl={photoUrl}
        pesagemId={photoModalOpen ? pesagem?.id ?? null : null}
      />
    </>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="font-medium">{value}</div>
    </div>
  );
}
