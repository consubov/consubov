import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { downloadPdfFromUrl } from "@/lib/downloadPdf";

const CATEGORIA_LABELS: Record<string, string> = {
  boi_gordo: "Boi Gordo",
  vaca_gorda: "Vaca Gorda",
  vaca_magra: "Vaca Magra",
  boi_magro: "Boi Magro",
  garrote: "Garrote",
  novilha: "Novilha",
  bezerro: "Bezerro",
  bezerra: "Bezerra",
  aleatoria: "Aleatória",
};

type PesagemRow = {
  id: string;
  cliente_id: string;
  categoria: string;
  finalizada_at: string;
  pdf_url: string | null;
  valor_total_pago: number | null;
};

const PAGE_SIZE = 20;

export default function PesadorPesagemPage() {
  const [loading, setLoading] = useState(true);
  const [pesagens, setPesagens] = useState<PesagemRow[]>([]);
  const [clienteNomes, setClienteNomes] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    (async () => {
      const { data: authUser } = await supabase.auth.getUser();
      const uid = authUser.user?.id;
      if (!uid) { setLoading(false); return; }

      const { data: pes } = await supabase
        .from("pesadores")
        .select("id")
        .eq("user_id", uid)
        .maybeSingle();
      const pesadorId = (pes as any)?.id as string | undefined;
      if (!pesadorId) { setLoading(false); return; }

      const { data: pAll } = await supabase
        .from("pesagens_compra")
        .select("id, cliente_id, categoria, finalizada_at, pdf_url, valor_total_pago")
        .eq("pesador_id", pesadorId)
        .not("finalizada_at", "is", null)
        .order("finalizada_at", { ascending: false });
      const rows = (pAll ?? []) as PesagemRow[];
      setPesagens(rows);

      const clienteIds = Array.from(new Set(rows.map((r) => r.cliente_id)));
      if (clienteIds.length > 0) {
        const { data: cs } = await supabase
          .from("clientes_pesador")
          .select("id, nome")
          .in("id", clienteIds);
        const cmap: Record<string, string> = {};
        for (const c of cs ?? []) cmap[(c as any).id] = (c as any).nome;
        setClienteNomes(cmap);
      }
      setLoading(false);
    })();
  }, []);

  const items = useMemo(() => {
    return pesagens.map((p) => ({
      ...p,
      totalValor: Number(p.valor_total_pago ?? 0),
      produtor: clienteNomes[p.cliente_id] ?? "—",
    }));
  }, [pesagens, clienteNomes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.produtor.toLowerCase().includes(q));
  }, [items, query]);

  const shown = filtered.slice(0, visible);

  const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtDate = (iso: string) => { try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso; } };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando histórico...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Histórico</h1>
        <p className="text-sm text-muted-foreground">Pesagens finalizadas.</p>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setVisible(PAGE_SIZE); }}
          placeholder="Buscar por produtor..."
          className="pl-9"
        />
      </div>

      <div className="rounded-lg border bg-card">
        {shown.length === 0 ? (
          <div className="text-xs text-muted-foreground py-8 text-center">
            {query ? "Nenhum resultado." : "Nenhuma pesagem finalizada ainda."}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {shown.map((p) => (
              <div key={p.id} className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{p.produtor}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {CATEGORIA_LABELS[p.categoria] ?? p.categoria} • {fmtDate(p.finalizada_at)}
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <div className="text-sm font-semibold text-primary">{brl(p.totalValor)}</div>
                  {p.pdf_url && (
                    <button
                      type="button"
                      onClick={() => void downloadPdfFromUrl(p.pdf_url!, `pesagem-${p.id}.pdf`)}
                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
                    >
                      <FileDown className="w-3 h-3" /> PDF
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {filtered.length > visible && (
        <div className="text-center">
          <button
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="text-sm text-primary font-medium py-2 px-4 rounded-md hover:bg-muted"
          >
            Carregar mais ({filtered.length - visible})
          </button>
        </div>
      )}
    </div>
  );
}
