import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Beef, Droplets, TrendingUp, Calendar, Package } from "lucide-react";
import type { PastoMapaData } from "@/hooks/useMapaData";

const fmtNum = (n: number, d = 0) => n.toFixed(d).replace(".", ",");

function statusBadge(status: string | null) {
  if (!status) return null;
  const variant = status === "Ideal" ? "default" : status === "Baixo" ? "destructive" : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
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
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status consumo</span>
            {statusBadge(pasto.status_consumo) || <span className="text-sm">—</span>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InfoItem icon={Beef} label="Animais" value={String(pasto.num_animais)} />
            <InfoItem
              icon={Droplets}
              label="Consumo médio"
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
              <span className="font-medium">{formatDate(pasto.ultima_salga)}</span>
            </div>
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
