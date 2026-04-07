import { useCallback, useEffect, useRef, useState } from "react";
import type { MapaData, PastoMapaData } from "@/hooks/useMapaData";

interface Props {
  mapa: MapaData;
  onPastoClick: (pasto: PastoMapaData) => void;
}

export default function MapaViewer({ mapa, onPastoClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute bounding box from all coordinates to define the viewBox
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

  // Dynamic font size based on viewBox
  const fontSize = Math.max(10, vbW * 0.018);
  const fontSizeSm = Math.max(9, vbW * 0.014);

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
          return (
            <g
              key={p.id}
              className="cursor-pointer"
              onClick={() => onPastoClick(p)}
            >
              <polygon
                points={toPoints(p.coordenadas)}
                fill="#FFFFFF"
                stroke="#000000"
                strokeWidth={2}
                className="transition-all hover:fill-gray-100"
              />
              <text
                x={center.x}
                y={center.y - fontSize * 0.4}
                textAnchor="middle"
                fill="#000000"
                fontSize={fontSize}
                fontWeight="bold"
              >
                {p.pasto_nome}
              </text>
              <text
                x={center.x}
                y={center.y + fontSizeSm * 0.8}
                textAnchor="middle"
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