import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Check, ChevronDown, ChevronUp, PartyPopper, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepState {
  fazenda: boolean;
  visita: boolean;
  pdf: boolean;
}

const CONTATO_WHATSAPP = "https://wa.me/5563992004848?text=Ol%C3%A1!%20Testei%20o%20Relatto%20e%20quero%20assinar.";

/**
 * Fluxo guiado exibido apenas para contas de demonstração (is_demo).
 * Passos: cadastrar fazenda -> completar visita -> gerar PDF.
 */
export default function DemoTour({ consultorId }: { consultorId: string }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [steps, setSteps] = useState<StepState>({ fazenda: false, visita: false, pdf: false });
  const [collapsed, setCollapsed] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [endShownOnce, setEndShownOnce] = useState(false);

  const refresh = useCallback(async () => {
    const { data: fazendas } = await supabase
      .from("fazendas_consultor")
      .select("id")
      .eq("consultor_id", consultorId)
      .is("deleted_at", null)
      .limit(1);

    const { data: visitas } = await supabase
      .from("visitas_tecnicas")
      .select("id, pdf_url")
      .eq("consultor_id", consultorId)
      .is("deleted_at", null);

    const temVisita = (visitas ?? []).length > 0;
    const temPdf = (visitas ?? []).some((v) => !!v.pdf_url);
    setSteps({ fazenda: (fazendas ?? []).length > 0, visita: temVisita, pdf: temPdf });
  }, [consultorId]);

  useEffect(() => {
    void refresh();
  }, [refresh, location.pathname]);

  useEffect(() => {
    const id = window.setInterval(() => void refresh(), 20000);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (steps.fazenda && steps.visita && steps.pdf && !endShownOnce) {
      setShowEnd(true);
      setEndShownOnce(true);
    }
  }, [steps, endShownOnce]);

  const items = [
    { key: "fazenda", n: 1, label: "Cadastre 1 fazenda", hint: "Toque em “Nova fazenda” — já sugerimos dados de exemplo.", done: steps.fazenda, to: "/consultor" },
    { key: "visita", n: 2, label: "Faça 1 visita", hint: "Escolha Rotina, Confinamento ou Fábrica e preencha.", done: steps.visita, to: "/consultor" },
    { key: "pdf", n: 3, label: "Gere o PDF", hint: "Na revisão, toque em “Salvar e gerar PDF”.", done: steps.pdf, to: "/consultor/historico" },
  ];

  const concluidos = items.filter((i) => i.done).length;

  async function encerrar() {
    window.localStorage.removeItem("relatto_demo");
    await signOut();
    navigate("/relatto");
  }

  return (
    <>
      <div className="fixed bottom-20 left-2 right-2 z-40 max-w-5xl mx-auto">
        <div className="rounded-xl border border-primary/30 bg-card shadow-lg overflow-hidden">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-primary/10"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="w-4 h-4 text-primary" />
              Demonstração — {concluidos}/3 passos
            </span>
            {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {!collapsed && (
            <div className="p-3 space-y-2">
              {items.map((i) => (
                <button
                  key={i.key}
                  onClick={() => navigate(i.to)}
                  className={cn(
                    "w-full flex items-start gap-3 rounded-lg border p-2.5 text-left",
                    i.done ? "border-primary/40 bg-primary/5" : "border-border",
                  )}
                >
                  <span
                    className={cn(
                      "shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                      i.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {i.done ? <Check className="w-3.5 h-3.5" /> : i.n}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{i.label}</span>
                    <span className="block text-xs text-muted-foreground">{i.hint}</span>
                  </span>
                </button>
              ))}
              <Button variant="outline" size="sm" className="w-full" onClick={() => setShowEnd(true)}>
                Encerrar demonstração
              </Button>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showEnd} onOpenChange={setShowEnd}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PartyPopper className="w-5 h-5 text-primary" />
              Gostou do Relatto?
            </DialogTitle>
            <DialogDescription>
              Fale com a gente para assinar e usar o Relatto com a sua marca, sem limites e com seus
              dados salvos para sempre.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <a href={CONTATO_WHATSAPP} target="_blank" rel="noopener noreferrer" className="block">
              <Button className="w-full">Falar com a equipe</Button>
            </a>
            <Button variant="ghost" className="w-full" onClick={() => setShowEnd(false)}>
              Continuar explorando
            </Button>
            <Button variant="outline" className="w-full" onClick={() => void encerrar()}>
              Sair da demonstração
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground text-center">
            Os dados criados nesta demonstração são apagados automaticamente após 24 horas.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
