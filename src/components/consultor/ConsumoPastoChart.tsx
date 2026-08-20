import {
  CartesianGrid,
  Customized,
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
const OURO_LINHA = "#C9A84C";

const fmt = (v: number) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** Rótulo com halo branco, centralizado no próprio ponto e empilhado (maior acima, menor abaixo). */
function valueLabel(color: string, dados: any[], serie: "real" | "esperado") {
  return (props: any) => {
    const { x, y, value, index } = props;
    if (value == null || x == null || y == null) return null;
    const d = dados[index];
    const outra = Number(serie === "real" ? d?.esperado : d?.real);
    const atual = Number(value);
    const acima = atual > outra || (atual === outra && serie === "real");
    const dy = acima ? -9 : 16;
    return (
      <text
        x={x}
        y={y + dy}
        textAnchor="middle"
        fontSize={9}
        fontWeight={700}
        fill={color}
        stroke="#FFFFFF"
        strokeWidth={4}
        paintOrder="stroke"
        strokeLinejoin="round"
        style={{ pointerEvents: "none" }}
      >
        {fmt(Number(value))}
      </text>
    );
  };
}

/** Linhas guia tracejadas, na cor de cada série, do ponto até a letra no eixo X. */
function LeaderLines(props: any) {
  const { xAxisMap, yAxisMap, offset, dados } = props;
  const xAxis: any = Object.values(xAxisMap || {})[0];
  const yAxis: any = Object.values(yAxisMap || {})[0];
  if (!xAxis || !yAxis || !offset) return null;
  const bottom = offset.top + offset.height;
  const bw = xAxis.scale?.bandwidth ? xAxis.scale.bandwidth() / 2 : 0;
  return (
    <g style={{ pointerEvents: "none" }}>
      {dados.map((d: any, i: number) => {
        const x = xAxis.scale(d.eixo) + bw;
        return (
          <g key={i}>
            <line
              x1={x}
              y1={yAxis.scale(d.real) + 4}
              x2={x}
              y2={bottom + 6}
              stroke={VERDE}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <line
              x1={x}
              y1={yAxis.scale(d.esperado) + 4}
              x2={x}
              y2={bottom + 6}
              stroke={OURO_LINHA}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          </g>
        );
      })}
    </g>
  );
}

/** Tick do eixo X — apenas a letra. */
function AxisTick(props: any) {
  const { x, y, payload } = props;
  return (
    <text x={x} y={y + 14} textAnchor="middle" fontSize={10} fontWeight={700} fill="#1C1C1A">
      {payload.value}
    </text>
  );
}

/**
 * Gráfico "Consumo por Pasto — Real x Esperado" (visita de Rotina).
 * Omitido inteiramente quando há menos de 2 pastos com ambos os valores.
 */
export default function ConsumoPastoChart({ pontos }: { pontos: ConsumoPastoPonto[] }) {
  const dados = pontos
    .filter(p => p.real > 0 && p.esperado > 0)
    .map((p, i) => {
      const eixo = String.fromCharCode(65 + (i % 26));
      return { ...p, eixo, nome: p.nomeCompleto || `Pasto ${p.letra || eixo}` };
    });
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
          <LineChart data={dados} margin={{ top: 22, right: 32, left: -8, bottom: 32 }}>
            <CartesianGrid stroke="#E7E3D6" strokeDasharray="3 3" />
            <XAxis dataKey="eixo" interval={0} height={40} tickLine={false} tick={AxisTick} />
            <YAxis tick={{ fontSize: 11, fill: "#767066" }} />
            <Tooltip
              formatter={(v: number, name: string) => [fmt(Number(v)), name]}
              labelFormatter={(l, p: any) => p?.[0]?.payload?.nome || String(l)}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Customized component={(p: any) => <LeaderLines {...p} dados={dados} />} />
            <Line type="monotone" dataKey="real" name="Consumo Real" stroke={VERDE} strokeWidth={2} dot={{ r: 3 }}>
              <LabelList dataKey="real" content={valueLabel(VERDE, dados, "real")} />
            </Line>
            <Line
              type="monotone"
              dataKey="esperado"
              name="Consumo Esperado"
              stroke={OURO_LINHA}
              strokeWidth={2}
              dot={{ r: 3 }}
            >
              <LabelList dataKey="esperado" content={valueLabel(OURO, dados, "esperado")} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Tabela de referência letra → pasto */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
        {dados.map(d => (
          <div key={d.eixo} className="flex items-center gap-2 text-[11px]" style={{ color: "#1C1C1A" }}>
            <span className="font-bold" style={{ color: VERDE }}>{d.eixo}</span>
            <span className="truncate">— {d.nome}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px]" style={{ color: "#767066" }}>
        Valores em g/cab/dia, por pasto avaliado na ordem de lançamento.
      </p>
    </div>
  );
}
