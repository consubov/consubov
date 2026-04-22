import { useEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import html2canvas from "html2canvas";
import { Loader2, Share2, X, Minus, Plus, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Check } from "lucide-react";
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

const INSIGHT_FRASES_TEXT: string[] = [
  "⭐ Acima da média da fazenda",
  "🏆 Melhor lote do mês",
  "📈 GMD em alta",
  "💪 Desempenho superior",
  "🎯 Meta atingida",
];

type SizeKey = "gmd" | "fazenda" | "subtitulo" | "badge" | "grafico" | "lote" | "insight" | "rodape";
type PosKey = "insight";

const DEFAULT_SIZES: Record<SizeKey, number> = {
  gmd: 76,
  fazenda: 13,
  subtitulo: 11,
  badge: 13,
  grafico: 170,
  lote: 14,
  insight: 13,
  rodape: 10,
};

const CHIPS: { label: string; key: SizeKey }[] = [
  { label: "GMD", key: "gmd" },
  { label: "Fazenda", key: "fazenda" },
  { label: "Lote/Animais", key: "subtitulo" },
  { label: "Dias", key: "badge" },
  { label: "Gráfico", key: "grafico" },
  { label: "Insight", key: "insight" },
];

interface InsightBadgeProps {
  fontSize: number;
  exporting: boolean;
  position: { x: number; y: number };
}
function InsightBadge({ fontSize, exporting, position }: InsightBadgeProps) {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (exporting) return;
    setFading(true);
    setTimeout(() => {
      setIdx((i) => (i + 1) % INSIGHT_FRASES_TEXT.length);
      setFading(false);
    }, 150);
  }

  if (!visible) {
    if (exporting) return null;
    return (
      <div
        style={{
          position: "absolute",
          left: 16 + position.x,
          bottom: 60 + position.y,
          opacity: 0.25,
          fontSize: 10,
          color: "white",
          padding: "4px 8px",
          cursor: "pointer",
          transition: "all 0.1s",
        }}
        onClick={(e) => {
          e.stopPropagation();
          setVisible(true);
        }}
      >
        toque para adicionar frase
      </div>
    );
  }

  const frase = INSIGHT_FRASES_TEXT[idx];

  return (
    <div
      style={{
        position: "absolute",
        left: 16 + position.x,
        bottom: 60 + position.y,
        userSelect: "none",
        transition: "all 0.1s",
      }}
    >
      <div
        onClick={handleClick}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (!exporting) setVisible(false);
        }}
        style={{
          padding: "6px 16px",
          borderRadius: 999,
          backgroundColor: "rgba(20, 83, 45, 0.8)",
          color: "#86efac",
          fontSize,
          fontWeight: 600,
          opacity: fading ? 0 : 1,
          transition: "opacity 150ms",
          display: "inline-block",
          cursor: "pointer",
        }}
      >
        {frase}
      </div>
    </div>
  );
}

export default function PhotoResultModal({ open, onClose, photoUrl, pesagemId }: Props) {
  const [sharing, setSharing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [sizes, setSizes] = useState<Record<SizeKey, number>>({ ...DEFAULT_SIZES });
  const [activeChip, setActiveChip] = useState<SizeKey>("gmd");
  const [positions, setPositions] = useState<Record<PosKey, { x: number; y: number }>>({
    insight: { x: 0, y: 0 },
  });
  const cardRef = useRef<HTMLDivElement>(null);

  // reset on open
  useEffect(() => {
    if (open) {
      setConfirmado(false);
      setSizes({ ...DEFAULT_SIZES });
      setActiveChip("gmd");
      setPositions({ insight: { x: 0, y: 0 } });
    }
  }, [open]);

  const resultado = usePesagemResultado(open ? pesagemId : null);
  const {
    loading,
    gmd,
    sinal,
    dias,
    pesoAtual,
    pesoAnterior,
    qtdAnimais,
    nomePasto,
    nomeFazenda,
    primeiraPesagem,
  } = resultado;

  const chartData = useMemo(() => {
    if (primeiraPesagem || pesoAnterior == null) return [];
    const ganho = pesoAtual - pesoAnterior;
    return Array.from({ length: 16 }, (_, i) => ({
      i,
      peso: Number((pesoAnterior + ganho * Math.pow(i / 15, 0.85)).toFixed(2)),
    }));
  }, [pesoAnterior, pesoAtual, primeiraPesagem]);

  const ganhoTotal = pesoAnterior == null ? 0 : pesoAtual - pesoAnterior;
  const domainMin = pesoAnterior == null ? 0 : pesoAnterior - Math.abs(ganhoTotal) * 0.05;
  const domainMax = pesoAnterior == null ? pesoAtual + 10 : pesoAtual + Math.abs(ganhoTotal) * 0.05;
  const gmdDisplay = gmd != null ? `${sinal}${gmd.toFixed(2)}` : "—";

  function adjust(delta: number) {
    setSizes((prev) => {
      const cur = prev[activeChip];
      const step = activeChip === "gmd" || activeChip === "grafico" ? 4 : 1;
      const min = activeChip === "gmd" ? 30 : activeChip === "grafico" ? 80 : 8;
      const max = activeChip === "gmd" ? 140 : activeChip === "grafico" ? 280 : 40;
      const next = Math.max(min, Math.min(max, cur + delta * step));
      return { ...prev, [activeChip]: next };
    });
  }

  function mover(elemento: PosKey, direcao: "up" | "down" | "left" | "right") {
    const delta = 10;
    setPositions((prev) => ({
      ...prev,
      [elemento]: {
        x: prev[elemento].x + (direcao === "right" ? delta : direcao === "left" ? -delta : 0),
        y: prev[elemento].y + (direcao === "up" ? delta : direcao === "down" ? -delta : 0),
      },
    }));
  }

  function baixar(url: string) {
    const a = document.createElement("a");
    a.download = "consubov-resultado.png";
    a.href = url;
    a.click();
  }

  async function exportar() {
    const el = cardRef.current;
    if (!el) {
      toast.error("Cartão não encontrado.");
      return;
    }

    setExporting(true);
    setSharing(true);

    await new Promise((r) => setTimeout(r, 100));

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
        } catch (err) {
          console.error("Erro share API:", err);
        }
      }

      baixar(url);
      toast.success("Imagem baixada!");
    } catch (error) {
      console.error("Erro ao gerar imagem:", error);
      toast.error("Erro ao gerar imagem.");
    } finally {
      setSharing(false);
      setExporting(false);
    }
  }

  if (!open || !photoUrl) return null;

  const showMetrics = !primeiraPesagem;
  const isInsightActive = activeChip === "insight";

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center overflow-y-auto"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.94)",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-[110] flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-sm"
        style={{ backgroundColor: "rgba(255,255,255,0.12)", color: "white" }}
        aria-label="Fechar"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="flex w-full items-start justify-center px-2 py-6">
        <div
          ref={cardRef}
          className="relative overflow-hidden shadow-2xl"
          style={{
            width: "min(390px, calc(100vw - 16px))",
            aspectRatio: "390 / 693",
            borderRadius: 24,
          }}
        >
          {/* Foto */}
          <img
            src={photoUrl}
            alt="Foto da pesagem"
            className="absolute inset-0 h-full w-full object-cover"
          />

          {/* Gradiente topo */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0"
            style={{
              height: "55%",
              background: "linear-gradient(to bottom, rgba(0,0,0,0.80) 0%, transparent 100%)",
            }}
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0"
            style={{
              height: "25%",
              background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)",
            }}
          />

          <div className="absolute inset-0 flex flex-col items-center" style={{ color: "white" }}>
            <div className="w-full px-6" style={{ marginTop: 28 }}>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1" style={{ backgroundColor: BRAND_GREEN }} />
                <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.3em" }}>
                  CONSUBOV
                </span>
                <div className="h-px flex-1" style={{ backgroundColor: BRAND_GREEN }} />
              </div>
            </div>

            <div
              className="mt-1 text-center"
              style={{
                fontSize: sizes.fazenda,
                color: "rgba(255,255,255,0.8)",
                fontWeight: 500,
              }}
            >
              {loading ? "—" : nomeFazenda || "—"}
            </div>

            <div
              className="text-center"
              style={{
                marginTop: 2,
                fontSize: sizes.subtitulo,
                color: "rgba(255,255,255,0.6)",
              }}
            >
              {loading
                ? "—"
                : `${qtdAnimais} animais  •  Lote ${nomePasto || "—"}`}
            </div>

            <div className="mt-4 text-center" style={{ lineHeight: 1 }}>
              {showMetrics ? (
                <>
                  <span style={{ fontSize: sizes.gmd, fontWeight: 900, color: "white" }}>
                    {loading ? "—" : gmdDisplay}
                  </span>
                  <span
                    style={{
                      fontSize: sizes.gmd * 0.3,
                      fontWeight: 300,
                      color: "white",
                      marginLeft: 6,
                    }}
                  >
                    kg/dia
                  </span>
                </>
              ) : (
                <span style={{ fontSize: sizes.gmd * 0.45, fontWeight: 700, color: "white" }}>
                  Primeira pesagem • {pesoAtual.toFixed(1)} kg
                </span>
              )}
            </div>

            {showMetrics && (
              <div className="mt-2">
                <div
                  style={{
                    padding: "4px 14px",
                    borderRadius: 999,
                    fontSize: sizes.badge,
                    fontWeight: 600,
                    border: `1px solid ${BRAND_GREEN}`,
                    color: "#4ade80",
                    backgroundColor: "rgba(34,197,94,0.08)",
                  }}
                >
                  {loading ? "— dias" : `Últimos ${dias} dias`}
                </div>
              </div>
            )}

            {showMetrics && chartData.length > 0 && (
              <div
                className="mt-3 w-full"
                style={{ height: sizes.grafico, position: "relative" }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 20, right: 55, left: 10, bottom: 10 }}
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke="rgba(255,255,255,0.12)"
                      strokeDasharray="3 3"
                    />
                    <XAxis hide dataKey="i" />
                    <YAxis hide domain={[domainMin, domainMax]} />
                    <Area
                      type="monotone"
                      dataKey="peso"
                      stroke={BRAND_GREEN}
                      strokeWidth={2.5}
                      fill={BRAND_GREEN}
                      fillOpacity={0.2}
                      dot={(props: any) => {
                        if (props.index !== chartData.length - 1)
                          return <g key={`dot-${props.index}`} />;
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
                <div
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 12,
                    fontSize: 12,
                    fontWeight: 500,
                    color: "white",
                  }}
                >
                  {pesoAtual.toFixed(1)} kg
                </div>
                <div
                  style={{
                    position: "absolute",
                    bottom: 4,
                    left: 12,
                    fontSize: 12,
                    color: "rgba(255,255,255,0.45)",
                  }}
                >
                  {pesoAnterior != null ? pesoAnterior.toFixed(1) : "—"} kg
                </div>
              </div>
            )}

            {showMetrics && (
              <InsightBadge
                fontSize={sizes.insight}
                exporting={exporting}
                position={positions.insight}
              />
            )}
          </div>

          <div
            className="absolute w-full text-center"
            style={{
              bottom: 12,
              fontSize: sizes.rodape,
              letterSpacing: "0.2em",
              color: BRAND_GREEN,
            }}
          >
            consubov.com.br
          </div>
        </div>
      </div>

      {/* Antes de confirmar: botão "Ficou bom!" */}
      {!confirmado && !exporting && (
        <div className="w-full max-w-sm px-4 pb-6" onClick={(e) => e.stopPropagation()}>
          <div className="space-y-2">
            <Button
              onClick={() => setConfirmado(true)}
              className="h-12 w-full bg-green-600 hover:bg-green-700 text-white font-semibold"
            >
              <Check className="mr-2 h-5 w-5" />
              Ficou bom!
            </Button>
            <Button onClick={onClose} variant="outline" className="h-12 w-full">
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Depois de confirmar: barra de controle + compartilhar */}
      {confirmado && !exporting && (
        <>
          <div className="w-full max-w-md px-3" onClick={(e) => e.stopPropagation()}>
            <div
              className="rounded-2xl p-2 mb-2"
              style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
            >
              <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
                {CHIPS.map((chip) => (
                  <button
                    key={chip.key}
                    onClick={() => setActiveChip(chip.key)}
                    className="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors"
                    style={{
                      backgroundColor:
                        activeChip === chip.key ? BRAND_GREEN : "rgba(255,255,255,0.10)",
                      color: activeChip === chip.key ? "black" : "rgba(255,255,255,0.85)",
                    }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between gap-3 px-1 pt-1">
                <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>
                  {CHIPS.find((c) => c.key === activeChip)?.label} · {sizes[activeChip]}px
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => adjust(-1)}
                    className="h-8 w-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "rgba(255,255,255,0.14)", color: "white" }}
                    aria-label="Diminuir"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => adjust(1)}
                    className="h-8 w-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "rgba(255,255,255,0.14)", color: "white" }}
                    aria-label="Aumentar"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Setas de movimento (apenas Insight por enquanto) */}
              {isInsightActive && (
                <div className="flex items-center justify-center gap-2 pt-2 mt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                  <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginRight: 4 }}>
                    Mover:
                  </span>
                  <button
                    onClick={() => mover("insight", "left")}
                    className="h-9 w-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: "rgba(255,255,255,0.14)", color: "white" }}
                    aria-label="Esquerda"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => mover("insight", "up")}
                    className="h-9 w-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: "rgba(255,255,255,0.14)", color: "white" }}
                    aria-label="Cima"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => mover("insight", "down")}
                    className="h-9 w-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: "rgba(255,255,255,0.14)", color: "white" }}
                    aria-label="Baixo"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => mover("insight", "right")}
                    className="h-9 w-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: "rgba(255,255,255,0.14)", color: "white" }}
                    aria-label="Direita"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="w-full max-w-sm px-4 pb-6" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-2">
              <Button onClick={exportar} disabled={sharing} className="h-12 w-full">
                {sharing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Share2 className="mr-2 h-4 w-4" />
                )}
                Compartilhar
              </Button>
              <Button onClick={onClose} variant="outline" className="h-12 w-full">
                Cancelar
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
