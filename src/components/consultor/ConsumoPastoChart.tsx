import {
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface ConsumoPastoPonto {
  letra: string;
  nomeCompleto?: string;
  real: number;
  esperado: number;
}

const VERDE = "#14432B";
const OURO = "#A8871F";

const fmt = (v: number) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** Rótulo com halo branco, sempre renderizado na frente da linha. */
function valueLabel(color: string, dados: any[], serie: "real" | "esperado") {
  return (props: any) => {
    const { x, y, value, index } = props;
    if (value == null || x == null || y == null) return null;
    const d = dados[index];
    const outra = serie === "real" ? d?.esperado : d?.real;
    // Alterna acima/abaixo quando os valores das duas séries estão próximos.
    const prox = d && Math.abs(Number(d.real) - Number(outra ?? 0)) / Math.max(1, Number(d.real)) < 0.08;
    const acima = serie === "real" ? true : !prox ? false : false;
    const dy = acima ? -8 : 14;
    return (
      <text
        x={x}
        y={y + dy}
        textAnchor="middle"
        fontSize={9}
        fontWeight={700}
        fill={color}
        stroke="#FFFFFF"
        strokeWidth={3}
        paintOrder="stroke"
        style={{ pointerEvents: "none" }}
      >
        {fmt(Number(value))}
      </text>
    );
  };
}

/** Tick do eixo X com linha conectora até o ponto. */
function AxisTick(props: any) {
  const { x, y, payload, index, total } = props;
  const row = total > 6 ? index % 2 : 0;
  const dy = 12 + row * 11;
  return (
    <g>
      <line x1={x} y1={y - 2} x2={x} y2={y + dy - 9} stroke="#B9B3A5" strokeWidth={1} />
      <text x={x} y={y + dy} textAnchor="middle" fontSize={9} fill="#4A463F">
        {payload.value}
      </text>
    </g>
  );
}

/**
 * Gráfico "Consumo por Pasto — Real x Esperado" (visita de Rotina).
 * Omitido inteiramente quando há menos de 2 pastos com ambos os valores.
 */
export default function ConsumoPastoChart({ pontos }: { pontos: ConsumoPastoPonto[] }) {
  const dados = pontos
    .filter(p => p.real > 0 && p.esperado > 0)
    .map(p => ({ ...p, eixo: p.nomeCompleto || p.letra }));
  if (dados.length < 2) return null;

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2" style={{ borderColor: "#E7E3D6" }}>
      <div
        className="text-[11px] uppercase tracking-wide font-bold"
        style={{ color: VERDE, fontFamily: "'Manrope', sans-serif" }}
      >
        Consumo por Pasto — Real x Esperado
      </div>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dados} margin={{ top: 22, right: 32, left: -8, bottom: 52 }}>
            <CartesianGrid stroke="#E7E3D6" strokeDasharray="3 3" />
            <XAxis
              dataKey="eixo"
              interval={0}
              height={62}
              tickLine={false}
              tick={(p: any) => <AxisTick {...p} total={dados.length} />}
            />
            <YAxis tick={{ fontSize: 11, fill: "#767066" }} />
            <Tooltip
              formatter={(v: number, name: string) => [fmt(Number(v)), name]}
              labelFormatter={l => String(l)}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="real" name="Consumo Real" stroke={VERDE} strokeWidth={2} dot={{ r: 3 }}>
              <LabelList dataKey="real" content={valueLabel(VERDE, dados, "real")} />
            </Line>
            <Line type="monotone" dataKey="esperado" name="Consumo Esperado" stroke="#C9A84C" strokeWidth={2} dot={{ r: 3 }}>
              <LabelList dataKey="esperado" content={valueLabel(OURO, dados, "esperado")} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px]" style={{ color: "#767066" }}>
        Valores em g/cab/dia, por pasto avaliado na ordem de lançamento.
      </p>
    </div>
  );
}
