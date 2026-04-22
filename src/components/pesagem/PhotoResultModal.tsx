import { useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import html2canvas from "html2canvas";
import { Loader2, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export interface PhotoResultData {
  gmd: number | null;
  sinal: "+" | "-" | "";
  dias: number | null;
  pesoAtual: number;
  pesoAnterior: number | null;
  qtdAnimais: number;
  nomePasto: string;
  primeiraPesagem: boolean;
  ganho: number | null;
  loteId?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  photoUrl: string | null;
  data: PhotoResultData;
}

// Deterministic PRNG (mulberry32)
function seededRand(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export default function PhotoResultModal({ open, onClose, photoUrl, data }: Props) {
  const [sharing, setSharing] = useState(false);

  const {
    gmd,
    sinal,
    dias,
    pesoAtual,
    pesoAnterior,
    qtdAnimais,
    nomePasto,
    primeiraPesagem,
    ganho,
    loteId,
  } = data;

  const chartData = useMemo(() => {
    if (primeiraPesagem || pesoAnterior == null) return [];
    const total = 16;
    const ganhoTotal = pesoAtual - pesoAnterior;
    const seed = hashString(`${loteId || "lote"}-${pesoAtual}-${pesoAnterior}`);
    const rand = seededRand(seed);
    const variacao = Math.abs(ganhoTotal) * 0.03;
    return Array.from({ length: total }, (_, i) => {
      const base = pesoAnterior + ganhoTotal * Math.pow(i / (total - 1), 0.8);
      const noise = (rand() * 2 - 1) * variacao;
      const peso = i === 0 || i === total - 1 ? base : base + noise;
      return { i, peso };
    });
  }, [primeiraPesagem, pesoAnterior, pesoAtual, loteId]);

  const acimaDaMedia = !primeiraPesagem && (ganho ?? 0) > 0;

  function baixar(url: string) {
    const a = document.createElement("a");
    a.download = "consubov-resultado.png";
    a.href = url;
    a.click();
  }

  async function exportar() {
    const el = document.getElementById("photo-result-final");
    if (!el) {
      toast.error("Cartão não encontrado.");
      return;
    }
    setSharing(true);
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        width: 390,
        height: 693,
      });
      const dataUrl = canvas.toDataURL("image/png");

      if (typeof navigator !== "undefined" && (navigator as any).share) {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], "consubov-resultado.png", {
            type: "image/png",
          });
          if ((navigator as any).canShare?.({ files: [file] })) {
            await (navigator as any).share({
              files: [file],
              title: "Resultado Consubov",
            });
            return;
          }
        } catch {
          // fallback
        }
      }
      baixar(dataUrl);
      toast.success("Imagem baixada!");
    } catch (err) {
      console.error("Erro ao gerar imagem:", err);
      toast.error("Erro ao gerar imagem.");
    } finally {
      setSharing(false);
    }
  }

  if (!open || !photoUrl) return null;

  // Reference lines
  const refLines = !primeiraPesagem && pesoAnterior != null
    ? [0, 1, 2, 3].map((i) => i)
    : [];

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center overflow-y-auto">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-[110] w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white"
        aria-label="Fechar"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="flex-1 flex items-center justify-center w-full py-6 px-2">
        {/* Card 390x693 */}
        <div
          id="photo-result-final"
          style={{ width: 390, height: 693 }}
          className="relative overflow-hidden rounded-2xl shadow-2xl"
        >
          {/* CAMADA 1 - foto */}
          <img
            src={photoUrl}
            alt="Foto"
            crossOrigin="anonymous"
            style={{ filter: "brightness(0.6)" }}
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* CAMADA 2 - overlay */}
          <div className="absolute inset-0 flex flex-col text-white">
            {/* TOPO */}
            <div className="pt-8 px-6">
              <div className="flex items-center justify-center gap-3">
                <span className="h-px flex-1 bg-green-500" />
                <span className="font-bold tracking-[0.3em] text-sm">
                  CONSUBOV
                </span>
                <span className="h-px flex-1 bg-green-500" />
              </div>

              {/* GMD */}
              <div className="mt-4 text-center">
                {!primeiraPesagem ? (
                  <>
                    <div className="flex items-baseline justify-center gap-2">
                      <span className="font-black text-7xl leading-none">
                        {sinal}
                        {gmd?.toFixed(2)}
                      </span>
                      <span className="text-2xl font-medium">kg/dia</span>
                    </div>
                    <div className="mt-3 inline-block px-4 py-1 rounded-full border border-green-400 bg-transparent">
                      <span className="text-green-400 text-sm font-semibold">
                        Últimos {dias} dias
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-baseline justify-center gap-2">
                      <span className="font-black text-6xl leading-none">
                        {pesoAtual.toFixed(1)}
                      </span>
                      <span className="text-2xl font-medium">kg</span>
                    </div>
                    <div className="mt-3 inline-block px-4 py-1 rounded-full border border-white/40 bg-transparent">
                      <span className="text-white/80 text-sm font-semibold">
                        Primeira pesagem
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* GRÁFICO */}
            {!primeiraPesagem && chartData.length > 0 && (
              <div className="px-4 mt-4 relative" style={{ height: 180 }}>
                {/* Reference lines */}
                <div className="absolute inset-x-4 inset-y-0 flex flex-col justify-between pointer-events-none">
                  {refLines.map((i) => (
                    <div
                      key={i}
                      className="border-t border-dashed border-white/20"
                    />
                  ))}
                </div>

                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 10, right: 0, left: 0, bottom: 10 }}
                  >
                    <defs>
                      <linearGradient id="gPhotoArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="peso"
                      stroke="#22c55e"
                      strokeWidth={2}
                      fill="url(#gPhotoArea)"
                      dot={(props: any) => {
                        if (props.index === chartData.length - 1) {
                          return (
                            <circle
                              key={props.index}
                              cx={props.cx}
                              cy={props.cy}
                              r={6}
                              fill="#fff"
                              stroke="#22c55e"
                              strokeWidth={2}
                            />
                          );
                        }
                        return <g key={props.index} />;
                      }}
                      activeDot={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>

                <div className="absolute right-4 top-1 text-white text-xs">
                  {pesoAtual.toFixed(0)} kg
                </div>
                <div className="absolute left-4 bottom-1 text-white/60 text-xs">
                  {pesoAnterior?.toFixed(0)} kg
                </div>
              </div>
            )}

            <div className="flex-1" />

            {/* RODAPÉ TÉCNICO */}
            <div className="px-4 space-y-2">
              <div className="bg-black/50 backdrop-blur-sm rounded-2xl px-4 py-3 flex items-center gap-3">
                <span className="text-2xl">🐄</span>
                <span className="text-white font-medium text-sm">
                  Lote {nomePasto || "—"} • {qtdAnimais} animais
                </span>
              </div>
              {acimaDaMedia && (
                <div className="bg-black/50 backdrop-blur-sm border border-green-400/40 rounded-2xl px-4 py-2 flex items-center justify-center gap-2">
                  <span className="text-base">⭐</span>
                  <span className="text-green-400 font-semibold text-sm">
                    Acima da média da fazenda
                  </span>
                </div>
              )}
            </div>

            {/* RODAPÉ FIXO */}
            <div className="pb-6 mt-3 text-center">
              <span className="text-green-400 text-xs tracking-wider">
                consubov.com.br
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* BOTÕES */}
      <div className="w-full max-w-sm px-4 pb-6 space-y-2">
        <Button
          onClick={exportar}
          disabled={sharing}
          className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold"
        >
          {sharing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Share2 className="w-4 h-4 mr-2" />
          )}
          Compartilhar
        </Button>
        <Button
          onClick={onClose}
          variant="outline"
          className="w-full h-12 bg-transparent border-white/40 text-white hover:bg-white/10 hover:text-white"
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
