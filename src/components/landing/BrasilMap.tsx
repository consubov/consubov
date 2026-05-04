import { useState } from "react";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import geoData from "@/assets/br-states.json";

const NEON = "#22FF88";
const NEON_DIM = "rgba(34,255,136,0.45)";
const ACTIVE = new Set(["PA", "TO", "BA", "MT", "GO", "MS"]);

const LABELS: Record<string, [number, number]> = {
  PA: [-52.5, -4.5],
  TO: [-48.5, -10.5],
  BA: [-41.5, -12.5],
  MT: [-55.5, -13.5],
  GO: [-49.5, -16.0],
  MS: [-54.5, -20.5],
};

export default function BrasilMap() {
  const [hover, setHover] = useState<string | null>(null);
  const hoverName = hover
    ? (geoData as any).features.find((f: any) => f.properties.sigla === hover)?.properties.name
    : null;

  return (
    <div className="relative w-full h-full">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 700, center: [-54, -15] }}
        width={760}
        height={760}
        style={{ width: "100%", height: "100%" }}
      >
        <Geographies geography={geoData as any}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const sigla: string = geo.properties.sigla;
              const isActive = ACTIVE.has(sigla);
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  onMouseEnter={() => setHover(sigla)}
                  onMouseLeave={() => setHover(null)}
                  style={{
                    default: {
                      fill: isActive ? "rgba(34,255,136,0.28)" : "rgba(34,255,136,0.06)",
                      stroke: NEON,
                      strokeWidth: isActive ? 0.9 : 0.5,
                      outline: "none",
                      filter: isActive
                        ? `drop-shadow(0 0 6px ${NEON_DIM}) drop-shadow(0 0 14px ${NEON_DIM})`
                        : "none",
                      transition: "all 0.25s",
                    },
                    hover: {
                      fill: "rgba(34,255,136,0.55)",
                      stroke: NEON,
                      strokeWidth: 1.1,
                      outline: "none",
                      cursor: "pointer",
                      filter: `drop-shadow(0 0 8px ${NEON_DIM}) drop-shadow(0 0 18px ${NEON_DIM})`,
                    },
                    pressed: { fill: NEON, outline: "none" },
                  }}
                />
              );
            })
          }
        </Geographies>

        {Object.entries(LABELS).map(([sigla, coords]) => (
          <Marker key={sigla} coordinates={coords as [number, number]}>
            <circle r={3.5} fill={NEON} opacity={0.25}>
              <animate attributeName="r" values="2.5;6;2.5" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.5;0;0.5" dur="2.4s" repeatCount="indefinite" />
            </circle>
            <circle r={1.8} fill={NEON} />
            <g transform="translate(5, 1.2)">
              <rect x={0} y={-3.5} rx={1.5} ry={1.5} width={22} height={6} fill="rgba(5,7,10,0.9)" stroke={NEON_DIM} strokeWidth={0.25} />
              <text x={2} y={1} fontSize={4} fontFamily="monospace" fill={NEON}>
                {sigla} • online
              </text>
            </g>
          </Marker>
        ))}
      </ComposableMap>

      {hoverName && (
        <div
          className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-md font-mono text-xs"
          style={{
            background: "rgba(5,7,10,0.9)",
            border: `1px solid ${NEON_DIM}`,
            color: NEON,
            boxShadow: `0 0 10px ${NEON_DIM}`,
          }}
        >
          {hoverName}
        </div>
      )}
    </div>
  );
}
