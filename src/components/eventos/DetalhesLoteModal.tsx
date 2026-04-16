import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Beef, Scale, Syringe, Calendar, History } from "lucide-react";
import CarenciaBadge from "./CarenciaBadge";
import { useUltimaPesagem, useUltimoSanitario, calcCarenciaDias } from "@/hooks/useEventosLote";

interface PastoInfo {
  id: string;
  nome: string;
  num_animais: number;
  peso_medio_kg: number | null;
  categoria: string | null;
  sexo: string | null;
  ultima_movimentacao?: string | null;
  ultima_salga?: string | null;
  data_fim_carencia?: string | null;
  ultima_pesagem_em?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  pasto: PastoInfo | null;
  onVerHistorico: () => void;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

const catLabels: Record<string, string> = {
  vermifugo: "Vermífugo",
  vacina: "Vacina",
  vitamina: "Vitamina",
  antibiotico: "Antibiótico",
  outro: "Outro",
};

export default function DetalhesLoteModal({ open, onClose, pasto, onVerHistorico }: Props) {
  const pesagem = useUltimaPesagem(pasto?.id);
  const sanitario = useUltimoSanitario(pasto?.id);

  if (!pasto) return null;

  const carenciaDias = sanitario ? calcCarenciaDias(sanitario.data_fim_carencia) : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Beef className="w-4 h-4" />
            {pasto.nome}
          </DialogTitle>
          <DialogDescription>Detalhes do lote</DialogDescription>
        </DialogHeader>

        <CarenciaBadge dataFimCarencia={pasto.data_fim_carencia} className="mb-2" />

        {/* Seção 1 — Informações Gerais */}
        <div className="space-y-1">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Informações Gerais</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Item label="Animais" value={String(pasto.num_animais)} />
            <Item label="Peso médio" value={pasto.peso_medio_kg != null ? `${pasto.peso_medio_kg} kg` : "—"} />
            <Item label="Categoria" value={pasto.categoria || "—"} />
            <Item label="Sexo" value={pasto.sexo || "—"} />
            <Item label="Última movimentação" value={fmtDate(pasto.ultima_movimentacao)} />
            <Item label="Última salga" value={fmtDate(pasto.ultima_salga)} />
          </div>
        </div>

        {/* Seção 2 — Pesagem */}
        <div className="space-y-1 border-t pt-3">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1">
            <Scale className="w-3 h-3" /> Pesagem
          </h4>
          {pesagem ? (
            <div className="text-sm space-y-0.5">
              <p>Última pesagem: <strong>{fmtDate(pesagem.data_pesagem)}</strong></p>
              <p>Animais pesados: <strong>{pesagem.total_pesado}</strong></p>
              <p>Peso médio calculado: <strong>{pesagem.media_calculada != null ? `${pesagem.media_calculada} kg` : "—"}</strong></p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma pesagem registrada</p>
          )}
        </div>

        {/* Seção 3 — Sanidade */}
        <div className="space-y-1 border-t pt-3">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1">
            <Syringe className="w-3 h-3" /> Sanidade
          </h4>
          {sanitario ? (
            <div className="text-sm space-y-0.5">
              <p><strong>{catLabels[sanitario.categoria] || sanitario.categoria}</strong>: {sanitario.medicamento}</p>
              <p className="text-muted-foreground">Dose: {sanitario.dose}</p>
              <p className="text-muted-foreground">Data: {fmtDate(sanitario.data_aplicacao)}</p>
              {carenciaDias > 0 && (
                <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium bg-destructive/10 text-destructive border border-destructive/30">
                  Carência restante: {carenciaDias} dias
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum evento sanitário registrado</p>
          )}
        </div>

        <Button variant="outline" className="w-full mt-2" onClick={onVerHistorico}>
          <History className="w-4 h-4 mr-2" />
          Ver histórico completo
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
