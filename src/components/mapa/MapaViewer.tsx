import { useCallback, useEffect, useRef, useState } from "react";
import type { MapaData, PastoMapaData } from "@/hooks/useMapaData";

function statusToColor(status: string | null): string {
  switch (status) {
    case "Ideal":
      return "rgba(34, 197, 94, 0.4)";
    case "Baixo":
      return "rgba(239, 68, 68, 0.4)";
    case "Alto":
      return "rgba(234, 179, 8, 0.4)";
    default:
      return "rgba(148, 163, 184, 0.3)";
  }
}

function statusToStroke(status: string | null): string {
  switch (status) {
    case "Ideal":
      return "#16a34a";
    case "Baixo":
      return "#dc2626";
    case "Alto":
      return "#ca8a04";
    default:
      return "#64748b";
  }
}

interface Props {
  mapa: MapaData;
  onPastoClick: (pasto: PastoMapaData) => void;
}

export default function MapaViewer({ mapa, onPastoClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState({ width: 1, height: 1 });

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    setImgSize({ width: img.clientWidth, height: img.clientHeight });
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const img = containerRef.current?.querySelector("img");
      if (img) {
        setImgSize({ width: img.clientWidth, height: img.clientHeight });
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const scaleX = imgSize.width / naturalSize.width;
  const scaleY = imgSize.height / naturalSize.height;

  const toPoints = (coords: number[][]) =>
    coords.map(([x, y]) => `${x * scaleX},${y * scaleY}`).join(" ");

  const centroid = (coords: number[][]) => {
    if (coords.length === 0) return { x: 0, y: 0 };
    const cx = coords.reduce((s, [x]) => s + x, 0) / coords.length;
    const cy = coords.reduce((s, [, y]) => s + y, 0) / coords.length;
    return { x: cx * scaleX, y: cy * scaleY };
  };

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden rounded-lg border bg-muted">
      <img
        src={mapa.imagem_url}
        alt="Mapa da fazenda"
        className="w-full h-auto block"
        onLoad={handleImageLoad}
        draggable={false}
      />
      {imgSize.width > 0 && (
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox={`0 0 ${imgSize.width} ${imgSize.height}`}
          preserveAspectRatio="none"
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
                  fill={statusToColor(p.status_consumo)}
                  stroke={statusToStroke(p.status_consumo)}
                  strokeWidth={2}
                  className="transition-all hover:opacity-80"
                />
                <text
                  x={center.x}
                  y={center.y - 6}
                  textAnchor="middle"
                  fill="white"
                  fontSize={Math.max(10, imgSize.width * 0.02)}
                  fontWeight="bold"
                  stroke="rgba(0,0,0,0.6)"
                  strokeWidth={0.5}
                  paintOrder="stroke"
                >
                  {p.pasto_nome}
                </text>
                <text
                  x={center.x}
                  y={center.y + 10}
                  textAnchor="middle"
                  fill="white"
                  fontSize={Math.max(9, imgSize.width * 0.015)}
                  stroke="rgba(0,0,0,0.6)"
                  strokeWidth={0.4}
                  paintOrder="stroke"
                >
                  {p.num_animais} cab
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
