import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Search } from "lucide-react";

interface FazendaOption {
  id: string;
  nome: string;
}

interface Props {
  fazendas: FazendaOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  emptyMessage?: string;
  searchPlaceholder?: string;
}

export default function FazendasMultiSelect({
  fazendas,
  selected,
  onChange,
  label = "Fazendas vinculadas",
  emptyMessage = "Nenhuma fazenda disponível.",
  searchPlaceholder = "Pesquisar fazenda...",
}: Props) {
  const [busca, setBusca] = useState("");

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return fazendas;
    return fazendas.filter((f) => f.nome.toLowerCase().includes(termo));
  }, [fazendas, busca]);

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-xs text-muted-foreground">{selected.length} selecionada(s)</span>
      </div>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-8"
        />
      </div>
      <div className="max-h-48 overflow-y-auto rounded-md border border-input divide-y">
        {filtradas.length === 0 ? (
          <p className="text-xs text-muted-foreground p-3">{emptyMessage}</p>
        ) : (
          filtradas.map((f) => (
            <label
              key={f.id}
              className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent"
            >
              <Checkbox
                checked={selected.includes(f.id)}
                onCheckedChange={() => toggle(f.id)}
              />
              <span>{f.nome}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
