import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { maFrom, maGetUser } from "@/lib/maOffline";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileDown, Search, Scale, Split, Trash2 } from "lucide-react";
import { downloadPdfFromUrl } from "@/lib/downloadPdf";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useMaOffline } from "@/components/maisarrobas/ModoOfflinePanel";
import { gerarPdfPesagemPecuaristaHistorico } from "@/lib/pecuaristaPdfHistorico";

const CATEGORIAS_PADRAO: Record<string, string> = {
  boi_gordo: "Boi Gordo", vaca_gorda: "Vaca Gorda", vaca_magra: "Vaca Magra",
  boi_magro: "Boi Magro", garrote: "Garrote", novilha: "Novilha",
  bezerro: "Bezerro", bezerra: "Bezerra",
};

type Item = {
  id: string;             // "p-<uuid>" ou "a-<uuid>"
  rawId: string;          // uuid da pesagem/apartação
  tipo: "pesagem" | "apartacao";
  data: string;
  loteNome: string;
  fazendaNome: string;
  categoria: string;
  gmd: number | null;
  pdfUrl: string | null;
};

const PAGE_SIZE = 20;

function extractStoragePath(url: string, bucket: string): string | null {
  const marker = `/${bucket}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return url.slice(i + marker.length).split("?")[0];
}

export default function PecuaristaHistoricoPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [toDelete, setToDelete] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState(false);
  const off = useMaOffline();
  const [gerandoId, setGerandoId] = useState<string | null>(null);

  async function gerarPdf(item: Item) {
    setGerandoId(item.id);
    try {
      const url = await gerarPdfPesagemPecuaristaHistorico(item.rawId, item.categoria);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, pdfUrl: url } : i)));
      toast.success("PDF gerado");
      void downloadPdfFromUrl(url, `pesagem-${item.rawId}.pdf`);
    } catch (e: any) {
      toast.error("Erro ao gerar PDF: " + (e?.message ?? ""));
    }
    setGerandoId(null);
  }

  async function load() {
    setLoading(true);
    const { data: authUser } = await maGetUser();
    const uid = authUser.user?.id;
    if (!uid) { setLoading(false); return; }
    const { data: p } = await maFrom("pecuaristas").select("id").eq("user_id", uid).maybeSingle();
    const pid = (p as any)?.id as string | undefined;
    if (!pid) { setLoading(false); return; }

    const [lotesRes, fazRes, catRes] = await Promise.all([
      maFrom("lotes_pecuarista").select("id, nome_lote, fazenda_id, categoria, categoria_customizada_id").eq("pecuarista_id", pid),
      maFrom("fazendas_pecuarista").select("id, nome_fazenda").eq("pecuarista_id", pid),
      maFrom("categorias_pecuarista").select("id, nome").eq("pecuarista_id", pid),
    ]);
    const lotes = (lotesRes.data ?? []) as any[];
    const fazMap: Record<string, string> = {};
    (fazRes.data ?? []).forEach((f: any) => { fazMap[f.id] = f.nome_fazenda; });
    const catMap: Record<string, string> = {};
    (catRes.data ?? []).forEach((c: any) => { catMap[c.id] = c.nome; });

    const loteMap: Record<string, { nome: string; fazenda: string; categoria: string }> = {};
    lotes.forEach((l) => {
      const cat = l.categoria === "customizada"
        ? (catMap[l.categoria_customizada_id] ?? "Personalizada")
        : (CATEGORIAS_PADRAO[l.categoria] ?? l.categoria);
      loteMap[l.id] = { nome: l.nome_lote, fazenda: fazMap[l.fazenda_id] ?? "—", categoria: cat };
    });

    const loteIds = lotes.map((l) => l.id);
    const collected: Item[] = [];

    if (loteIds.length > 0) {
      const { data: pes } = await maFrom("pesagens_lote_pecuarista")
        .select("id, lote_id, data_pesagem, gmd, pdf_url, apartacao_id")
        .in("lote_id", loteIds)
        .not("hora_fim", "is", null)
        .gt("quantidade_animais", 0)
        .is("apartacao_id", null)
        .order("data_pesagem", { ascending: false });
      for (const r of (pes ?? []) as any[]) {
        const l = loteMap[r.lote_id];
        if (!l) continue;
        collected.push({
          id: `p-${r.id}`,
          rawId: r.id,
          tipo: "pesagem",
          data: r.data_pesagem,
          loteNome: l.nome,
          fazendaNome: l.fazenda,
          categoria: l.categoria,
          gmd: r.gmd != null ? Number(r.gmd) : null,
          pdfUrl: r.pdf_url ?? null,
        });
      }

      const { data: aps } = await maFrom("apartacoes_pecuarista")
        .select("id, lote_origem_id, data_apartacao, pdf_url")
        .eq("pecuarista_id", pid)
        .not("pdf_url", "is", null)
        .order("data_apartacao", { ascending: false });
      for (const r of (aps ?? []) as any[]) {
        const l = loteMap[r.lote_origem_id];
        if (!l) continue;
        collected.push({
          id: `a-${r.id}`,
          rawId: r.id,
          tipo: "apartacao",
          data: r.data_apartacao,
          loteNome: l.nome,
          fazendaNome: l.fazenda,
          categoria: l.categoria,
          gmd: null,
          pdfUrl: r.pdf_url ?? null,
        });
      }
    }

    collected.sort((a, b) => (a.data < b.data ? 1 : -1));
    setItems(collected);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const sb = supabase as any;
      if (toDelete.tipo === "pesagem") {
        // filhos: pesos individuais
        await sb.from("pesos_animais_pecuarista").delete().eq("pesagem_lote_id", toDelete.rawId);
        const { error } = await sb.from("pesagens_lote_pecuarista").delete().eq("id", toDelete.rawId);
        if (error) throw error;
      } else {
        // apartação: buscar pesagens filhas
        const { data: pesFilhas } = await sb
          .from("pesagens_lote_pecuarista")
          .select("id")
          .eq("apartacao_id", toDelete.rawId);
        const pesIds = (pesFilhas ?? []).map((r: any) => r.id);
        if (pesIds.length > 0) {
          await sb.from("pesos_animais_pecuarista").delete().in("pesagem_lote_id", pesIds);
          await sb.from("pesagens_lote_pecuarista").delete().in("id", pesIds);
        }
        await sb.from("apartacao_destinos_pecuarista").delete().eq("apartacao_id", toDelete.rawId);
        await sb.from("apartacao_lotes").delete().eq("apartacao_id", toDelete.rawId);
        const { error } = await sb.from("apartacoes_pecuarista").delete().eq("id", toDelete.rawId);
        if (error) throw error;
      }

      if (toDelete.pdfUrl) {
        const path = extractStoragePath(toDelete.pdfUrl, "relatorios");
        if (path) await supabase.storage.from("relatorios").remove([path]);
      }

      toast.success("Registro excluído.");
      setToDelete(null);
      await load();
    } catch (e: any) {
      toast.error("Erro ao excluir: " + (e?.message || "desconhecido"));
    } finally {
      setDeleting(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      it.loteNome.toLowerCase().includes(q) || it.fazendaNome.toLowerCase().includes(q)
    );
  }, [items, query]);

  const shown = filtered.slice(0, visible);
  const fmtDate = (iso: string) => { try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso; } };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando histórico...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Histórico</h1>
        <p className="text-sm text-muted-foreground">Pesagens e apartações finalizadas.</p>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setVisible(PAGE_SIZE); }}
          placeholder="Buscar por lote ou fazenda..."
          className="pl-9"
        />
      </div>

      <Card className="p-0">
        {shown.length === 0 ? (
          <div className="text-xs text-muted-foreground py-8 text-center">
            {query ? "Nenhum resultado." : "Nenhuma pesagem finalizada ainda."}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {shown.map((p) => (
              <div key={p.id} className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{p.loteNome}</span>
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      {p.tipo === "apartacao" ? <><Split className="w-3 h-3" /> Apartação</> : <><Scale className="w-3 h-3" /> Pesagem</>}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {p.fazendaNome} • {p.categoria} • {fmtDate(p.data)}
                    {p.gmd != null && ` • GMD ${p.gmd.toFixed(3)} kg/d`}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {!p.pdfUrl && p.tipo === "pesagem" && (
                    <button
                      type="button"
                      onClick={() => void gerarPdf(p)}
                      disabled={off.active || gerandoId !== null}
                      title={off.active ? "PDF disponível após sincronizar" : undefined}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50 disabled:no-underline"
                    >
                      {gerandoId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                      {off.active ? "PDF após sincronizar" : "Gerar PDF"}
                    </button>
                  )}
                  {p.pdfUrl && (
                    <button
                      type="button"
                      onClick={() => void downloadPdfFromUrl(p.pdfUrl!, `${p.tipo}-${p.rawId}.pdf`)}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <FileDown className="w-4 h-4" /> PDF
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setToDelete(p)}
                    className="inline-flex items-center gap-1 text-xs text-destructive hover:text-destructive/80"
                    aria-label="Excluir registro"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

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

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {toDelete?.tipo === "apartacao" ? "apartação" : "pesagem"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja apagar esta {toDelete?.tipo === "apartacao" ? "apartação" : "pesagem"} de{" "}
              <strong>{toDelete?.fazendaNome ?? "—"}</strong>?
              Essa ação não pode ser desfeita e vai afetar os totais do Painel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void handleDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
