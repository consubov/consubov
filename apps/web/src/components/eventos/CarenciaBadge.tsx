import { LocalizedText } from "@/components/i18n/LocalizedText";
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
      <LocalizedText source={"Em carência —"} />{" "}{dias} <LocalizedText source={"dia"} />{dias !== 1 ? "s" : ""} <LocalizedText source={"restante"} />{dias !== 1 ? "s" : ""}
    </Badge>
  );
}
