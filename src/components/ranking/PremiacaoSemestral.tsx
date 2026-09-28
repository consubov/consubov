import { Fragment, useEffect, useMemo, useState } from "react";
import { Trophy, Medal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchPremiacaoSemestral, semestreAtual, type PremiacaoRetiro, type Semestre } from "@/lib/premiacaoSemestral";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const key = (s: Semestre) => `${s.ano}-${s.sem}`;

function opcoesSemestre(): Semestre[] {
  const cur = semestreAtual();
  const out: Semestre[] = [];
  let s = cur;
  for (let i = 0; i < 8; i++) {
    out.push(s);
    s = s.sem === 2 ? { ano: s.ano, sem: 1 } : { ano: s.ano - 1, sem: 2 };
  }
  return out;
}

const medalColor = ["text-secondary", "text-muted-foreground", "text-primary"];

interface Props {
  fazendas: { id: string; nome: string }[];
  mostrarFazenda?: boolean;
  seletorExtra?: React.ReactNode;
}

export default function PremiacaoSemestral({ fazendas, mostrarFazenda, seletorExtra }: Props) {
  const opcoes = useMemo(opcoesSemestre, []);
  const [sel, setSel] = useState(key(opcoes[0]));
  const [list, setList] = useState<PremiacaoRetiro[]>([]);
  const [parcial, setParcial] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const fazKey = fazendas.map((f) => f.id).join(",");

  useEffect(() => {
    const s = opcoes.find((o) => key(o) === sel)!;
    if (!fazendas.length) { setList([]); return; }
    let cancel = false;
    setLoading(true);
    fetchPremiacaoSemestral(fazendas, s)
      .then((r) => { if (!cancel) { setList(r.list); setParcial(r.parcial); } })
      .catch(() => { if (!cancel) setList([]); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, fazKey]);

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
        <Trophy className="w-4 h-4" /> Premiação Semestral
        {parcial && <Badge variant="outline" className="ml-1 normal-case">Parcial</Badge>}
      </h2>
      <div className="flex flex-wrap gap-2 mb-3">
        <Select value={sel} onValueChange={setSel}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {opcoes.map((o) => <SelectItem key={key(o)} value={key(o)}>{o.sem}º sem/{o.ano}</SelectItem>)}
          </SelectContent>
        </Select>
        {seletorExtra}
      </div>
      {loading ? (
        <p className="text-muted-foreground text-sm text-center py-4">Calculando…</p>
      ) : list.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-4">Sem salgas no semestre.</p>
      ) : (
        <Card className="divide-y divide-border">
          {list.map((r, i) => {
            const id = r.fazendaId + r.retiroId;
            const open = aberto === id;
            return (
              <Fragment key={id}>
                <button className="w-full flex items-center gap-3 p-3 text-left" onClick={() => setAberto(open ? null : id)}>
                  <span className="w-7 shrink-0 flex justify-center font-semibold text-muted-foreground">
                    {i < 3 ? <Medal className={`w-5 h-5 ${medalColor[i]}`} /> : i + 1}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate">{i < 3 && `${i + 1}º · `}{r.retiro}</span>
                    <span className="block text-xs text-muted-foreground truncate">
                      {mostrarFazenda && `${r.fazenda} · `}{r.capataz || "Sem capataz"}
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block text-sm font-bold">{fmt(r.media)}/10</span>
                    <span className="block text-[11px] text-muted-foreground">{r.meses.length} {r.meses.length === 1 ? "mês" : "meses"}</span>
                  </span>
                </button>
                {open && (
                  <div className="bg-muted/40 px-3 py-2 grid grid-cols-3 gap-2 text-xs">
                    {r.meses.map((m) => (
                      <div key={m.mes} className={`rounded p-1.5 text-center ${m.semSalgaRetiro ? "bg-destructive/10 text-destructive" : "bg-background"}`}>
                        <div className="font-semibold">{MESES[m.mes - 1]}</div>
                        <div>{fmt(m.score)}{m.semSalgaRetiro && " · sem salga"}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Fragment>
            );
          })}
        </Card>
      )}
    </div>
  );
}
