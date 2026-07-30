import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useDietaCategorias } from "@/hooks/useDietaCategorias";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { DIETA_CATEGORIAS_FIXAS } from "@/hooks/useDietaCategorias";

export default function ConsultorConfiguracoesPage() {
  const { roleData } = useAuth();
  const consultorId = roleData?.consultorId ?? null;
  const { categorias, loading, criar, renomear, excluir } = useDietaCategorias(consultorId);

  const [nova, setNova] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [excluirAlvo, setExcluirAlvo] = useState<{ id: string; nome: string } | null>(null);

  async function handleCriar() {
    const nome = nova.trim();
    if (!nome) return;
    setSalvando(true);
    const res = await criar(nome);
    setSalvando(false);
    if (!res) return toast.error("Não foi possível criar a categoria.");
    setNova("");
    toast.success("Categoria criada");
  }

  async function handleRenomear(id: string) {
    const ok = await renomear(id, editNome);
    if (!ok) return toast.error("Não foi possível salvar.");
    setEditandoId(null);
    toast.success("Categoria atualizada");
  }

  async function handleExcluir() {
    if (!excluirAlvo) return;
    const ok = await excluir(excluirAlvo.id);
    setExcluirAlvo(null);
    if (!ok) return toast.error("Não foi possível excluir.");
    toast.success("Categoria excluída");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-foreground">Configurações</h1>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Categorias de Dieta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2">Categorias fixas do sistema</p>
            <div className="flex flex-wrap gap-2">
              {DIETA_CATEGORIAS_FIXAS.map(nome => (
                <Badge key={nome} variant="secondary">{nome}</Badge>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">
              Suas categorias personalizadas (válidas em todas as fazendas e visitas)
            </p>
            {loading && categorias.length === 0 ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : categorias.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma categoria personalizada.</p>
            ) : (
              <ul className="space-y-2">
                {categorias.map(cat => (
                  <li key={cat.id} className="flex items-center gap-2">
                    {editandoId === cat.id ? (
                      <>
                        <Input value={editNome} onChange={e => setEditNome(e.target.value)} autoFocus />
                        <Button size="icon" variant="ghost" onClick={() => void handleRenomear(cat.id)} aria-label="Salvar">
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditandoId(null)} aria-label="Cancelar">
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm text-foreground">{cat.nome}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => { setEditandoId(cat.id); setEditNome(cat.nome); }}
                          aria-label={`Editar ${cat.nome}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setExcluirAlvo({ id: cat.id, nome: cat.nome })}
                          aria-label={`Excluir ${cat.nome}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex gap-2 pt-2 border-t">
            <Input
              value={nova}
              onChange={e => setNova(e.target.value)}
              placeholder="Nova categoria de dieta"
            />
            <Button onClick={() => void handleCriar()} disabled={salvando || !nova.trim()}>
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!excluirAlvo} onOpenChange={o => !o && setExcluirAlvo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria {excluirAlvo?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              A categoria deixará de aparecer em novas visitas. Currais já salvos mantêm o texto registrado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => void handleExcluir()}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
