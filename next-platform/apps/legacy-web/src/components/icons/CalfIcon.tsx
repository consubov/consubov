import { SVGProps } from "react";

/**
 * Ícone de bezerro (calf) — estilo linha, compatível com lucide.
 * Aceita as mesmas props do lucide (size, color, strokeWidth, className).
 */
export function CalfIcon({
  size = 24,
  color = "currentColor",
  strokeWidth = 2,
  className,
  ...rest
}: SVGProps<SVGSVGElement> & { size?: number | string; strokeWidth?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...rest}
    >
      {/* Cabeça */}
      <path d="M12 4c-3 0-5 2-5 5v2c0 2.8 2.2 5 5 5s5-2.2 5-5V9c0-3-2-5-5-5z" />
      {/* Orelhas */}
      <path d="M7 8C5 8 4 9 4 10.5S5 13 6.5 13" />
      <path d="M17 8c2 0 3 1 3 2.5S19 13 17.5 13" />
      {/* Topete */}
      <path d="M10 4.5c.5-1 1.2-1.5 2-1.5s1.5.5 2 1.5" />
      {/* Olhos */}
      <circle cx="10" cy="10" r="0.6" fill={color} stroke="none" />
      <circle cx="14" cy="10" r="0.6" fill={color} stroke="none" />
      {/* Focinho */}
      <path d="M9.5 13.5h5v2h-5z" />
      <circle cx="10.8" cy="14.5" r="0.4" fill={color} stroke="none" />
      <circle cx="13.2" cy="14.5" r="0.4" fill={color} stroke="none" />
      {/* Corpo indicando bezerro */}
      <path d="M8 17c1 1.5 2.5 2 4 2s3-.5 4-2" />
    </svg>
  );
}

export default CalfIcon;
