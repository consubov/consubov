import { useEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import html2canvas from "html2canvas";
import { Loader2, Share2, X, Minus, Plus } from "lucide-react";
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

function CowIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="white"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M6 8 C3 7 1 9 2 12 L5 16" />
      <path d="M26 8 C29 7 31 9 30 12 L27 16" />
      <path d="M5 16 C5 23 9 27 16 27 C23 27 27 23 27 16 C27 10 23 6 16 6 C9 6 5 10 5 16Z" />
      <circle cx="11.5" cy="16" r="1.8" fill="white" stroke="none" />
      <circle cx="20.5" cy="16" r="1.8" fill="white" stroke="none" />
      <path d="M12 21.5 Q16 24 20 21.5" strokeWidth="1.5" />
      <path d="M9 6 C7 3 3 3 2 7" />
      <path d="M23 6 C25 3 29 3 30 7" />
    </svg>
  );
}

interface InsightBadgeProps {
  fontSize: number;
  exporting: boolean;
}
function InsightBadge({ fontSize, exporting }: InsightBadgeProps) {
  const [idx, setIdx] = useState(0);
  const [pos, setPos] = useState({ x: 16, y: 0 });
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [dragging, setDragging] = useState(false);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const movedRef = useRef(false);
  const longPressedRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 3000);
    return () => clearTimeout(t);
  }, []);

  function clearLongPress() {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  function onTouchStart(e: React.TouchEvent) {
    if (exporting) return;
    const t = e.touches[0];
    movedRef.current = false;
    longPressedRef.current = false;
    dragStartRef.current = { x: t.clientX, y: t.clientY, ox: pos.x, oy: pos.y };
    longPressRef.current = setTimeout(() => {
      longPressedRef.current = true;
      setVisible(false);
    }, 500);
  }

  function onTouchMove(e: React.TouchEvent) {
    if (exporting || !dragStartRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - dragStartRef.current.x;
    const dy = t.clientY - dragStartRef.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      movedRef.current = true;
      clearLongPress();
      setDragging(true);
      // y grows downward in screen, but we use bottom offset → invert dy
      setPos({
        x: dragStartRef.current.ox + dx,
        y: dragStartRef.current.oy - dy,
      });
    }
  }

  function onTouchEnd() {
    clearLongPress();
    const wasDrag = movedRef.current;
    const wasLong = longPressedRef.current;
    dragStartRef.current = null;
    setDragging(false);
    if (exporting) return;
    if (!wasDrag && !wasLong) {
      // simple tap → rotate
      setFading(true);
      setTimeout(() => {
        setIdx((i) => (i + 1) % INSIGHT_FRASES_TEXT.length);
        setFading(false);
      }, 150);
    }
  }

  if (!visible) {
    if (exporting) return null;
    return (
      <div
        style={{
          position: "absolute",
          left: pos.x,
          bottom: 60 + pos.y,
          opacity: 0.25,
          fontSize: 10,
          color: "white",
          padding: "4px 8px",
          cursor: "pointer",
        }}
        onTouchEnd={(e) => {
          e.stopPropagation();
          setVisible(true);
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
        left: pos.x,
        bottom: 60 + pos.y,
        touchAction: "none",
        userSelect: "none",
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div
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
          boxShadow: dragging ? "0 0 0 1px rgba(255,255,255,0.3)" : "none",
        }}
      >
        {frase}
      </div>
      {showHint && !exporting && (
        <div
          style={{
            fontSize: 8,
            color: "rgba(255,255,255,0.25)",
            marginTop: 2,
            textAlign: "center",
          }}
        >
          ↕ arraste • toque p/ mudar • segure p/ ocultar
        </div>
      )}
    </div>
  );
}

export default function PhotoResultModal({ open, onClose, photoUrl, pesagemId }: Props) {
  const [sharing, setSharing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sizes, setSizes] = useState<Record<SizeKey, number>>({ ...DEFAULT_SIZES });
  const [activeChip, setActiveChip] = useState<SizeKey>("gmd");
  const cardRef = useRef<HTMLDivElement>(null);

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
    return Array.from({ length: 16 }, (_, i) => ({
      i,
      peso: Number(
        (
          pesoAnterior +
          (pesoAtual - pesoAnterior) * Math.pow(i / 15, 0.75) +
          Math.sin(i * 1.8) * Math.abs(pesoAtual - pesoAnterior) * 0.03
        ).toFixed(2),
      ),
    }));
  }, [pesoAnterior, pesoAtual, primeiraPesagem]);

  const domainMin = pesoAnterior == null ? 0 : Math.min(pesoAnterior, pesoAtual) - 8;
  const domainMax = pesoAnterior == null ? pesoAtual + 10 : Math.max(pesoAnterior, pesoAtual) + 8;
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

    // hide control bar + wait
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

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center overflow-y-auto"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.94)" }}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-[110] flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-sm"
        style={{ backgroundColor: "rgba(255,255,255,0.12)", color: "white" }}
        aria-label="Fechar"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="flex w-full flex-1 items-start justify-center px-2 py-6">
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

          {/* Gradiente topo (55%) */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0"
            style={{
              height: "55%",
              background: "linear-gradient(to bottom, rgba(0,0,0,0.80) 0%, transparent 100%)",
            }}
          />
          {/* Gradiente rodapé (25%) */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0"
            style={{
              height: "25%",
              background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)",
            }}
          />

          {/* Conteúdo vertical */}
          <div className="absolute inset-0 flex flex-col items-center" style={{ color: "white" }}>
            {/* [1] CONSUBOV */}
            <div className="w-full px-6" style={{ marginTop: 28 }}>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1" style={{ backgroundColor: BRAND_GREEN }} />
                <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.3em" }}>
                  CONSUBOV
                </span>
                <div className="h-px flex-1" style={{ backgroundColor: BRAND_GREEN }} />
              </div>
            </div>

            {/* [2] Fazenda */}
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

            {/* [3] Animais + Lote */}
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

            {/* [4] GMD */}
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

            {/* [5] Badge */}
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

            {/* [6] Gráfico */}
            {showMetrics && chartData.length > 0 && (
              <div
                className="mt-3 w-full"
                style={{ height: sizes.grafico, position: "relative" }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 10, right: 50, left: 10, bottom: 10 }}
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

            {/* [8] Insight */}
            {showMetrics && (
              <div className="mt-2 px-4">
                <InsightBadge fontSize={sizes.insight} exporting={exporting} />
              </div>
            )}
          </div>

          {/* [9] Rodapé URL */}
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

      {/* Barra de controle */}
      {!exporting && (
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
                {CHIPS.find((c) => c.key === activeChip)?.label} · {sizes[activeChip]}
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
          </div>
        </div>
      )}

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
    </div>
  );
}
