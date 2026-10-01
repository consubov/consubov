import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Package2, FlaskConical, Warehouse, AlertTriangle } from "lucide-react";

interface EstoqueProd {
  id: string; produto_id: string; quantidade_sacos: number | null;
  quantidade_kg: number | null; atualizado_em?: string | null;
}
interface Produto { id: string; nome: string; peso_saco_kg: number | null; }
interface MateriaPrima {
  id: string; nome: string; unidade: string; peso_por_saco: number | null;
  estoque_atual: number | null; estoque_minimo: number | null; ativo: boolean | null;
}
interface Formula {
  id: string; nome: string; peso_batida: number | null;
  producao_esperada: number | null; ativo: boolean | null; produto_id: string | null;
}
interface Ingrediente {
  formula_id: string; materia_prima_id: string; quantidade: number;
}

export default function DadosTab({ fabricaId }: { fabricaId: string }) {
  const [loading, setLoading] = useState(true);
  const [estoques, setEstoques] = useState<EstoqueProd[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [materias, setMaterias] = useState<MateriaPrima[]>([]);
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [detFormula, setDetFormula] = useState<Formula | null>(null);

  useEffect(() => { load(); }, [fabricaId]);

  async function load() {
    setLoading(true);
    const [eq, pr, mp, fm] = await Promise.all([
      supabase.from("estoque_produto_acabado").select("*").eq("fabrica_id", fabricaId),
      supabase.from("produtos").select("id, nome, peso_saco_kg").eq("ativo", true),
      supabase.from("materias_primas").select("*").eq("fabrica_id", fabricaId).order("nome"),
      supabase.from("formulas_fabrica").select("*").eq("fabrica_id", fabricaId).order("nome"),
    ]);
    setEstoques(((eq.data as EstoqueProd[]) || []).filter(e => Number(e.quantidade_sacos || 0) > 0));
    setProdutos((pr.data as Produto[]) || []);
    setMaterias((mp.data as MateriaPrima[]) || []);
    const fms = (fm.data as Formula[]) || [];
    setFormulas(fms);
    if (fms.length) {
      const { data: ing } = await supabase.from("formula_ingredientes")
        .select("formula_id, materia_prima_id, quantidade").in("formula_id", fms.map(f => f.id));
      setIngredientes((ing as Ingrediente[]) || []);
    } else {
      setIngredientes([]);
    }
    setLoading(false);
  }

  const prodMap = useMemo(() => Object.fromEntries(produtos.map(p => [p.id, p])), [produtos]);
  const mpMap = useMemo(() => Object.fromEntries(materias.map(m => [m.id, m])), [materias]);

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  const ingsDaFormula = detFormula ? ingredientes.filter(i => i.formula_id === detFormula.id) : [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Warehouse className="w-4 h-4 text-secondary" /> Estoque Atual</CardTitle></CardHeader>
        <CardContent className="p-0">
          {estoques.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Nenhum produto em estoque.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Sacos</TableHead>
                  <TableHead className="text-right">Kg</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {estoques.map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{prodMap[e.produto_id]?.nome || "—"}</TableCell>
                      <TableCell className="text-right">{Number(e.quantidade_sacos || 0)}</TableCell>
                      <TableCell className="text-right">{Number(e.quantidade_kg || 0).toFixed(1)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Package2 className="w-4 h-4 text-secondary" /> Matérias-Primas</CardTitle></CardHeader>
        <CardContent className="p-0">
          {materias.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma matéria-prima cadastrada.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Un.</TableHead>
                  <TableHead className="text-right">Peso/Saco</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {materias.map(m => {
                    const atual = Number(m.estoque_atual || 0);
                    const min = Number(m.estoque_minimo || 0);
                    const alerta = min > 0 && atual < min;
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.nome}</TableCell>
                        <TableCell>{m.unidade}</TableCell>
                        <TableCell className="text-right">{m.peso_por_saco ?? "—"}</TableCell>
                        <TableCell className={`text-right ${alerta ? "text-destructive font-semibold" : ""}`}>{atual}</TableCell>
                        <TableCell className="text-right">{min || "—"}</TableCell>
                        <TableCell>
                          {alerta ? (
                            <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" /> Alerta</Badge>
                          ) : (
                            <Badge variant="secondary">OK</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><FlaskConical className="w-4 h-4 text-secondary" /> Fórmulas</CardTitle></CardHeader>
        <CardContent className="p-0">
          {formulas.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma fórmula cadastrada.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Peso Batida</TableHead>
                  <TableHead className="text-right">Prod. Esperada</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {formulas.map(f => (
                    <TableRow key={f.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setDetFormula(f)}>
                      <TableCell className="font-medium text-primary underline-offset-2 hover:underline">{f.nome}</TableCell>
                      <TableCell>{f.produto_id ? (prodMap[f.produto_id]?.nome || "—") : "—"}</TableCell>
                      <TableCell className="text-right">{f.peso_batida ?? "—"}</TableCell>
                      <TableCell className="text-right">{f.producao_esperada ?? "—"}</TableCell>
                      <TableCell><Badge variant={f.ativo ? "default" : "secondary"}>{f.ativo ? "Ativa" : "Inativa"}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detFormula} onOpenChange={o => !o && setDetFormula(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detFormula?.nome}</DialogTitle>
            <DialogDescription>
              Produto: <b>{detFormula?.produto_id ? (prodMap[detFormula.produto_id]?.nome || "—") : "—"}</b>
              {" • "}Peso batida: <b>{detFormula?.peso_batida ?? "—"}</b>
              {" • "}Produção esperada: <b>{detFormula?.producao_esperada ?? "—"} sc</b>
            </DialogDescription>
          </DialogHeader>
          <div>
            <h4 className="text-sm font-semibold mb-2">Ingredientes</h4>
            {ingsDaFormula.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem ingredientes cadastrados.</p>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Matéria-Prima</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {ingsDaFormula.map((i, idx) => {
                    const mp = mpMap[i.materia_prima_id];
                    return (
                      <TableRow key={idx}>
                        <TableCell>{mp?.nome || "?"}</TableCell>
                        <TableCell className="text-right">{i.quantidade} {mp?.unidade || ""}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
