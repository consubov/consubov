import { LineChart, Line, Area, AreaChart, ResponsiveContainer, ReferenceDot } from "recharts";
import bgImage from "@/assets/consubov-card-bg.jpg";
import type { PesagemResultado } from "@/hooks/usePesagemResultado";

interface Props {
  resultado: PesagemResultado;
}

export default function ConsubovResultCard({ resultado }: Props) {
  const {
    primeiraPesagem,
    gmd,
    sinal,
    dias,
    pesoAtual,
    pesoAnterior,
    qtdAnimais,
    nomePasto,
    ganho,
  } = resultado;

  const chartData = !primeiraPesagem && pesoAnterior != null
    ? [
        { name: "Anterior", peso: pesoAnterior },
        { name: "Atual", peso: pesoAtual },
      ]
    : [];

  const acimaDaMedia = !primeiraPesagem && (ganho ?? 0) > 0;

  return (
    <div
      id="consubov-result-card"
      style={{
        width: 390,
        height: 693,
        backgroundImage: `url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      className="relative overflow-hidden font-sans"
    >
      {/* dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/80" />

      <div className="relative z-10 flex flex-col h-full px-6 pt-8 pb-6">
        {/* TOPO */}
        <div className="flex items-center justify-center gap-3">
          <span className="h-px w-10 bg-[#22c55e]" />
          <span className="text-white font-bold tracking-[0.3em] text-sm">
            CONSUBOV
          </span>
          <span className="h-px w-10 bg-[#22c55e]" />
        </div>

        {/* CENTRO */}
        <div className="flex flex-col items-center justify-center mt-6 gap-3">
          {!primeiraPesagem ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-white font-black text-7xl leading-none">
                  {sinal}
                  {gmd?.toFixed(2)}
                </span>
                <span className="text-white/90 text-lg font-medium">kg/dia</span>
              </div>
              <div className="px-4 py-1 rounded-full border border-[#22c55e] bg-[#22c55e]/10">
                <span className="text-[#22c55e] text-sm font-semibold">
                  Últimos {dias} dias
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-white font-black text-6xl leading-none">
                  {pesoAtual.toFixed(1)}
                </span>
                <span className="text-white/90 text-lg font-medium">kg</span>
              </div>
              <div className="px-4 py-1 rounded-full border border-white/30 bg-white/10">
                <span className="text-white/80 text-sm font-semibold">
                  Primeira pesagem registrada
                </span>
              </div>
            </>
          )}
        </div>

        {/* GRÁFICO */}
        {!primeiraPesagem && (
          <div className="mt-6 h-[160px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 30, left: 30, bottom: 10 }}
              >
                <defs>
                  <linearGradient id="gAreaCard" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="peso"
                  stroke="#22c55e"
                  strokeWidth={3}
                  fill="url(#gAreaCard)"
                  dot={{ r: 6, fill: "#22c55e", stroke: "#fff", strokeWidth: 2 }}
                  activeDot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="absolute left-2 bottom-2 text-white/70 text-xs">
              {pesoAnterior?.toFixed(0)} kg
            </div>
            <div className="absolute right-2 top-2 text-white/70 text-xs">
              {pesoAtual.toFixed(0)} kg
            </div>
          </div>
        )}

        <div className="flex-1" />

        {/* RODAPÉ TÉCNICO */}
        <div className="space-y-2">
          <div className="bg-black/50 backdrop-blur-sm border border-white/10 rounded-2xl px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">🐄</span>
            <span className="text-white font-medium text-sm">
              Lote {nomePasto || "—"} • {qtdAnimais} animais
            </span>
          </div>
          {acimaDaMedia && (
            <div className="bg-[#22c55e]/90 rounded-2xl px-4 py-2 flex items-center gap-2">
              <span className="text-base">⭐</span>
              <span className="text-white font-semibold text-sm">
                Acima da média da fazenda
              </span>
            </div>
          )}
        </div>

        {/* RODAPÉ FIXO */}
        <div className="text-center mt-4">
          <span className="text-[#22c55e] text-xs tracking-wider">
            consubov.com.br
          </span>
        </div>
      </div>
    </div>
  );
}
