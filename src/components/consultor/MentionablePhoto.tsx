import { useEffect, useRef, useState, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Quote } from "lucide-react";
import { registerPhotoElement, useActiveMentionTarget } from "@/lib/mentionTarget";

interface Props {
  numero?: number | null;
  children: ReactNode;
  className?: string;
}

/**
 * Envolve uma foto numerada: registra a foto (para rolagem via chip) e,
 * quando existe um campo de texto ativo, oferece a ação "Mencionar".
 */
export default function MentionablePhoto({ numero, children, className }: Props) {
  const holderRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const target = useActiveMentionTarget();

  useEffect(() => {
    if (numero == null) return;
    return registerPhotoElement(numero, holderRef.current);
  }, [numero]);

  return (
    <div ref={holderRef} className={className ?? "relative rounded-md"}>
      {children}
      {numero != null && target && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Mencionar Imagem ${numero}`}
              className="absolute inset-x-0 top-1/4 h-1/2 z-10"
              onClick={() => setOpen(true)}
            />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="center">
            <Button
              type="button"
              size="sm"
              className="gap-1.5 h-8"
              onClick={() => { target.insert(numero); setOpen(false); }}
            >
              <Quote className="w-3.5 h-3.5" /> Mencionar Imagem {numero}
            </Button>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
