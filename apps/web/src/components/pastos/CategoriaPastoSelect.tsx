import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIAS_PASTO, MSG_CATEGORIA_OBRIGATORIA } from "@/lib/categoriaPasto";

interface Props {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  showHint?: boolean;
}

export default function CategoriaPastoSelect({ value, onChange, label = "Categoria *", showHint }: Props) {
  return (
    <div>
      <label className="text-sm font-medium mb-1 block">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
        <SelectContent>
          {CATEGORIAS_PASTO.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showHint && <p className="text-xs text-destructive mt-1">{MSG_CATEGORIA_OBRIGATORIA}</p>}
    </div>
  );
}
