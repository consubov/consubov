import { useRef, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface MonthScrollerProps {
  selectedMonth: number; // 1-12
  selectedYear: number;
  onChange: (month: number, year: number) => void;
  minYear?: number;
  maxYear?: number;
}

interface MonthItem {
  month: number;
  year: number;
  label: string;
  key: string;
}

export default function MonthScroller({
  selectedMonth, selectedYear, onChange,
  minYear = 2024, maxYear = new Date().getFullYear() + 1,
}: MonthScrollerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const items = useMemo<MonthItem[]>(() => {
    const result: MonthItem[] = [];
    for (let y = minYear; y <= maxYear; y++) {
      for (let m = 1; m <= 12; m++) {
        result.push({
          month: m, year: y,
          label: `${MES_ABREV[m - 1]}/${y}`,
          key: `${y}-${m}`,
        });
      }
    }
    return result;
  }, [minYear, maxYear]);

  const selectedKey = `${selectedYear}-${selectedMonth}`;

  // Scroll to selected on mount
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const selected = el.querySelector(`[data-key="${selectedKey}"]`) as HTMLElement;
    if (selected) {
      selected.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    }
  }, [selectedKey]);

  const scrollBy = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 200, behavior: "smooth" });
  };

  const navigateMonth = (dir: number) => {
    let m = selectedMonth + dir;
    let y = selectedYear;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    if (y >= minYear && y <= maxYear) {
      onChange(m, y);
    }
  };

  return (
    <div className="flex items-center gap-1 w-full">
      <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => navigateMonth(-1)}>
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <div
        ref={scrollRef}
        className="flex-1 overflow-x-auto flex gap-1 scrollbar-hide py-1 px-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {items.map((item) => (
          <button
            key={item.key}
            data-key={item.key}
            onClick={() => onChange(item.month, item.year)}
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
              item.key === selectedKey
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => navigateMonth(1)}>
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
