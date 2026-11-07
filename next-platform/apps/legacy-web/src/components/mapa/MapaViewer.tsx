import { LocalizedText } from "@/components/i18n/LocalizedText";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MapaData, PastoMapaData } from "@/hooks/useMapaData";


interface Props {
  mapa: MapaData;
  onPastoClick: (pasto: PastoMapaData) => void;
  selectedPastoId?: string | null;
  selectingDestino?: boolean;
  highlightDestinos?: boolean;
  cacheScope?: string; // authenticated user ID; no persistent or shared image cache
  detailsLoading?: boolean;
}

export type LabelLine = {
  text: string;
  fontSize: number;
  fontWeight: CSSProperties["fontWeight"];
  width: number;
};

export type LabelLayout = {
  centerX: number;
  centerY: number;
  pinCenterY: number;
  pinScale: number;
  showText: boolean;
  lines: LabelLine[];
};

type CategoriaBovina = "Recria 1" | "Recria 2" | "Engorda";

const MAP_COLORS = {
  background: "hsl(0 0% 100%)",
  line: "hsl(120 100% 25%)",
  text: "hsl(0 0% 0%)",
} as const;

function getStatusColor(status: string | null | undefined, numAnimais: number) {
  if (!status || numAnimais <= 0) return "#9E9E9E";
  const s = status.toLowerCase();
  if (s.includes("baix")) return "#E53935";
  if (s.includes("aten")) return "#FBC02D";
  if (s.includes("ideal")) return "#43A047";
  if (s.includes("alto")) return "#1E88E5";
  return "#9E9E9E";
}

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

function distanceToSegmentSquared(x: number, y: number, ax: number, ay: number, bx: number, by: number) {
  let dx = bx - ax;
  let dy = by - ay;
  if (dx !== 0 || dy !== 0) {
    const t = ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy);
    if (t > 1) { ax = bx; ay = by; }
    else if (t > 0) { ax += dx * t; ay += dy * t; }
  }
  dx = x - ax;
  dy = y - ay;
  return dx * dx + dy * dy;
}

function signedDistanceToPolygon(x: number, y: number, coords: number[][]) {
  let minDistanceSquared = Infinity;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    minDistanceSquared = Math.min(
      minDistanceSquared,
      distanceToSegmentSquared(x, y, coords[i][0], coords[i][1], coords[j][0], coords[j][1]),
    );
  }
  const distance = Math.sqrt(minDistanceSquared);
  return pointInPolygon(x, y, coords) ? distance : -distance;
}

function getPolygonLabelPoint(coords: number[][]) {
  const bounds = getBounds(coords);
  const centroid = getCentroid(coords);
  let best = pointInPolygon(centroid.x, centroid.y, coords)
    ? { ...centroid, distance: signedDistanceToPolygon(centroid.x, centroid.y, coords) }
    : { x: bounds.minX + bounds.width / 2, y: bounds.minY + bounds.height / 2, distance: -Infinity };
  let step = Math.max(bounds.width, bounds.height) / 8;

  for (let y = bounds.minY; y <= bounds.maxY; y += step) {
    for (let x = bounds.minX; x <= bounds.maxX; x += step) {
      const distance = signedDistanceToPolygon(x, y, coords);
      if (distance > best.distance) best = { x, y, distance };
    }
  }

  for (let pass = 0; pass < 7; pass += 1) {
    step /= 2;
    for (let oy = -2; oy <= 2; oy += 1) {
      for (let ox = -2; ox <= 2; ox += 1) {
        const x = best.x + ox * step;
        const y = best.y + oy * step;
        const distance = signedDistanceToPolygon(x, y, coords);
        if (distance > best.distance) best = { x, y, distance };
      }
    }
  }
  return best;
}

function calcularCategoriaViva(pesoMedioKg: number | null, sexo: string | null): CategoriaBovina {
  const peso = Number(pesoMedioKg) || 0;
  const sexoNormalizado = (sexo ?? "").trim().toLowerCase();
  const femea = sexoNormalizado.startsWith("f") || sexoNormalizado.includes("fêmea") || sexoNormalizado.includes("femea");
  if (peso <= 220) return "Recria 1";
  if (femea ? peso <= 299 : peso <= 360) return "Recria 2";
  return "Engorda";
}

/** Silhueta vetorial incorporada: não depende de assets legados indisponíveis. */
function BovineSilhouette({ categoria }: { categoria: CategoriaBovina }) {
  const size = categoria === "Engorda" ? 1.08 : categoria === "Recria 2" ? 0.96 : 0.84;
  return (
    <g transform={`translate(0 -6.1) scale(${size})`} fill="currentColor" stroke="currentColor" strokeLinejoin="round">
      <path d="M-7.2-2.5C-7.2-4.7-5.9-5.5-4-5.5H2.1C3.2-5.5 4-4.8 4.8-4.2L6.3-5.8 7.8-5.2 7.9-1.3 6.4-.8 5-2.2 3.7-1.8H-5.1L-6.2-.6-7.1-1.4Z" />
      <path d="M-5.4-2H-4.4V1.6H-5.5ZM1.6-2H2.7V1.6H1.5Z" />
      <path d="M5.5-5.3 5-7.2 6.1-6.3 7.2-7.1 7.4-5.3Z" />
      <path d="M-6.8-4.3C-9.1-3.6-8.6-1.3-8.2-.7" fill="none" strokeWidth="0.9" strokeLinecap="round" />
      <circle cx="6.7" cy="-3.5" r="0.4" fill="white" stroke="none" />
    </g>
  );
}

type MapImageState = {
  source: string | null;
  status: "loading" | "ready" | "error";
  width: number;
  height: number;
};

// Bounded, RAM-only decoded image reuse while the installed app is open.
// Never store image URLs or cross-tenant pixels in a shared Service Worker cache.
type CachedMapImage = { image: HTMLImageElement; width: number; height: number; cachedAt: number };
const mapImageMemory = new Map<string, CachedMapImage>();
let activeImageUser: string | null = null;
const MAX_MAP_MEMORY_IMAGES = 2;
const MAP_IMAGE_TTL_MS = 5 * 60_000;

export function clearMapImageMemoryCache(): void {
  mapImageMemory.clear();
  activeImageUser = null;
}

function scopedMapImage(user: string | undefined, url: string): CachedMapImage | undefined {
  if (!user) return undefined;
  if (activeImageUser !== user) { mapImageMemory.clear(); activeImageUser = user; }
  const hit = mapImageMemory.get(url);
  if (!hit) return undefined;
  if (Date.now() - hit.cachedAt > MAP_IMAGE_TTL_MS) {
    mapImageMemory.delete(url);
    return undefined;
  }
  mapImageMemory.delete(url);
  mapImageMemory.set(url, hit);
  return hit;
}

function rememberMapImage(user: string | undefined, url: string, image: HTMLImageElement) {
  if (!user || activeImageUser !== user) return;
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!Number.isFinite(width) || !Number.isFinite(height) ||
      width <= 0 || height <= 0 || width * height > 8_000_000) return;
  mapImageMemory.delete(url);
  mapImageMemory.set(url, { image, width, height, cachedAt: Date.now() });
  while (mapImageMemory.size > MAX_MAP_MEMORY_IMAGES) {
    const oldest = mapImageMemory.keys().next().value;
    if (!oldest) break;
    mapImageMemory.delete(oldest);
  }
}


function isValidMapPoint(value: unknown): value is number[] {
  return Array.isArray(value)
    && value.length >= 2
    && typeof value[0] === "number" && Number.isFinite(value[0])
    && typeof value[1] === "number" && Number.isFinite(value[1]);
}

export function PastoPin({ pasto, centerX, centerY, scale }: { pasto: PastoMapaData; centerX: number; centerY: number; scale: number }) {
  const categoria = calcularCategoriaViva(pasto.peso_medio_kg, pasto.sexo);
  const color = getStatusColor(pasto.status_consumo, pasto.num_animais);

  return (
    <g
      transform={`translate(${centerX} ${centerY}) scale(${scale})`}
      style={{ color: MAP_COLORS.text, pointerEvents: "none", userSelect: "none" }}
      role="img"
      aria-label={`${categoria}, ${pasto.num_animais} animais`}
    >
      <path d="M0 19C-3 14-13 6-13-5.5A13 13 0 0 1 13-5.5C13 6 3 14 0 19Z" fill={color} stroke="hsl(0 0% 100%)" strokeWidth="1.5" />
      <circle cx="0" cy="-5.5" r="9.7" fill="hsl(0 0% 100%)" />
      <BovineSilhouette categoria={categoria} />
      <rect x="-8.5" y="5.5" width="17" height="8" rx="4" fill={color} stroke="hsl(0 0% 100%)" strokeWidth="1" />
      <text x="0" y="11.2" textAnchor="middle" fill="hsl(0 0% 100%)" fontSize="6.2" fontWeight="700">
        {pasto.num_animais}
      </text>
    </g>
  );
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

export function computeLabelLayout(pasto: PastoMapaData): LabelLayout | null {
  if (!Array.isArray(pasto.coordenadas) || pasto.coordenadas.length < 3
    || !pasto.coordenadas.every(isValidMapPoint)) return null;
  const xs = pasto.coordenadas.map(([x]) => x);
  const ys = pasto.coordenadas.map(([, y]) => y);
  // A zero-area polygon would leave the label-search loop with step=0 forever.
  if (Math.max(...xs) <= Math.min(...xs) || Math.max(...ys) <= Math.min(...ys)) return null;
  const bounds = getBounds(pasto.coordenadas);
  const labelPoint = getPolygonLabelPoint(pasto.coordenadas);
  const pinScale = pasto.num_animais > 0 ? 1 : 0;
  const pinHeight = pasto.num_animais > 0 ? 38 * pinScale : 0;
  const gap = pasto.num_animais > 0 ? 2 * pinScale : 0;

  const minFont = 4;
  const maxFont = Math.min(22, bounds.height * 0.26, bounds.width * 0.28);

  for (let fontSize = maxFont; fontSize >= minFont; fontSize -= 0.5) {
    const lines = buildLabelLines(pasto, fontSize, Math.max(bounds.width * 0.72, 8));
    const textWidth = Math.max(...lines.map((line) => line.width), 0);
    const textHeight = lines.reduce((sum, line) => sum + line.fontSize * 1.08, 0);
    const contentWidth = Math.max(26 * pinScale, textWidth);
    const contentHeight = pinHeight + gap + textHeight;
    if (rectFitsPolygon(labelPoint.x, labelPoint.y, contentWidth, contentHeight, pasto.coordenadas)) {
      const visibleTextHeight = textHeight + gap;
      return {
        centerX: labelPoint.x,
        centerY: labelPoint.y,
        pinCenterY: labelPoint.y - visibleTextHeight / 2,
        pinScale,
        showText: true,
        lines,
      };
    }
  }

  const fallbackFont = Math.max(minFont, Math.min(6, bounds.height * 0.18, bounds.width * 0.18));
  const fallbackLines = buildLabelLines(pasto, fallbackFont, Math.max(bounds.width * 0.62, 12));
  const fallbackTextWidth = Math.max(...fallbackLines.map((line) => line.width), 0);
  const fallbackTextHeight = fallbackLines.reduce((sum, line) => sum + line.fontSize * 1.05, 0);
  const fallbackContentWidth = Math.max(26 * pinScale, fallbackTextWidth);
  const fallbackContentHeight = pinHeight + gap + fallbackTextHeight;
  const showText = rectFitsPolygon(labelPoint.x, labelPoint.y, fallbackContentWidth, fallbackContentHeight, pasto.coordenadas);
  const visibleTextHeight = showText ? fallbackTextHeight + gap : 0;

  return {
    centerX: labelPoint.x,
    centerY: labelPoint.y,
    pinCenterY: labelPoint.y - visibleTextHeight / 2,
    pinScale,
    showText,
    lines: fallbackLines,
  };
}

export default function MapaViewer({ mapa, onPastoClick, selectedPastoId, selectingDestino, highlightDestinos, cacheScope, detailsLoading = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState({ z: 1, x: 0, y: 0 });
  const source = typeof mapa.imagem_url === "string" && mapa.imagem_url.trim().startsWith("https://")
    ? mapa.imagem_url.trim()
    : null;
  const [mapImage, setMapImage] = useState<MapImageState>({
    source, status: source ? "loading" : "error", width: 0, height: 0,
  });

  useEffect(() => {
    setView({ z: 1, x: 0, y: 0 });
    if (!source) {
      setMapImage({ source: null, status: "error", width: 0, height: 0 });
      return;
    }
    let current = true;
    const cached = scopedMapImage(cacheScope, source);
    if (cached) {
      setMapImage({ source, status: "ready", width: cached.width, height: cached.height });
      return;
    }
    const image = new Image();
    setMapImage({ source, status: "loading", width: 0, height: 0 });
    image.onload = () => {
      if (!current) return;
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      if (width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height)) {
        rememberMapImage(cacheScope, source, image);
        setMapImage({ source, status: "ready", width, height });
      } else {
        setMapImage({ source, status: "error", width: 0, height: 0 });
      }
    };
    image.onerror = () => {
      if (current) setMapImage({ source, status: "error", width: 0, height: 0 });
    };
    image.src = source;
    return () => {
      current = false;
      image.onload = null;
      image.onerror = null;
    };
  }, [mapa.id, source, cacheScope]);

  const imageReady = Boolean(source && mapImage.source === source && mapImage.status === "ready");
  const imageFailed = !source || (mapImage.source === source && mapImage.status === "error");

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
    ...mapa.pastos.flatMap((p) => p.coordenadas ?? []),
    ...(mapa.linhas ?? []).flatMap((l) => l.coordenadas ?? []),
    ...(mapa.elementos ?? []).map((e) => [e.posicao_x, e.posicao_y]),
  ].filter(isValidMapPoint);

  const layouts = useMemo(
    () => mapa.pastos.map((pasto) => ({ pasto, layout: computeLabelLayout(pasto) })),
    [mapa.pastos],
  );

  if (allCoords.length === 0 && !imageReady) {
    return (
      <div className="space-y-2 py-12 text-center text-sm text-muted-foreground">
        {imageFailed
          ? <p role="alert"><LocalizedText source={"Imagem do mapa indisponível. Verifique o cadastro ou a conexão."} /></p>
          : <p><LocalizedText source={"Carregando imagem do mapa..."} /></p>}
        {!detailsLoading && <p><LocalizedText source={"Nenhum pasto desenhado no mapa."} /></p>}
      </div>
    );
  }

  const xs = allCoords.map(([x]) => x);
  const ys = allCoords.map(([, y]) => y);
  const outerPadding = 30;
  const viewBoxX = imageReady ? 0 : Math.min(...xs) - outerPadding;
  const viewBoxY = imageReady ? 0 : Math.min(...ys) - outerPadding;
  const viewBoxWidth = imageReady ? mapImage.width : Math.max(1, Math.max(...xs) - Math.min(...xs) + outerPadding * 2);
  const viewBoxHeight = imageReady ? mapImage.height : Math.max(1, Math.max(...ys) - Math.min(...ys) + outerPadding * 2);

  const toPoints = (coords: number[][]) =>
    coords.filter(isValidMapPoint).map(([x, y]) => `${x},${y}`).join(" ");

  function getFillColor(pasto: PastoMapaData) {
    if (selectedPastoId === pasto.pasto_id) return "hsl(120 60% 90%)";
    if (selectingDestino && highlightDestinos && pasto.pasto_id !== selectedPastoId) return "hsl(200 60% 95%)";
    return getStatusColor(pasto.status_consumo, pasto.num_animais);
  }

  function getFillOpacity(pastoId: string) {
    if (selectedPastoId === pastoId) return 0.75;
    if (selectingDestino && highlightDestinos && pastoId !== selectedPastoId) return 0.6;
    return 0.8;
  }

  function getStrokeWidth(pastoId: string) {
    if (selectedPastoId === pastoId) return 1.5;
    return 0.6;
  }

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden rounded-lg border" style={{ background: MAP_COLORS.background }}>
      {selectingDestino && (
        <div className="bg-primary/10 border-b border-primary/30 px-3 py-2 text-sm text-primary font-medium text-center">
          <LocalizedText source={"🎯 Clique no pasto de destino"} /></div>
      )}
      {imageFailed && (
        <p role="alert" className="border-b border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <LocalizedText source={"Imagem do mapa indisponível. Mostrando apenas os desenhos."} />
        </p>
      )}
      {!imageReady && !imageFailed && (
        <p className="border-b px-3 py-2 text-xs text-muted-foreground">
          <LocalizedText source={"Carregando imagem do mapa..."} />
        </p>
      )}
      <svg ref={svgRef} className="block h-auto w-full" viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
        preserveAspectRatio="xMidYMid meet"
        aria-label="Mapa do retiro"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={endPointer}
        style={{ background: MAP_COLORS.background, aspectRatio: `${viewBoxWidth} / ${viewBoxHeight}`, touchAction: "none", cursor: view.z > 1 ? "grab" : "default" }}>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.z})`}>
        {imageReady && source && (
          <image
            href={source}
            x={0}
            y={0}
            width={mapImage.width}
            height={mapImage.height}
            preserveAspectRatio="none"
            pointerEvents="none"
            role="img"
            aria-label="Imagem de fundo do mapa"
            onError={() => setMapImage((prev) => prev.source === source
              ? { ...prev, status: "error" } : prev)}
          />
        )}



        {/* Independent lines (rendered behind polygons) */}
        {(mapa.linhas ?? []).map((linha) => (
          <polyline key={linha.id} points={toPoints(linha.coordenadas)} fill="none"
            stroke={linha.cor} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {/* Polygons with labels */}
        {layouts.map(({ pasto, layout }) => {
          if (!layout || pasto.coordenadas.length < 3) return null;
          let currentY = layout.pinCenterY + (pasto.num_animais > 0 ? 21 * layout.pinScale : -layout.lines.reduce((sum, line) => sum + line.fontSize * 1.08, 0) / 2);
          const offsetX = pasto.label_offset_x || 0;
          const offsetY = pasto.label_offset_y || 0;
          const rotation = pasto.label_rotation || 0;
          const hasCustomPosition = offsetX !== 0 || offsetY !== 0 || rotation !== 0;
          return (
            <g key={pasto.id} className="cursor-pointer" onClick={() => handlePastoClick(pasto)}>
              <polygon points={toPoints(pasto.coordenadas)} fill={getFillColor(pasto)}
                fillOpacity={getFillOpacity(pasto.pasto_id)}
                stroke={selectedPastoId === pasto.pasto_id ? "hsl(120 80% 30%)" : "#FFFFFF"}
                strokeWidth={2} />

              <g transform={`translate(${offsetX} ${offsetY}) rotate(${rotation} ${layout.centerX} ${layout.centerY})`}>
                {(layout.showText || hasCustomPosition) && layout.lines.map((line, index) => {
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

                {pasto.num_animais > 0 && (
                  <PastoPin pasto={pasto} centerX={layout.centerX} centerY={layout.pinCenterY} scale={layout.pinScale} />
                )}
              </g>
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
          <LocalizedText source={"Resetar zoom"} /></button>
      )}
    </div>
  );
}


