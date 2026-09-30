import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const ITEM_HEIGHT = 40;
const VISIBLE_ITEMS = 5;
const REPETITIONS = 7;
const CENTER_REPETITION = Math.floor(REPETITIONS / 2);

interface CircularMonthSelectProps {
  value: number | null;
  onChange: (month: number) => void;
  ariaLabel: string;
}

export function CircularMonthSelect({ value, onChange, ariaLabel }: CircularMonthSelectProps) {
  const [open, setOpen] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const repositioningRef = useRef(false);
  const items = useMemo(
    () => Array.from({ length: MESES.length * REPETITIONS }, (_, index) => ({
      month: (index % MESES.length) + 1,
      label: MESES[index % MESES.length],
      index,
    })),
    [],
  );

  const centerMonth = useCallback((month: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const itemIndex = CENTER_REPETITION * MESES.length + month - 1;
    viewport.scrollTo({
      top: itemIndex * ITEM_HEIGHT - (VISIBLE_ITEMS * ITEM_HEIGHT - ITEM_HEIGHT) / 2,
      behavior: "auto",
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => centerMonth(value ?? 1));
    return () => cancelAnimationFrame(frame);
  }, [centerMonth, open, value]);

  const keepScrollCircular = () => {
    const viewport = viewportRef.current;
    if (!viewport || repositioningRef.current) return;
    const cycleHeight = MESES.length * ITEM_HEIGHT;
    const lowerBoundary = cycleHeight;
    const upperBoundary = cycleHeight * (REPETITIONS - 2);
    let nextTop: number | null = null;

    if (viewport.scrollTop < lowerBoundary) nextTop = viewport.scrollTop + cycleHeight * 3;
    if (viewport.scrollTop > upperBoundary) nextTop = viewport.scrollTop - cycleHeight * 3;
    if (nextTop == null) return;

    repositioningRef.current = true;
    viewport.scrollTop = nextTop;
    requestAnimationFrame(() => { repositioningRef.current = false; });
  };

  const chooseMonth = (month: number) => {
    onChange(month);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={ariaLabel}
          aria-expanded={open}
          className="h-10 min-w-0 w-full justify-between gap-1 px-2 text-xs font-normal"
        >
          <span className="truncate">{value ? MESES[value - 1] : "mês"}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        collisionPadding={8}
        className="h-[min(12.5rem,var(--radix-popover-content-available-height))] w-[var(--radix-popover-trigger-width)] min-w-32 max-w-[calc(100vw-1rem)] overflow-hidden p-0"
      >
        <div
          ref={viewportRef}
          role="listbox"
          aria-label={ariaLabel}
          onScroll={keepScrollCircular}
          className="h-full overflow-y-auto overscroll-contain scroll-smooth touch-pan-y scrollbar-hide"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {items.map((item) => (
            <Button
              key={item.index}
              type="button"
              variant="ghost"
              role="option"
              aria-selected={item.month === value}
              onClick={() => chooseMonth(item.month)}
              className={cn(
                "h-10 w-full rounded-none px-3 text-sm font-normal",
                item.month === value && "bg-accent font-semibold text-accent-foreground",
              )}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}