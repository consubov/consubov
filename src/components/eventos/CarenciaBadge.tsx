import { Badge } from "@/components/ui/badge";
import { calcCarenciaDias } from "@/hooks/useEventosLote";

interface Props {
  dataFimCarencia: string | null | undefined;
  className?: string;
}

export default function CarenciaBadge({ dataFimCarencia, className }: Props) {
  const dias = calcCarenciaDias(dataFimCarencia);
  if (dias <= 0) return null;

  return (
    <Badge variant="destructive" className={className}>
      Em carência — {dias} dia{dias !== 1 ? "s" : ""} restante{dias !== 1 ? "s" : ""}
    </Badge>
  );
}
