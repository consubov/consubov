import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  pastoId: string;
  pastoNome: string;
  numAnimaisAtual: number;
  pesoAtual: number | null;
  sexoAtual?: string | null;
  categoriaAtual?: string | null;
  ativoAtual?: boolean | null;
  onPastoUpdated: () => void;
}

function calcCategoria(peso: number | null, sexo: string): string {
  if (peso === null || peso <= 0) return "";
  if (sexo === "Fêmea") {
    if (peso <= 220) return "Recria 1";
    if (peso <= 299) return "Recria 2";
    return "Engorda";
  }
  if (peso <= 220) return "Recria 1";
  if (peso <= 360) return "Recria 2";
  return "Engorda";
}

function categoriaBadgeClass(cat: string) {
  if (cat === "Recria 1") return "bg-blue-500 text-white";
  if (cat === "Recria 2") return "bg-yellow-500 text-black";
  if (cat === "Engorda") return "bg-green-600 text-white";
  return "";
}

interface FormState {
  nome: string;
  quantidade: string;
  peso: string;
  sexo: string;
  categoria: string;
  categoriaManual: boolean;
  ativo: boolean;
}

export default function EditarQuantidadeCapatazModal({
  open, onClose, pastoId, pastoNome, numAnimaisAtual, pesoAtual,
  sexoAtual, categoriaAtual, ativoAtual, onPastoUpdated,
}: Props) {
  const buildInitial = (): FormState => ({
    nome: pastoNome ?? "",
    quantidade: numAnimaisAtual > 0 ? String(numAnimaisAtual) : "",
    peso: pesoAtual != null && pesoAtual > 0 ? String(pesoAtual) : "",
    sexo: sexoAtual || "Macho",
    categoria: categoriaAtual || "",
    categoriaManual: false,
    ativo: ativoAtual ?? true,
  });

  const [form, setForm] = useState<FormState>(buildInitial);
  const [salvando, setSalvando] = useState(false);
  const [zerando, setZerando] = useState(false);
  const [showZerarConfirm, setShowZerarConfirm] = useState(false);

  useEffect(() => {
    if (open) setForm(buildInitial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pesoNum = form.peso ? parseFloat(form.peso) : null;
  const categoriaCalculada = useMemo(() => calcCategoria(pesoNum, form.sexo), [pesoNum, form.sexo]);

  function handleClose() {
    setSalvando(false);
    setZerando(false);
    setShowZerarConfirm(false);
    onClose();
  }

  function handlePesoChange(val: string) {
    const peso = val ? parseFloat(val) : null;
    const newForm = { ...form, peso: val };
    if (!form.categoriaManual) newForm.categoria = calcCategoria(peso, form.sexo);
    setForm(newForm);
  }

  function handleSexoChange(val: string) {
    const newForm = { ...form, sexo: val };
    if (!form.categoriaManual) newForm.categoria = calcCategoria(pesoNum, val);
    setForm(newForm);
  }

  function handleCategoriaChange(val: string) {
    setForm({ ...form, categoria: val, categoriaManual: true });
  }

  const qtdNum = parseInt(form.quantidade, 10);
  const isValid =
    form.nome.trim().length > 0 &&
    Number.isFinite(qtdNum) && qtdNum >= 0 &&
    (form.peso === "" || (Number.isFinite(pesoNum) && (pesoNum ?? 0) >= 0));

  async function handleSave() {
    if (!isValid) return;
    setSalvando(true);
    try {
      const { error } = await supabase.from("pastos")
        .update({
          nome: form.nome.trim(),
          num_animais: qtdNum,
          peso_medio_kg: pesoNum ?? null,
          categoria: form.categoria || null,
          sexo: form.sexo || null,
          ativo: form.ativo,
        })
        .eq("id", pastoId);
      if (error) throw error;
      toast.success(`Pasto ${form.nome.trim()} atualizado com sucesso!`);
      onPastoUpdated();
      handleClose();
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || "Erro desconhecido"}`);
    } finally {
      setSalvando(false);
    }
  }

  async function handleZerarPasto() {
    setZerando(true);
    try {
      const { error } = await supabase.from("pastos")
        .update({
          num_animais: 0,
          peso_medio_kg: null,
        })
        .eq("id", pastoId);
      if (error) throw error;
      toast.success("Pasto zerado com sucesso!");
      onPastoUpdated();
      handleClose();
    } catch (err: any) {
      toast.error(`Erro ao zerar pasto: ${err?.message || "Erro desconhecido"}`);
    } finally {
      setZerando(false);
      setShowZerarConfirm(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (o) setForm(buildInitial()); if (!o) handleClose(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Pasto</DialogTitle>
            <DialogDescription>
              Preencha os dados do pasto. A categoria é calculada automaticamente pelo peso e sexo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="capataz-nome">Nome</Label>
              <Input
                id="capataz-nome"
                value={form.nome}
                disabled
                readOnly
                className="bg-muted/50 text-muted-foreground"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="capataz-num-animais">Nº Animais</Label>
                <Input
                  id="capataz-num-animais"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={form.quantidade}
                  onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capataz-peso">Peso Médio (kg)</Label>
                <Input
                  id="capataz-peso"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={0}
                  value={form.peso}
                  onChange={(e) => handlePesoChange(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Sexo</Label>
                <Select value={form.sexo} onValueChange={handleSexoChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Macho">Macho</SelectItem>
                    <SelectItem value="Fêmea">Fêmea</SelectItem>
                    <SelectItem value="Misto">Misto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={handleCategoriaChange}>
                  <SelectTrigger><SelectValue placeholder="Automática" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Recria 1">Recria 1</SelectItem>
                    <SelectItem value="Recria 2">Recria 2</SelectItem>
                    <SelectItem value="Engorda">Engorda</SelectItem>
                  </SelectContent>
                </Select>
                {categoriaCalculada && (
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold mt-1 ${categoriaBadgeClass(categoriaCalculada)}`}>
                    {categoriaCalculada}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="capataz-ativo">Ativo</Label>
              <Switch
                id="capataz-ativo"
                checked={form.ativo}
                onCheckedChange={(checked) => setForm({ ...form, ativo: checked })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Button onClick={handleSave} className="w-full" disabled={!isValid || salvando || zerando}>
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
              </Button>
              <Button variant="outline" className="w-full" onClick={handleClose} disabled={salvando || zerando}>
                Cancelar
              </Button>
            </div>

            <div className="border-t border-destructive/20 pt-3">
              <Button
                variant="outline"
                className="w-full border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setShowZerarConfirm(true)}
                disabled={salvando || zerando}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Zerar pasto
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showZerarConfirm} onOpenChange={setShowZerarConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zerar pasto?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai zerar a quantidade de animais e o peso médio deste pasto. A ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowZerarConfirm(false)} disabled={zerando}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleZerarPasto}
              disabled={zerando}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {zerando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
