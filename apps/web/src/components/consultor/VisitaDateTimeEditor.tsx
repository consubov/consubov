import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

/** Converts an ISO date string to a local "YYYY-MM-DDTHH:mm" for <input type="datetime-local">. */
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Converts a "YYYY-MM-DDTHH:mm" local input to an ISO string. */
function localInputToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

interface Props {
  horaInicio: string;
  horaFim: string | null;
  onChange: (patch: { hora_inicio?: string; hora_fim?: string | null }) => void | Promise<void>;
  disabled?: boolean;
}

export default function VisitaDateTimeEditor({ horaInicio, horaFim, onChange, disabled }: Props) {
  const [ini, setIni] = useState(isoToLocalInput(horaInicio));
  const [fim, setFim] = useState(isoToLocalInput(horaFim));
  useEffect(() => { setIni(isoToLocalInput(horaInicio)); }, [horaInicio]);
  useEffect(() => { setFim(isoToLocalInput(horaFim)); }, [horaFim]);

  function saveInicio() {
    const iso = localInputToIso(ini);
    if (!iso) return;
    if (fim) {
      const isoFim = localInputToIso(fim);
      if (isoFim && new Date(isoFim) < new Date(iso)) {
        toast.error("Término não pode ser anterior ao início.");
        setIni(isoToLocalInput(horaInicio));
        return;
      }
    }
    if (iso !== horaInicio) onChange({ hora_inicio: iso });
  }
  function saveFim() {
    const iso = fim ? localInputToIso(fim) : null;
    if (fim && !iso) return;
    if (iso && new Date(iso) < new Date(horaInicio)) {
      toast.error("Término não pode ser anterior ao início.");
      setFim(isoToLocalInput(horaFim));
      return;
    }
    if ((iso || null) !== (horaFim || null)) onChange({ hora_fim: iso });
  }

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2" style={{ borderColor: "#E7E3D6" }}>
      <div className="text-[11px] uppercase tracking-wide font-bold" style={{ color: "#14432B", fontFamily: "'Manrope', sans-serif" }}>
        Data e horário da visita
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wide font-semibold mb-0.5" style={{ color: "#767066" }}>Início</div>
          <Input
            type="datetime-local"
            value={ini}
            onChange={e => setIni(e.target.value)}
            onBlur={saveInicio}
            disabled={disabled}
            className="h-9 text-sm"
          />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide font-semibold mb-0.5" style={{ color: "#767066" }}>Término</div>
          <Input
            type="datetime-local"
            value={fim}
            onChange={e => setFim(e.target.value)}
            onBlur={saveFim}
            disabled={disabled}
            className="h-9 text-sm"
          />
        </div>
      </div>
    </div>
  );
}
