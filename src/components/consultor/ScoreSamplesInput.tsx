import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ScoreSample {
  id?: string;
  nota: number;
}

interface Props {
  label: string;
  samples: ScoreSample[];
  onAdd: (n: number) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
}

/** Compute rounded 1-decimal average, or undefined if empty. */
export function averageOf(samples: ScoreSample[] | number[] | undefined): number | undefined {
  if (!samples || samples.length === 0) return undefined;
  const nums = (samples as any[]).map(s => typeof s === "number" ? s : s.nota);
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

export function formatAvg(avg?: number): string {
  if (avg === undefined || avg === null || Number.isNaN(avg)) return "—";
  return Number.isInteger(avg) ? String(avg) : avg.toFixed(1).replace(".", ",");
}

export default function ScoreSamplesInput({ label, samples, onAdd, onRemove, disabled }: Props) {
  const [current, setCurrent] = useState<number | undefined>();
  const avg = averageOf(samples);

  function handleNext() {
    if (current === undefined) return;
    onAdd(current);
    setCurrent(undefined);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-semibold">{label}</Label>
        <span className="text-[11px] text-muted-foreground">
          {samples.length} amostra{samples.length !== 1 ? "s" : ""} · média {formatAvg(avg)}
        </span>
      </div>
      <div className="flex gap-1.5 items-center flex-wrap">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => setCurrent(n)}
            className={cn(
              "w-9 h-9 rounded-full border-2 text-sm font-semibold transition-colors",
              current === n
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-primary/50",
              disabled && "opacity-60 cursor-not-allowed",
            )}
          >
            {n}
          </button>
        ))}
        <Button
          type="button"
          size="sm"
          onClick={handleNext}
          disabled={disabled || current === undefined}
          className="h-9 gap-1 bg-primary hover:bg-primary/90 ml-auto"
        >
          <ArrowRight className="w-4 h-4" /> Próximo
        </Button>
      </div>
      {samples.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {samples.map((s, i) => (
            <span
              key={s.id ?? i}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold"
            >
              {s.nota}
              {!disabled && (
                <button type="button" onClick={() => onRemove(i)} className="hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
