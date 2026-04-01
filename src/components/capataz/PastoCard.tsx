import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PastoCardProps {
  nome: string;
  numAnimais: number;
  pesoMedio: number | null;
  diasNoPasto: number | null;
  sacosHoje: number;
  status: 'feito' | 'pendente' | 'atrasado';
  statusConsumo?: string | null;
  indiceConsumo?: number | null;
}

const statusConfig = {
  feito: { icon: '🟢', label: 'Salga feita' },
  pendente: { icon: '🟡', label: 'Pendente' },
  atrasado: { icon: '🔴', label: 'Atrasado' },
};

const consumoBadge: Record<string, { emoji: string; className: string }> = {
  ABAIXO: { emoji: '🔴', className: 'bg-destructive text-destructive-foreground' },
  IDEAL: { emoji: '🟢', className: 'bg-primary text-primary-foreground' },
  ACIMA: { emoji: '🔵', className: 'bg-blue-600 text-white' },
};

export default function PastoCard({ nome, numAnimais, pesoMedio, diasNoPasto, sacosHoje, status, statusConsumo, indiceConsumo }: PastoCardProps) {
  const s = statusConfig[status];
  const cb = statusConsumo ? consumoBadge[statusConsumo] : null;

  return (
    <Card className="border-border">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-semibold text-sm text-foreground">{nome}</span>
          <div className="flex items-center gap-1.5">
            {cb && (
              <Badge className={`text-[10px] px-1.5 py-0 h-5 ${cb.className}`}>
                {cb.emoji} {statusConsumo} {indiceConsumo != null ? `(${indiceConsumo.toFixed(2)})` : ''}
              </Badge>
            )}
            <span className="text-xs" title={s.label}>{s.icon}</span>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1 text-xs text-muted-foreground">
          <div className="text-center">
            <p className="font-semibold text-foreground">{numAnimais}</p>
            <p>animais</p>
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">{pesoMedio ?? '—'}</p>
            <p>kg</p>
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">{diasNoPasto ?? 0}</p>
            <p>dias</p>
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">{sacosHoje}</p>
            <p>sacos</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
