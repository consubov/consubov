import { icons, Sparkles } from "lucide-react";
import type { LandingIconProps } from "./LandingIcon";
// Arbitrary configured names remain supported, outside the initial route chunk.
export default function ConfiguredLandingIcon({ name, className, style }: LandingIconProps) {
  const Icon = name && Object.prototype.hasOwnProperty.call(icons, name)
    ? icons[name as keyof typeof icons] : Sparkles;
  return <Icon className={className} style={style} />;
}
