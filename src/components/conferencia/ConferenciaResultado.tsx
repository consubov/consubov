import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ClipboardCheck, MapPin, Beef, Droplets, Calendar, User, Package, Activity } from "lucide-react";

export interface DadosConferencia {
  fazenda: { id: string | null; nome: string };
  retiro: { id: string | null; nome: string };
  pasto: { id: string; nome: string; qr_uuid: string };
  num_animais: number;
  peso_medio_kg: number | null;
  categoria: string | null;
  sexo: string | null;
  produto_nome: string | null;
  consumo_medio_g: number | null;
  status_consumo: string | null;
  ultima_salga_data: string | null;
  ultima_salga_sacos: number | null;
  ultima_salga_responsavel: string | null;
  ultima_movimentacao_data: string | null;
  dias_desde_salga: number | null;
  dias_desde_movimentacao: number | null;
  eventos_mes: number;
  historico: HistoricoEvento[];
}

export interface HistoricoEvento {
  tipo: "salga" | "movimentacao" | "morte" | "pesagem" | "transferencia";
  data: string;
  descricao: string;
}

interface Props {
  dados: DadosConferencia;
  onVoltar: () => void;
  onRegistrarConferencia: () => void;
}

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function StatusBadge({ status }: { status: string | null }) {
  if (status === "Ideal") return <Badge className="bg-primary text-primary-foreground">🟢 Dentro da meta</Badge>;
  if (status === "Baixo" || status === "Alto") return <Badge className="bg-secondary text-secondary-foreground">🟡 Atenção</Badge>;
  if (status) return <Badge variant="destructive">🔴 Fora da meta</Badge>;
  return <Badge variant="outline">Sem dados</Badge>;
}

function Linha({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b last:border-0">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Icon className="w-4 h-4 shrink-0" />
        <span>{label}</span>
      </div>
      <span className="text-sm font-medium text-right">{value ?? "—"}</span>
    </div>
  );
}

const histLabel: Record<HistoricoEvento["tipo"], string> = {
  salga: "Salga",
  movimentacao: "Movimentação",
  morte: "Mortalidade",
  pesagem: "Ajuste de peso",
  transferencia: "Transferência",
};

export default function ConferenciaResultado({ dados, onVoltar, onRegistrarConferencia }: Props) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onVoltar} className="text-primary-foreground hover:bg-primary/80">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold truncate">{dados.pasto.nome}</h1>
          <p className="text-xs opacity-90 truncate">{dados.retiro.nome} • {dados.fazenda.nome}</p>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-4 max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">Situação atual</h2>
          <StatusBadge status={dados.status_consumo} />
        </div>

        <Card>
          <CardContent className="p-4">
            <Linha icon={MapPin} label="Fazenda" value={dados.fazenda.nome} />
            <Linha icon={MapPin} label="Retiro" value={dados.retiro.nome} />
            <Linha icon={Beef} label="Animais" value={dados.num_animais} />
            <Linha icon={Activity} label="Peso médio" value={dados.peso_medio_kg ? `${dados.peso_medio_kg} kg` : "—"} />
            <Linha icon={Activity} label="Categoria" value={dados.categoria} />
            <Linha icon={Activity} label="Sexo" value={dados.sexo} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <Linha icon={Package} label="Produto mineral" value={dados.produto_nome} />
            <Linha icon={Droplets} label="Consumo médio" value={dados.consumo_medio_g ? `${dados.consumo_medio_g} g/cab/dia` : "—"} />
            <Linha icon={Calendar} label="Última salga" value={dados.ultima_salga_data ? `${fmtDate(dados.ultima_salga_data)}${dados.ultima_salga_sacos != null ? ` — ${dados.ultima_salga_sacos} sacos` : ""}` : "—"} />
            <Linha icon={User} label="Responsável" value={dados.ultima_salga_responsavel} />
            <Linha
              icon={Calendar}
              label="Dias desde última salga"
              value={dados.dias_desde_salga !== null ? `${dados.dias_desde_salga} dias` : "—"}
            />
            <Linha icon={Calendar} label="Última movimentação" value={fmtDate(dados.ultima_movimentacao_data)} />
            <Linha
              icon={Calendar}
              label="Dias desde última movimentação"
              value={dados.dias_desde_movimentacao !== null ? `${dados.dias_desde_movimentacao} dias` : "—"}
            />
            <Linha icon={Activity} label="Eventos no mês" value={dados.eventos_mes} />
          </CardContent>
        </Card>

        <div>
          <h3 className="text-sm font-bold text-foreground mb-2">Histórico rápido</h3>
          <Card>
            <CardContent className="p-2">
              {dados.historico.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum evento recente.</p>
              )}
              {dados.historico.map((h, i) => (
                <div key={i} className="flex items-start justify-between gap-3 px-2 py-2 border-b last:border-0">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-primary">{histLabel[h.tipo]}</p>
                    <p className="text-sm text-foreground truncate">{h.descricao}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{fmtDateTime(h.data)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Button onClick={onRegistrarConferencia} size="lg" variant="secondary" className="w-full gap-2">
          <ClipboardCheck className="w-5 h-5" />
          REGISTRAR CONFERÊNCIA
        </Button>
      </main>
    </div>
  );
}
