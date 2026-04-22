import { useEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import html2canvas from "html2canvas";
import { Loader2, RefreshCw, Share2, X } from "lucide-react";
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

const INSIGHT_FRASES = [
  "⭐ Acima da média da fazenda",
  "🏆 Melhor lote do mês",
  "📈 GMD em alta",
  "💪 Desempenho superior",
  "🎯 Meta atingida",
  "",
];

function formatKg(value: number | null | undefined, digits = 0) {
  if (value == null || Number.isNaN(value)) return "0";
  return value.toFixed(digits);
}

// ---------- Draggable element ----------
interface DraggableElementProps {
  id: string;
  children: (fontSize: number) => React.ReactNode;
  initialX: number;
  initialY: number;
  initialFontSize?: number;
  exporting: boolean;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
}

function DraggableElement({
  id,
  children,
  initialX,
  initialY,
  initialFontSize = 14,
  exporting,
  selectedId,
  setSelectedId,
}: DraggableElementProps) {
  const [pos, setPos] = useState({ x: initialX, y: initialY });
  const [fontSize, setFontSize] = useState(initialFontSize);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);
  const hideTimer = useRef<number | null>(null);

  const isSelected = selectedId === id;
  const anySelected = selectedId !== null;

  function showControls() {
    setSelectedId(id);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      setSelectedId(null);
    }, 2000) as unknown as number;
  }

  function onPointerDown(e: React.PointerEvent) {
    if (exporting) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
      moved: false,
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true;
    setPos({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
  }

  function onPointerUp() {
    if (!dragRef.current) return;
    if (!dragRef.current.moved) {
      showControls();
    } else {
      showControls();
    }
    dragRef.current = null;
  }

  useEffect(() => {
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, []);

  const showBorder = !exporting && isSelected;

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        touchAction: "none",
        cursor: exporting ? "default" : "move",
        userSelect: "none",
        padding: 4,
        borderRadius: 8,
        border: showBorder ? "1px dashed rgba(255,255,255,0.4)" : "1px dashed transparent",
      }}
    >
      {children(fontSize)}

      {!exporting && isSelected && (
        <div
          style={{
            position: "absolute",
            top: -34,
            right: 0,
            display: "flex",
            gap: 4,
            zIndex: 5,
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setFontSize((s) => Math.max(8, s - 2));
              showControls();
            }}
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: "rgba(0,0,0,0.7)",
              color: "white",
              fontSize: 12,
              fontWeight: 700,
              border: "1px solid rgba(255,255,255,0.3)",
            }}
          >
            A-
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setFontSize((s) => Math.min(120, s + 2));
              showControls();
            }}
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: "rgba(0,0,0,0.7)",
              color: "white",
              fontSize: 12,
              fontWeight: 700,
              border: "1px solid rgba(255,255,255,0.3)",
            }}
          >
            A+
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- Cow icon ----------
function CowIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 8c0-2 1.5-4 4-4h8c2.5 0 4 2 4 4v6c0 3-2 5-8 5s-8-2-8-5V8z" />
      <path d="M8 4L6 2M16 4l2-2" />
      <circle cx="9" cy="10" r="1" fill="white" />
      <circle cx="15" cy="10" r="1" fill="white" />
      <path d="M10 14c.5.7 1 1 2 1s1.5-.3 2-1" />
      <path d="M2 9c-.5 0-1 .5-1 1.5S2 12 2 12M22 9c.5 0 1 .5 1 1.5S22 12 22 12" />
    </svg>
  );
}

// ---------- Insight Badge ----------
interface InsightBadgeProps {
  exporting: boolean;
}
function InsightBadge({ exporting }: InsightBadgeProps) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  function next(e: React.MouseEvent) {
    e.stopPropagation();
    setVisible(false);
    setTimeout(() => {
      setIndex((i) => (i + 1) % INSIGHT_FRASES.length);
      setVisible(true);
    }, 200);
  }

  const frase = INSIGHT_FRASES[index];
  if (!frase) {
    if (exporting) return null;
    return (
      <button
        onClick={next}
        style={{
          padding: "6px 12px",
          borderRadius: 999,
          border: "1px dashed rgba(255,255,255,0.3)",
          backgroundColor: "rgba(0,0,0,0.3)",
          color: "rgba(255,255,255,0.5)",
          fontSize: 12,
        }}
      >
        + insight
      </button>
    );
  }

  return (
    <button
      onClick={next}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 14px",
        borderRadius: 999,
        backgroundColor: "rgba(34,197,94,0.22)",
        color: "white",
        fontSize: 13,
        fontWeight: 600,
        opacity: visible ? 1 : 0,
        transition: "opacity 200ms",
        border: "none",
      }}
    >
      <span>{frase}</span>
      {!exporting && (
        <RefreshCw size={8} style={{ opacity: 0.6, marginLeft: 2 }} />
      )}
    </button>
  );
}

// ---------- Main Modal ----------
export default function PhotoResultModal({ open, onClose, photoUrl, pesagemId }: Props) {
  const [sharing, setSharing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

    setSelectedId(null);
    setExporting(true);
    setSharing(true);

    // wait one frame so the controls / borders unmount before capture
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await new Promise((r) => setTimeout(r, 50));

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

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center overflow-y-auto"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.94)" }}
      onClick={() => setSelectedId(null)}
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
          onClick={(e) => e.stopPropagation()}
        >
          {/* Foto pura, sem filtro brightness */}
          <img
            src={photoUrl}
            alt="Foto da pesagem"
            className="absolute inset-0 h-full w-full object-cover"
          />

          {/* Gradiente topo */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0"
            style={{
              height: 256,
              background: "linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%)",
            }}
          />
          {/* Gradiente rodapé */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0"
            style={{
              height: 192,
              background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)",
            }}
          />

          {/* Elementos arrastáveis */}
          <div className="absolute inset-0" style={{ color: "white" }}>
            {/* CONSUBOV */}
            <DraggableElement
              id="brand"
              initialX={40}
              initialY={28}
              initialFontSize={14}
              exporting={exporting}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
            >
              {(fs) => (
                <div className="flex items-center gap-3" style={{ width: 280 }}>
                  <div className="h-px flex-1" style={{ backgroundColor: BRAND_GREEN }} />
                  <span style={{ fontSize: fs, fontWeight: 700, letterSpacing: "0.3em" }}>
                    CONSUBOV
                  </span>
                  <div className="h-px flex-1" style={{ backgroundColor: BRAND_GREEN }} />
                </div>
              )}
            </DraggableElement>

            {/* Animais + pasto (topo) */}
            <DraggableElement
              id="animais-topo"
              initialX={70}
              initialY={62}
              initialFontSize={12}
              exporting={exporting}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
            >
              {(fs) => (
                <div
                  style={{
                    fontSize: fs,
                    color: "rgba(255,255,255,0.7)",
                    width: 220,
                    textAlign: "center",
                  }}
                >
                  {loading ? "—" : `${qtdAnimais} animais • ${nomePasto || "—"}`}
                </div>
              )}
            </DraggableElement>

            {/* GMD */}
            <DraggableElement
              id="gmd"
              initialX={50}
              initialY={100}
              initialFontSize={72}
              exporting={exporting}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
            >
              {(fs) => (
                <div className="flex items-end gap-2">
                  <span style={{ fontSize: fs, fontWeight: 800, lineHeight: 1 }}>
                    {loading ? "—" : gmdDisplay}
                  </span>
                  <span style={{ fontSize: fs * 0.32, fontWeight: 600, paddingBottom: fs * 0.04 }}>
                    kg/dia
                  </span>
                </div>
              )}
            </DraggableElement>

            {/* Badge dias */}
            <DraggableElement
              id="dias"
              initialX={110}
              initialY={200}
              initialFontSize={13}
              exporting={exporting}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
            >
              {(fs) => (
                <div
                  style={{
                    padding: "4px 14px",
                    borderRadius: 999,
                    fontSize: fs,
                    fontWeight: 600,
                    border:
                      primeiraPesagem || loading
                        ? "1px solid rgba(255,255,255,0.34)"
                        : `1px solid ${BRAND_GREEN}`,
                    backgroundColor:
                      primeiraPesagem || loading ? "rgba(255,255,255,0.12)" : "rgba(34,197,94,0.08)",
                    color:
                      primeiraPesagem || loading ? "rgba(255,255,255,0.84)" : BRAND_GREEN,
                  }}
                >
                  {loading
                    ? "— dias"
                    : primeiraPesagem
                      ? "Primeira pesagem"
                      : `Últimos ${dias} dias`}
                </div>
              )}
            </DraggableElement>

            {/* Gráfico */}
            {!loading && !primeiraPesagem && chartData.length > 0 && (
              <DraggableElement
                id="chart"
                initialX={10}
                initialY={260}
                initialFontSize={12}
                exporting={exporting}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
              >
                {(fs) => (
                  <div style={{ width: 360, height: 200, position: "relative" }}>
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
                        right: 16,
                        fontSize: fs,
                        fontWeight: 500,
                        color: "white",
                      }}
                    >
                      {formatKg(pesoAtual)} kg
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        bottom: 4,
                        left: 16,
                        fontSize: fs,
                        color: "rgba(255,255,255,0.5)",
                      }}
                    >
                      {formatKg(pesoAnterior)} kg
                    </div>
                  </div>
                )}
              </DraggableElement>
            )}

            {/* Lote (rodapé) */}
            <DraggableElement
              id="lote"
              initialX={30}
              initialY={520}
              initialFontSize={14}
              exporting={exporting}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
            >
              {(fs) => (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 16,
                    backgroundColor: "rgba(0,0,0,0.5)",
                    backdropFilter: "blur(10px)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    color: "white",
                    fontSize: fs,
                    fontWeight: 500,
                  }}
                >
                  <CowIcon size={fs + 6} />
                  <span>{loading ? "Carregando..." : `Lote ${nomePasto || "—"}`}</span>
                </div>
              )}
            </DraggableElement>

            {/* Insight badge */}
            <DraggableElement
              id="insight"
              initialX={70}
              initialY={585}
              initialFontSize={13}
              exporting={exporting}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
            >
              {() => <InsightBadge exporting={exporting} />}
            </DraggableElement>

            {/* URL */}
            <DraggableElement
              id="url"
              initialX={120}
              initialY={650}
              initialFontSize={12}
              exporting={exporting}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
            >
              {(fs) => (
                <div
                  style={{
                    fontSize: fs,
                    letterSpacing: "0.2em",
                    color: BRAND_GREEN,
                    textAlign: "center",
                    width: 160,
                  }}
                >
                  consubov.com.br
                </div>
              )}
            </DraggableElement>
          </div>
        </div>
      </div>

      <div
        className="w-full max-w-sm px-4 pb-6"
        onClick={(e) => e.stopPropagation()}
      >
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
