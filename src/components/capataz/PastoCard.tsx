import { Card, CardContent } from "@/components/ui/card";

interface PastoCardProps {
  nome: string;
  numAnimais: number;
  pesoMedio: number | null;
  diasNoPasto: number | null;
  sacosHoje: number;
  status: 'feito' | 'pendente' | 'atrasado';
}

const statusConfig = {
  feito: { icon: '🟢', label: 'Salga feita' },
  pendente: { icon: '🟡', label: 'Pendente' },
  atrasado: { icon: '🔴', label: 'Atrasado' },
};

export default function PastoCard({ nome, numAnimais, pesoMedio, diasNoPasto, sacosHoje, status }: PastoCardProps) {
  const s = statusConfig[status];

  return (
    <Card className="border-border">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-semibold text-sm text-foreground">{nome}</span>
          <span className="text-xs" title={s.label}>{s.icon}</span>
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
