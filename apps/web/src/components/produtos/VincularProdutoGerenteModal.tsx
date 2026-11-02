import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { salvarVinculosProduto } from "@/lib/produtosFazenda";

interface Fazenda { id: string; nome: string }
interface ProdutoLite { id: string; nome: string; marca: string | null }

interface Props {
  open: boolean;
  onClose: () => void;
  produto: ProdutoLite | null;
  fazendas: Fazenda[]; // fazendas do gerente (gerentes_fazendas)
  onSaved: () => void;
}

/** Vincular (Gerente): só marca em quais fazendas o produto fica disponível. */
export default function VincularProdutoGerenteModal({ open, onClose, produto, fazendas, onSaved }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [vincAtual, setVincAtual] = useState<string[]>([]);
  const [emUso, setEmUso] = useState<Set<string>>(new Set());
  const [fazSel, setFazSel] = useState<Set<string>>(new Set());

  const pid = produto?.id ?? "";
  const fazIds = useMemo(() => fazendas.map((f) => f.id), [fazendas]);

  useEffect(() => {
    if (!open || !pid || fazIds.length === 0) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const [vRes, rRes] = await Promise.all([
        (supabase as any).from("produtos_fazendas").select("fazenda_id").eq("produto_id", pid).in("fazenda_id", fazIds),
        supabase.from("retiros").select("id, produto_id, fazenda_id").in("fazenda_id", fazIds).eq("ativo", true),
      ]);
      const rets = (rRes.data ?? []) as { id: string; produto_id: string | null; fazenda_id: string }[];
      const { data: pData } = rets.length
        ? await supabase.from("pastos").select("retiro_id").eq("produto_id", pid).in("retiro_id", rets.map((r) => r.id)).eq("ativo", true)
        : { data: [] as { retiro_id: string }[] };
      if (cancel) return;
      const fazDoRetiro = Object.fromEntries(rets.map((r) => [r.id, r.fazenda_id]));
      const uso = new Set<string>();
      rets.forEach((r) => { if (r.produto_id === pid) uso.add(r.fazenda_id); });
      ((pData ?? []) as { retiro_id: string }[]).forEach((p) => { if (fazDoRetiro[p.retiro_id]) uso.add(fazDoRetiro[p.retiro_id]); });
      const v = ((vRes.data ?? []) as { fazenda_id: string }[]).map((x) => x.fazenda_id);
      setVincAtual(v);
      setEmUso(uso);
      setFazSel(new Set(v));
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [open, pid, fazIds]);

  const fazAdd = fazendas.filter((f) => fazSel.has(f.id) && !vincAtual.includes(f.id));
  const fazRem = fazendas.filter((f) => !fazSel.has(f.id) && vincAtual.includes(f.id));
  const temMudanca = fazAdd.length + fazRem.length > 0;

  async function executar() {
    setSaving(true);
    try {
      await salvarVinculosProduto(pid, Array.from(fazSel), fazIds);
      toast.success("Vínculos salvos!");
      setConfirmOpen(false);
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err?.message || "erro desconhecido"}`);
    } finally {
      setSaving(false);
    }
  }

  const nomeProduto = produto ? (produto.marca ? `${produto.marca} — ${produto.nome}` : produto.nome) : "";

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vincular produto</DialogTitle>
            <DialogDescription>{nomeProduto} — marque as fazendas onde ele fica disponível.</DialogDescription>
          </DialogHeader>
          {loading ? (
            <div className="flex justify-center p-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-3">
              {fazendas.map((f) => {
                const marcada = fazSel.has(f.id);
                const travada = marcada && emUso.has(f.id);
                return (
                  <div key={f.id} className="rounded-md border p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <Checkbox id={`f-${f.id}`} checked={marcada} disabled={travada}
                        onCheckedChange={() => { const n = new Set(fazSel); if (n.has(f.id)) n.delete(f.id); else n.add(f.id); setFazSel(n); }} />
                      <Label htmlFor={`f-${f.id}`} className="font-semibold cursor-pointer">{f.nome}</Label>
                      <span className="text-xs text-muted-foreground ml-auto">{marcada ? "disponível" : "indisponível"}</span>
                    </div>
                    {travada && <p className="text-xs text-muted-foreground">Em uso — altere na aba Onde usar</p>}
                  </div>
                );
              })}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancelar</Button>
                <Button className="flex-1" disabled={saving || !temMudanca} onClick={() => setConfirmOpen(true)}>Salvar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !saving && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar alterações</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1 text-sm">
                {fazAdd.map((f) => <p key={f.id}>{f.nome}: disponível</p>)}
                {fazRem.map((f) => <p key={f.id}>{f.nome}: deixa de estar disponível</p>)}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={(e) => { e.preventDefault(); executar(); }}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
