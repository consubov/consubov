import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Beef, Droplets, TrendingUp, Calendar, Package } from "lucide-react";
import CarenciaBadge from "@/components/eventos/CarenciaBadge";
import type { PastoMapaData } from "@/hooks/useMapaData";

const fmtNum = (n: number, d = 0) => n.toFixed(d).replace(".", ",");

// Paleta unificada do Consumo Global (mesma do RelatorioPDF)
const STATUS_GLOBAL_CLASSES: Record<string, string> = {
  Baixo: "bg-[#E53935]/10 text-[#E53935] border-[#E53935]/30",
  "Atenção": "bg-[#FBC02D]/15 text-[#A17E00] border-[#FBC02D]/40",
  Ideal: "bg-[#43A047]/10 text-[#43A047] border-[#43A047]/30",
  Alto: "bg-[#1E88E5]/10 text-[#1E88E5] border-[#1E88E5]/30",
};

function statusBadge(status: string | null) {
  if (!status) return null;
  return (
    <Badge
      variant="outline"
      className={STATUS_GLOBAL_CLASSES[status] || "bg-muted text-muted-foreground border-muted"}
    >
      {status}
    </Badge>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function formatShortDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pasto: PastoMapaData | null;
}

export default function PastoInfoModal({ open, onOpenChange, pasto }: Props) {
  if (!pasto) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            {pasto.pasto_nome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <CarenciaBadge dataFimCarencia={(pasto as any).data_fim_carencia} />

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status consumo</span>
            {statusBadge(pasto.status_consumo) || <span className="text-sm">—</span>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InfoItem icon={Beef} label="Animais" value={String(pasto.num_animais)} />
            <InfoItem
              icon={Droplets}
              label="Consumo global"
              value={pasto.consumo_medio != null ? `${fmtNum(pasto.consumo_medio, 1)} g` : "—"}
            />
            <InfoItem
              icon={TrendingUp}
              label="Peso médio"
              value={pasto.peso_medio_kg != null ? `${fmtNum(pasto.peso_medio_kg, 1)} kg` : "—"}
            />
            <InfoItem label="Categoria" value={pasto.categoria || "—"} />
            <InfoItem label="Sexo" value={pasto.sexo || "—"} />
          </div>

          <div className="border-t pt-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Última movimentação:</span>
              <span className="font-medium">{formatDate(pasto.ultima_movimentacao)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Última salga:</span>
              <span className="font-medium">
                {pasto.ultima_visita_tipo === "cocho_cheio"
                  ? `${formatShortDate(pasto.ultimo_cocho_cheio)} — Cocho Cheio`
                  : formatDate(pasto.ultima_salga)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Última salga:</span>
              <span className="font-medium">
                {pasto.ultima_salga
                  ? `${formatShortDate(pasto.ultima_salga)} (${pasto.ultima_salga_sacos ?? 0} sacos)`
                  : "—"}
              </span>
            </div>
            {pasto.ultimo_cocho_cheio && (!pasto.ultima_salga || new Date(pasto.ultimo_cocho_cheio).getTime() > new Date(pasto.ultima_salga).getTime()) && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Último Cocho Cheio:</span>
                <span className="font-medium">{formatShortDate(pasto.ultimo_cocho_cheio)}</span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon?: any; label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}
