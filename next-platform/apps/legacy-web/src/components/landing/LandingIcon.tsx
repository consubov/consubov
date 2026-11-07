import { lazy, Suspense } from "react";
import { Activity, BarChart3, CheckCircle2, FileBarChart, Map as MapIcon, QrCode, Sparkles, WifiOff, Zap, type LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
export type LandingIconProps = { name?: string; className?: string; style?: CSSProperties };
// Keep the default public route independent of the complete configurable catalog.
const primaryIcons = new Map<string, LucideIcon>([
  ["Activity", Activity], ["BarChart3", BarChart3], ["CheckCircle2", CheckCircle2],
  ["FileBarChart", FileBarChart], ["Map", MapIcon], ["QrCode", QrCode],
  ["Sparkles", Sparkles], ["WifiOff", WifiOff], ["Zap", Zap],
]);
function Fallback({ className, style }: LandingIconProps) {
  return <Sparkles className={className} style={style} />;
}
const ConfiguredIcon = lazy(() => import("./ConfiguredLandingIcon").catch(() => ({ default: Fallback })));
export function LandingIcon(props: LandingIconProps) {
  const Icon = props.name ? primaryIcons.get(props.name) : Sparkles;
  if (Icon) return <Icon className={props.className} style={props.style} />;
  return <Suspense fallback={<Fallback {...props} />}><ConfiguredIcon {...props} /></Suspense>;
}
