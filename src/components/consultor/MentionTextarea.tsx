import { useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { ImageIcon } from "lucide-react";
import {
  clearActiveMentionTarget, scrollToPhoto, setActiveMentionTarget,
} from "@/lib/mentionTarget";
import { extractMentions, insertMentionAt } from "@/lib/photoMentions";
import { toast } from "sonner";

interface Props {
  /** Identificador estável do campo. */
  fieldId: string;
  label?: string;
  value: string;
  onChange: (v: string) => void;
  /** Chamado ao sair do campo e logo após inserir uma menção. */
  onCommit?: (v: string) => void;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Textarea com suporte a menções de foto:
 * - registra-se como campo ativo (foco/seleção) para receber "Mencionar" ao tocar numa foto numerada;
 * - exibe os marcadores [[foto:N]] como chips clicáveis "Imagem N" logo abaixo.
 */
export default function MentionTextarea({
  fieldId, label, value, onChange, onCommit, rows = 3, placeholder, disabled, className,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const caretRef = useRef<number>(value.length);
  const valueRef = useRef(value);
  valueRef.current = value;

  const register = () => {
    if (disabled) return;
    caretRef.current = ref.current?.selectionStart ?? valueRef.current.length;
    setActiveMentionTarget({
      id: fieldId,
      label,
      insert: (numero: number) => {
        const { text, caret } = insertMentionAt(valueRef.current, caretRef.current, numero);
        caretRef.current = caret;
        onChange(text);
        onCommit?.(text);
        window.setTimeout(() => {
          const el = ref.current;
          if (el) { el.focus(); try { el.setSelectionRange(caret, caret); } catch { /* noop */ } }
        }, 0);
      },
    });
  };

  useEffect(() => () => clearActiveMentionTarget(fieldId), [fieldId]);

  const mentions = extractMentions(value);

  return (
    <div className="space-y-1.5">
      <Textarea
        ref={ref}
        value={value}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        onChange={e => { caretRef.current = e.target.selectionStart ?? 0; onChange(e.target.value); }}
        onFocus={register}
        onClick={register}
        onKeyUp={register}
        onSelect={register}
        onBlur={() => onCommit?.(valueRef.current)}
      />
      {mentions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {mentions.map(n => (
            <button
              key={n}
              type="button"
              onClick={() => {
                if (!scrollToPhoto(n)) toast.info(`Imagem ${n} não está visível nesta tela.`);
              }}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ background: "#14432B", color: "#C9A84C" }}
            >
              <ImageIcon className="w-3 h-3" /> Imagem {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
