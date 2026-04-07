import { useRef } from "react";
import type { MapaData, PastoMapaData } from "@/hooks/useMapaData";

interface Props {
  mapa: MapaData;
  onPastoClick: (pasto: PastoMapaData) => void;
}

/** Compute the inscribed rect center & safe dimensions inside a polygon */
function safeRect(coords: number[][]) {
  const xs = coords.map(([x]) => x);
  const ys = coords.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = maxX - minX;
  const h = maxY - minY;
  // Use centroid for center position
  const cx = coords.reduce((s, [x]) => s + x, 0) / coords.length;
  const cy = coords.reduce((s, [, y]) => s + y, 0) / coords.length;
  // Inset 20% from bounding box edges as safe padding
  const safeW = w * 0.6;
  const safeH = h * 0.6;
  return { cx, cy, safeW, safeH };
}

export default function MapaViewer({ mapa, onPastoClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const allCoords = mapa.pastos.flatMap((p) => p.coordenadas);
  if (allCoords.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        Nenhum pasto desenhado no mapa.
      </div>
    );
  }

  const minX = Math.min(...allCoords.map(([x]) => x));
  const minY = Math.min(...allCoords.map(([, y]) => y));
  const maxX = Math.max(...allCoords.map(([x]) => x));
  const maxY = Math.max(...allCoords.map(([, y]) => y));
  const padding = 30;
  const vbX = minX - padding;
  const vbY = minY - padding;
  const vbW = maxX - minX + padding * 2;
  const vbH = maxY - minY + padding * 2;

  const toPoints = (coords: number[][]) =>
    coords.map(([x, y]) => `${x},${y}`).join(" ");

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden rounded-lg border" style={{ background: "#FFFFFF" }}>
      <svg
        className="w-full h-auto block"
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ background: "#FFFFFF" }}
      >
        {mapa.pastos.map((p) => {
          if (p.coordenadas.length < 3) return null;
          const { cx, cy, safeW, safeH } = safeRect(p.coordenadas);

          // Two lines: name + "N cab" — each needs half the safe height
          const maxFontByHeight = safeH / 3; // 3 = 2 lines + gap
          // Estimate chars width: name is usually longest
          const nameLen = Math.max(p.pasto_nome.length, 5);
          const maxFontByWidth = safeW / (nameLen * 0.6);
          const fontSize = Math.max(5, Math.min(maxFontByHeight, maxFontByWidth, 16));
          const fontSizeSm = fontSize * 0.82;
          const gap = fontSize * 0.4;

          return (
            <g
              key={p.id}
              className="cursor-pointer"
              onClick={() => onPastoClick(p)}
            >
              <polygon
                points={toPoints(p.coordenadas)}
                fill="#FFFFFF"
                stroke="#008000"
                strokeWidth={2}
              />
              {/* Clip text to polygon bounds */}
              <clipPath id={`clip-${p.id}`}>
                <polygon points={toPoints(p.coordenadas)} />
              </clipPath>
              <g clipPath={`url(#clip-${p.id})`}>
                <text
                  x={cx}
                  y={cy - gap}
                  textAnchor="middle"
                  dominantBaseline="auto"
                  fill="#000000"
                  fontSize={fontSize}
                  fontWeight="bold"
                >
                  {p.pasto_nome}
                </text>
                <text
                  x={cx}
                  y={cy + gap + fontSizeSm}
                  textAnchor="middle"
                  dominantBaseline="auto"
                  fill="#000000"
                  fontSize={fontSizeSm}
                >
                  {p.num_animais} cab
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
