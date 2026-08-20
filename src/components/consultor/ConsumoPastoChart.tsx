import {
  CartesianGrid,
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
  real: number;
  esperado: number;
}

/**
 * Gráfico "Consumo por Pasto — Real x Esperado" (visita de Rotina).
 * Omitido inteiramente quando há menos de 2 pastos com ambos os valores.
 */
export default function ConsumoPastoChart({ pontos }: { pontos: ConsumoPastoPonto[] }) {
  const dados = pontos.filter(p => p.real > 0 && p.esperado > 0);
  if (dados.length < 2) return null;

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2" style={{ borderColor: "#E7E3D6" }}>
      <div
        className="text-[11px] uppercase tracking-wide font-bold"
        style={{ color: "#14432B", fontFamily: "'Manrope', sans-serif" }}
      >
        Consumo por Pasto — Real x Esperado
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dados} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
            <CartesianGrid stroke="#E7E3D6" strokeDasharray="3 3" />
            <XAxis dataKey="letra" tick={{ fontSize: 11, fill: "#767066" }} />
            <YAxis tick={{ fontSize: 11, fill: "#767066" }} />
            <Tooltip
              formatter={(v: number, name: string) => [`${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}`, name]}
              labelFormatter={l => `Pasto ${l}`}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="real" name="Consumo Real" stroke="#14432B" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="esperado" name="Consumo Esperado" stroke="#C9A84C" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px]" style={{ color: "#767066" }}>
        Valores em g/cab/dia, por pasto avaliado na ordem de lançamento.
      </p>
    </div>
  );
}
