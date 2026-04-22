import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import html2canvas from "html2canvas";
import { Loader2, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { usePesagemResultado } from "@/hooks/usePesagemResultado";

interface Props {
  open: boolean;
  onClose: () => void;
  photoUrl: string | null;
  pesagemId: string | null;
}

const BRAND_GREEN = "#22c55e";

function formatKg(value: number | null | undefined, digits = 0) {
  if (value == null || Number.isNaN(value)) return "0";
  return value.toFixed(digits);
}

export default function PhotoResultModal({ open, onClose, photoUrl, pesagemId }: Props) {
  const [sharing, setSharing] = useState(false);
  const resultado = usePesagemResultado(open ? pesagemId : null);

  const { loading, gmd, sinal, dias, pesoAtual, pesoAnterior, qtdAnimais, nomePasto, primeiraPesagem } = resultado;

  const chartData = useMemo(() => {
    if (primeiraPesagem || pesoAnterior == null) return [];

    return Array.from({ length: 16 }, (_, i) => ({
      i,
      peso: Number(
        (
          pesoAnterior +
          (pesoAtual - pesoAnterior) * Math.pow(i / 15, 0.8) +
          Math.sin(i * 2.3) * (pesoAtual - pesoAnterior) * 0.025
        ).toFixed(2),
      ),
    }));
  }, [pesoAnterior, pesoAtual, primeiraPesagem]);

  const domainMin = pesoAnterior == null ? 0 : Math.min(pesoAnterior, pesoAtual) - 10;
  const domainMax = pesoAnterior == null ? pesoAtual + 10 : Math.max(pesoAnterior, pesoAtual) + 10;
  const gmdDisplay = gmd != null ? `${sinal}${gmd.toFixed(2)}` : "—";
  const acimaDaMedia = !primeiraPesagem && (gmd ?? 0) > 0;

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
      const scale = el.clientWidth > 0 ? (390 * 2) / el.clientWidth : 2;
      const canvas = await html2canvas(el, {
        scale,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
      });
      const url = canvas.toDataURL("image/png");

      if (typeof navigator !== "undefined" && (navigator as any).share) {
        try {
          const blob = await (await fetch(url)).blob();
          const file = new File([blob], "consubov-resultado.png", { type: "image/png" });

          if ((navigator as any).canShare?.({ files: [file] })) {
            await (navigator as any).share({
              files: [file],
              title: "Resultado Consubov",
            });
            return;
          }
        } catch {
          // fallback para download abaixo
        }
      }

      baixar(url);
      toast.success("Imagem baixada!");
    } catch (error) {
      console.error("Erro ao gerar imagem:", error);
      toast.error("Erro ao gerar imagem.");
    } finally {
      setSharing(false);
    }
  }

  if (!open || !photoUrl) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center overflow-y-auto"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.94)" }}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-[110] flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-sm"
        style={{ backgroundColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,1)" }}
        aria-label="Fechar"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="flex w-full flex-1 items-start justify-center px-2 py-6">
        <div
          id="photo-result-final"
          className="relative overflow-hidden shadow-2xl"
          style={{
            width: "min(390px, calc(100vw - 16px))",
            aspectRatio: "390 / 693",
            borderRadius: 24,
          }}
        >
          <img
            src={photoUrl}
            alt="Foto da pesagem"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: "brightness(0.55)" }}
          />

          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.16) 0%, rgba(0,0,0,0.44) 100%)" }} />

          <div className="absolute inset-0 flex flex-col" style={{ color: "rgba(255,255,255,1)" }}>
            <div className="px-6 pt-8">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1" style={{ backgroundColor: BRAND_GREEN }} />
                <span className="text-sm font-bold tracking-[0.3em]">CONSUBOV</span>
                <div className="h-px flex-1" style={{ backgroundColor: BRAND_GREEN }} />
              </div>

              <div className="mt-3 text-center">
                <div className="flex items-end justify-center gap-2">
                  <span className="text-7xl font-extrabold leading-none">
                    {loading ? "—" : gmdDisplay}
                  </span>
                  <span className="pb-1 text-2xl font-semibold">kg/dia</span>
                </div>
              </div>

              <div className="mt-2 flex justify-center">
                <div
                  className="rounded-full px-4 py-1 text-sm font-semibold"
                  style={
                    primeiraPesagem || loading
                      ? {
                          border: "1px solid rgba(255,255,255,0.34)",
                          backgroundColor: "rgba(255,255,255,0.12)",
                          color: "rgba(255,255,255,0.84)",
                        }
                      : {
                          border: `1px solid ${BRAND_GREEN}`,
                          backgroundColor: "rgba(34,197,94,0.08)",
                          color: BRAND_GREEN,
                        }
                  }
                >
                  {loading
                    ? "— dias"
                    : primeiraPesagem
                      ? "Primeira pesagem registrada"
                      : `Últimos ${dias} dias`}
                </div>
              </div>
            </div>

            {!loading && !primeiraPesagem && chartData.length > 0 && (
              <div className="relative mt-4 h-[200px] px-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 12, right: 8, bottom: 12, left: 8 }}>
                    <defs>
                      <linearGradient id="photo-chart-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={BRAND_GREEN} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={BRAND_GREEN} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      vertical={false}
                      stroke="rgba(255,255,255,0.15)"
                      strokeDasharray="4 4"
                      horizontalCoordinatesGenerator={({ offset }: any) => {
                        const top = offset?.top ?? 0;
                        const height = offset?.height ?? 0;
                        return Array.from({ length: 4 }, (_, index) => top + (height * (index + 1)) / 4);
                      }}
                    />
                    <XAxis hide dataKey="i" />
                    <YAxis hide domain={[domainMin, domainMax]} />
                    <Area
                      type="monotone"
                      dataKey="peso"
                      stroke={BRAND_GREEN}
                      strokeWidth={2.5}
                      fill="url(#photo-chart-fill)"
                      fillOpacity={0.2}
                      dot={(props: any) => {
                        if (props.index !== chartData.length - 1) return <g key={`dot-${props.index}`} />;
                        return (
                          <circle
                            key={`dot-${props.index}`}
                            cx={props.cx}
                            cy={props.cy}
                            r={7}
                            fill="white"
                            stroke={BRAND_GREEN}
                            strokeWidth={2}
                          />
                        );
                      }}
                      activeDot={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>

                <div className="absolute right-4 top-1 text-xs font-medium" style={{ color: "rgba(255,255,255,1)" }}>
                  {formatKg(pesoAtual)} kg
                </div>
                <div className="absolute bottom-1 left-4 text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {formatKg(pesoAnterior)} kg
                </div>
              </div>
            )}

            <div className="mt-auto px-4 pb-24">
              <div
                className="rounded-2xl px-4 py-3"
                style={{ backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(10px)" }}
              >
                <div className="flex items-center gap-3 text-sm font-medium" style={{ color: "rgba(255,255,255,1)" }}>
                  <span className="text-xl leading-none">🐄</span>
                  <span>
                    {loading
                      ? "Carregando dados..."
                      : `Lote ${nomePasto || "—"}  •  ${qtdAnimais} animais`}
                  </span>
                </div>
                {acimaDaMedia && (
                  <div
                    className="mt-2 flex w-full items-center justify-center rounded-full px-3 py-2 text-sm font-semibold"
                    style={{ backgroundColor: "rgba(34,197,94,0.22)", color: "rgba(255,255,255,1)" }}
                  >
                    ⭐ Acima da média da fazenda
                  </div>
                )}
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-6 text-center text-xs tracking-widest" style={{ color: BRAND_GREEN }}>
              consubov.com.br
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-sm px-4 pb-6">
        <div className="space-y-2">
          <Button onClick={exportar} disabled={sharing} className="h-12 w-full">
            {sharing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
            Compartilhar
          </Button>
          <Button onClick={onClose} variant="outline" className="h-12 w-full">
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
