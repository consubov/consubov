import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MapaData, PastoMapaData } from "@/hooks/useMapaData";


interface Props {
  mapa: MapaData;
  onPastoClick: (pasto: PastoMapaData) => void;
  selectedPastoId?: string | null;
  selectingDestino?: boolean;
  highlightDestinos?: boolean;
}

type LabelLine = {
  text: string;
  fontSize: number;
  fontWeight: CSSProperties["fontWeight"];
  width: number;
};

type LabelLayout = {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  lines: LabelLine[];
  lineHeight: number;
  padding: number;
};

const MAP_COLORS = {
  background: "hsl(0 0% 100%)",
  line: "hsl(120 100% 25%)",
  text: "hsl(0 0% 0%)",
} as const;

function estimateTextWidth(text: string, fontSize: number, isBold = false) {
  const factor = isBold ? 0.64 : 0.58;
  return Array.from(text).reduce((total, char) => {
    if (char === " ") return total + fontSize * 0.32;
    if (/[0-9]/.test(char)) return total + fontSize * 0.56;
    if (/[A-Z]/.test(char)) return total + fontSize * 0.62;
    if (/[a-z]/.test(char)) return total + fontSize * 0.52;
    return total + fontSize * factor;
  }, 0);
}

function splitWordToFit(word: string, maxWidth: number, fontSize: number, isBold = false) {
  const chars = Array.from(word);
  const parts: string[] = [];
  let current = "";
  chars.forEach((char) => {
    const next = `${current}${char}`;
    if (!current || estimateTextWidth(next, fontSize, isBold) <= maxWidth) { current = next; return; }
    parts.push(current);
    current = char;
  });
  if (current) parts.push(current);
  return parts;
}

function wrapText(text: string, maxWidth: number, fontSize: number, isBold = false) {
  const normalized = text.trim();
  if (!normalized) return [""];
  const words = normalized.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";
  const pushWord = (word: string) => {
    if (estimateTextWidth(word, fontSize, isBold) <= maxWidth) {
      if (!currentLine) { currentLine = word; return; }
      const candidate = `${currentLine} ${word}`;
      if (estimateTextWidth(candidate, fontSize, isBold) <= maxWidth) { currentLine = candidate; } else { lines.push(currentLine); currentLine = word; }
      return;
    }
    const chunks = splitWordToFit(word, maxWidth, fontSize, isBold);
    chunks.forEach((chunk) => {
      if (!currentLine) { currentLine = chunk; return; }
      const candidate = `${currentLine} ${chunk}`;
      if (estimateTextWidth(candidate, fontSize, isBold) <= maxWidth) { currentLine = candidate; } else { lines.push(currentLine); currentLine = chunk; }
    });
  };
  words.forEach(pushWord);
  if (currentLine) lines.push(currentLine);
  return lines;
}

function pointInPolygon(x: number, y: number, coords: number[][]) {
  let inside = false;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const [xi, yi] = coords[i];
    const [xj, yj] = coords[j];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function getBounds(coords: number[][]) {
  const xs = coords.map(([x]) => x);
  const ys = coords.map(([, y]) => y);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

function getCentroid(coords: number[][]) {
  if (!coords.length) return { x: 0, y: 0 };
  const x = coords.reduce((sum, [cx]) => sum + cx, 0) / coords.length;
  const y = coords.reduce((sum, [, cy]) => sum + cy, 0) / coords.length;
  return { x, y };
}

function buildLabelLines(pasto: PastoMapaData, fontSize: number, maxTextWidth: number) {
  const dataText = `${pasto.num_animais} cab`;
  const nameLines = wrapText(pasto.pasto_nome, maxTextWidth, fontSize, true);
  const dataFontSize = Math.max(fontSize * 0.78, 6);
  const dataLines = wrapText(dataText, maxTextWidth, dataFontSize, false);
  const lines: LabelLine[] = [
    ...nameLines.map((text) => ({ text, fontSize, fontWeight: 700 as const, width: estimateTextWidth(text, fontSize, true) })),
    ...dataLines.map((text) => ({ text, fontSize: dataFontSize, fontWeight: 400 as const, width: estimateTextWidth(text, dataFontSize, false) })),
  ];
  return lines;
}

function rectFitsPolygon(centerX: number, centerY: number, width: number, height: number, coords: number[][]) {
  const halfW = width / 2;
  const halfH = height / 2;
  const points: Array<[number, number]> = [
    [centerX, centerY], [centerX - halfW, centerY - halfH], [centerX + halfW, centerY - halfH],
    [centerX - halfW, centerY + halfH], [centerX + halfW, centerY + halfH],
    [centerX, centerY - halfH], [centerX, centerY + halfH],
    [centerX - halfW, centerY], [centerX + halfW, centerY],
    [centerX - halfW * 0.6, centerY - halfH], [centerX + halfW * 0.6, centerY - halfH],
    [centerX - halfW * 0.6, centerY + halfH], [centerX + halfW * 0.6, centerY + halfH],
    [centerX - halfW, centerY - halfH * 0.6], [centerX - halfW, centerY + halfH * 0.6],
    [centerX + halfW, centerY - halfH * 0.6], [centerX + halfW, centerY + halfH * 0.6],
  ];
  return points.every(([x, y]) => pointInPolygon(x, y, coords));
}

function createCenterCandidates(coords: number[][]) {
  const { minX, width, height } = getBounds(coords);
  const centroid = getCentroid(coords);
  const bboxCenter = { x: minX + width / 2, y: getBounds(coords).minY + height / 2 };
  const offsetX = width * 0.08;
  const offsetY = height * 0.08;
  return [centroid, bboxCenter,
    { x: centroid.x, y: centroid.y - offsetY }, { x: centroid.x, y: centroid.y + offsetY },
    { x: centroid.x - offsetX, y: centroid.y }, { x: centroid.x + offsetX, y: centroid.y },
    { x: centroid.x - offsetX, y: centroid.y - offsetY }, { x: centroid.x + offsetX, y: centroid.y - offsetY },
    { x: centroid.x - offsetX, y: centroid.y + offsetY }, { x: centroid.x + offsetX, y: centroid.y + offsetY },
  ];
}

function computeLabelLayout(pasto: PastoMapaData): LabelLayout | null {
  if (pasto.coordenadas.length < 3) return null;
  const bounds = getBounds(pasto.coordenadas);
  const maxWidth = Math.max(bounds.width * 0.74, 18);
  const minFont = 4;
  const maxFont = Math.min(22, bounds.height * 0.26, bounds.width * 0.28);
  const centers = createCenterCandidates(pasto.coordenadas);
  for (let fontSize = maxFont; fontSize >= minFont; fontSize -= 0.5) {
    const padding = Math.max(fontSize * 0.5, 4);
    const lineHeight = fontSize * 1.14;
    const lines = buildLabelLines(pasto, fontSize, Math.max(maxWidth - padding * 2, 12));
    const textWidth = Math.max(...lines.map((line) => line.width), 0);
    const totalLineHeight = lines.reduce((sum, line) => sum + line.fontSize * 1.08, 0);
    const boxWidth = textWidth + padding * 2;
    const boxHeight = totalLineHeight + padding * 2;
    if (boxWidth > bounds.width * 0.92 || boxHeight > bounds.height * 0.92) continue;
    const fittingCenter = centers.find((candidate) => rectFitsPolygon(candidate.x, candidate.y, boxWidth, boxHeight, pasto.coordenadas));
    if (!fittingCenter) continue;
    return { centerX: fittingCenter.x, centerY: fittingCenter.y, width: boxWidth, height: boxHeight, lines, lineHeight, padding };
  }
  const fallbackFont = Math.max(minFont, Math.min(6, bounds.height * 0.18, bounds.width * 0.18));
  const fallbackLines = buildLabelLines(pasto, fallbackFont, Math.max(bounds.width * 0.62, 12));
  const fallbackHeight = fallbackLines.reduce((sum, line) => sum + line.fontSize * 1.05, 0);
  const centroid = getCentroid(pasto.coordenadas);
  return { centerX: centroid.x, centerY: centroid.y, width: Math.max(...fallbackLines.map((line) => line.width), 0), height: fallbackHeight, lines: fallbackLines, lineHeight: fallbackFont * 1.1, padding: 2 };
}

export default function MapaViewer({ mapa, onPastoClick, selectedPastoId, selectingDestino, highlightDestinos }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState({ z: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const dragRef = useRef<{ id: number; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; cx: number; cy: number } | null>(null);
  const suppressClickRef = useRef(false);

  const MIN_Z = 1;
  const MAX_Z = 5;

  // Convert client coords to SVG user coords (before our zoom transform)
  const toSvgPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = svg.createSVGPoint();
    p.x = clientX;
    p.y = clientY;
    const r = p.matrixTransform(ctm.inverse());
    return { x: r.x, y: r.y };
  };

  const zoomAt = (clientX: number, clientY: number, factor: number) => {
    const { x: px, y: py } = toSvgPoint(clientX, clientY);
    setView((v) => {
      const next = Math.min(MAX_Z, Math.max(MIN_Z, v.z * factor));
      const k = next / v.z;
      if (next === v.z) return v;
      return { z: next, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
    });
  };

  const zoomAtRef = useRef(zoomAt);
  zoomAtRef.current = zoomAt;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      zoomAtRef.current(e.clientX, e.clientY, Math.exp(-dy * 0.0018));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      pinchRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      dragRef.current = null;
      return;
    }
    const v = viewRef.current;
    dragRef.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: v.x, oy: v.y, moved: false };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (pointersRef.current.has(e.pointerId)) pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const [a, b] = Array.from(pointersRef.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      if (pinchRef.current.dist > 0) {
        zoomAtRef.current(cx, cy, dist / pinchRef.current.dist);
        suppressClickRef.current = true;
      }
      pinchRef.current = { dist, cx, cy };
      return;
    }

    const drag = dragRef.current;
    if (!drag || drag.id !== e.pointerId) return;
    const dxScreen = e.clientX - drag.sx;
    const dyScreen = e.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dxScreen, dyScreen) < 4) return;
    drag.moved = true;
    suppressClickRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const p0 = toSvgPoint(drag.sx, drag.sy);
    const p1 = toSvgPoint(e.clientX, e.clientY);
    setView((v) => ({ ...v, x: drag.ox + (p1.x - p0.x), y: drag.oy + (p1.y - p0.y) }));
  };

  const endPointer = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (dragRef.current?.id === e.pointerId) dragRef.current = null;
    setTimeout(() => { suppressClickRef.current = false; }, 0);
  };

  const handlePastoClick = (pasto: PastoMapaData) => {
    if (suppressClickRef.current) return;
    onPastoClick(pasto);
  };

  const allCoords = [
    ...mapa.pastos.flatMap((p) => p.coordenadas),
    ...(mapa.linhas ?? []).flatMap((l) => l.coordenadas),
    ...(mapa.elementos ?? []).map((e) => [e.posicao_x, e.posicao_y]),
  ];

  const layouts = useMemo(
    () => mapa.pastos.map((pasto) => ({ pasto, layout: computeLabelLayout(pasto) })),
    [mapa.pastos],
  );

  if (allCoords.length === 0) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Nenhum pasto desenhado no mapa.</div>;
  }


  const minX = Math.min(...allCoords.map(([x]) => x));
  const minY = Math.min(...allCoords.map(([, y]) => y));
  const maxX = Math.max(...allCoords.map(([x]) => x));
  const maxY = Math.max(...allCoords.map(([, y]) => y));
  const outerPadding = 30;
  const viewBoxX = minX - outerPadding;
  const viewBoxY = minY - outerPadding;
  const viewBoxWidth = maxX - minX + outerPadding * 2;
  const viewBoxHeight = maxY - minY + outerPadding * 2;

  const toPoints = (coords: number[][]) => coords.map(([x, y]) => `${x},${y}`).join(" ");

  function getStatusColor(status: string | null | undefined, numAnimais: number) {
    if (!status || numAnimais <= 0) return "hsl(0 0% 55%)";
    const s = status.toLowerCase();
    if (s.includes("alto")) return "hsl(0 75% 50%)";
    if (s.includes("ideal")) return "hsl(140 65% 40%)";
    if (s.includes("baix")) return "hsl(45 95% 50%)";
    return "hsl(0 0% 55%)";
  }

  function getFillColor(pasto: PastoMapaData) {
    if (selectedPastoId === pasto.pasto_id) return "hsl(120 60% 90%)";
    if (selectingDestino && highlightDestinos && pasto.pasto_id !== selectedPastoId) return "hsl(200 60% 95%)";
    return getStatusColor(pasto.status_consumo, pasto.num_animais);
  }

  function getFillOpacity(pastoId: string) {
    if (selectedPastoId === pastoId) return 0.75;
    if (selectingDestino && highlightDestinos && pastoId !== selectedPastoId) return 0.6;
    return 0.4;
  }

  function getStrokeWidth(pastoId: string) {
    if (selectedPastoId === pastoId) return 1.5;
    return 0.6;
  }

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden rounded-lg border" style={{ background: MAP_COLORS.background }}>
      {selectingDestino && (
        <div className="bg-primary/10 border-b border-primary/30 px-3 py-2 text-sm text-primary font-medium text-center">
          🎯 Clique no pasto de destino
        </div>
      )}
      <svg ref={svgRef} className="block h-auto w-full" viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={endPointer}
        style={{ background: MAP_COLORS.background, touchAction: "none", cursor: view.z > 1 ? "grab" : "default" }}>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.z})`}>



        {/* Independent lines (rendered behind polygons) */}
        {(mapa.linhas ?? []).map((linha) => (
          <polyline key={linha.id} points={toPoints(linha.coordenadas)} fill="none"
            stroke={linha.cor} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {/* Polygons with labels */}
        {layouts.map(({ pasto, layout }) => {
          if (!layout || pasto.coordenadas.length < 3) return null;
          const totalTextHeight = layout.lines.reduce((sum, line) => sum + line.fontSize * 1.08, 0);
          let currentY = layout.centerY - totalTextHeight / 2;
          return (
            <g key={pasto.id} className="cursor-pointer" onClick={() => handlePastoClick(pasto)}>
              <polygon points={toPoints(pasto.coordenadas)} fill={getFillColor(pasto)}
                fillOpacity={getFillOpacity(pasto.pasto_id)}
                stroke={selectedPastoId === pasto.pasto_id ? "hsl(120 80% 30%)" : "hsl(0 0% 100% / 0.6)"}
                strokeWidth={getStrokeWidth(pasto.pasto_id)} />

              {layout.lines.map((line, index) => {
                const y = currentY + line.fontSize;
                currentY += line.fontSize * 1.08;
                return (
                  <text key={`${pasto.id}-${index}-${line.text}`} x={layout.centerX} y={y}
                    textAnchor="middle" fill={MAP_COLORS.text} fontSize={line.fontSize} fontWeight={line.fontWeight}
                    stroke="hsl(0 0% 100%)" strokeWidth={line.fontSize * 0.16} strokeLinejoin="round"
                    style={{ pointerEvents: "none", userSelect: "none", paintOrder: "stroke" }}>
                    {line.text}
                  </text>
                );
              })}
            </g>
          );
        })}

        {/* Elements/icons (rendered on top) */}
        {(mapa.elementos ?? []).map((el) => (
          <g key={el.id}>
            <text x={el.posicao_x} y={el.posicao_y} fontSize={18} textAnchor="middle" dominantBaseline="central"
              style={{ pointerEvents: "none", userSelect: "none" }}>
              {el.emoji}
            </text>
            {el.rotulo && (
              <text x={el.posicao_x} y={el.posicao_y + 12} fontSize={7} textAnchor="middle" fill="hsl(0 0% 25%)"
                fontWeight={600} style={{ pointerEvents: "none", userSelect: "none" }}>
                {el.rotulo}
              </text>
            )}
          </g>
        ))}
        </g>
      </svg>
      {view.z > 1 && (
        <button type="button"
          onClick={() => setView({ z: 1, x: 0, y: 0 })}
          className="absolute bottom-2 right-2 rounded-md border bg-background/90 px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm">
          Resetar zoom
        </button>
      )}
    </div>
  );
}


