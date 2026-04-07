import { useRef } from "react";
import type { MapaData, PastoMapaData } from "@/hooks/useMapaData";

interface Props {
  mapa: MapaData;
  onPastoClick: (pasto: PastoMapaData) => void;
}

/** Bounding box width/height of a polygon */
function polyBounds(coords: number[][]) {
  const xs = coords.map(([x]) => x);
  const ys = coords.map(([, y]) => y);
  return {
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
  };
}

export default function MapaViewer({ mapa, onPastoClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const allCoords = mapa.pastos.flatMap((p) => p.coordenadas);
  const minX = allCoords.length ? Math.min(...allCoords.map(([x]) => x)) : 0;
  const minY = allCoords.length ? Math.min(...allCoords.map(([, y]) => y)) : 0;
  const maxX = allCoords.length ? Math.max(...allCoords.map(([x]) => x)) : 1000;
  const maxY = allCoords.length ? Math.max(...allCoords.map(([, y]) => y)) : 1000;
  const padding = 40;
  const vbX = minX - padding;
  const vbY = minY - padding;
  const vbW = maxX - minX + padding * 2;
  const vbH = maxY - minY + padding * 2;

  const toPoints = (coords: number[][]) =>
    coords.map(([x, y]) => `${x},${y}`).join(" ");

  const centroid = (coords: number[][]) => {
    if (coords.length === 0) return { x: 0, y: 0 };
    const cx = coords.reduce((s, [x]) => s + x, 0) / coords.length;
    const cy = coords.reduce((s, [, y]) => s + y, 0) / coords.length;
    return { x: cx, y: cy };
  };

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
          const center = centroid(p.coordenadas);
          const bounds = polyBounds(p.coordenadas);
          // Scale font to fit inside polygon — cap at 40% of smallest dimension
          const maxFont = Math.min(bounds.w * 0.22, bounds.h * 0.25, 18);
          const fontSize = Math.max(8, maxFont);
          const fontSizeSm = fontSize * 0.78;
          const lineGap = fontSize * 1.3;

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
              <text
                x={center.x}
                y={center.y - lineGap * 0.3}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#000000"
                fontSize={fontSize}
                fontWeight="bold"
              >
                {p.pasto_nome}
              </text>
              <text
                x={center.x}
                y={center.y + lineGap * 0.7}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#000000"
                fontSize={fontSizeSm}
              >
                {p.num_animais} cab
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
