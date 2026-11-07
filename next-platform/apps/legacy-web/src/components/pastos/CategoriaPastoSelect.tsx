import { useStaticUiText } from "@/components/i18n/LocalizedText";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIAS_PASTO, MSG_CATEGORIA_OBRIGATORIA } from "@/lib/categoriaPasto";

interface Props {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  showHint?: boolean;
}

export default function CategoriaPastoSelect({ value, onChange, label = "Categoria *", showHint }: Props) {
  const uiText = useStaticUiText();
  return (
    <div>
      <label className="text-sm font-medium mb-1 block">{uiText(label)}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder={uiText("Selecione a categoria")} /></SelectTrigger>
        <SelectContent>
          {CATEGORIAS_PASTO.map((c) => (
            <SelectItem key={c} value={c}>{uiText(c)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showHint && <p className="text-xs text-destructive mt-1">{uiText(MSG_CATEGORIA_OBRIGATORIA)}</p>}
    </div>
  );
}
