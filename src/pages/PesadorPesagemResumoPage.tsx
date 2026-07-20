import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight } from "lucide-react";
import {
  calcularAnimais,
  totalizar,
  type PesagemCompraCfg,
  type PesoAnimal,
} from "@/lib/pesagemCompra";

export default function PesadorPesagemResumoPage() {
  const { pesagemId } = useParams<{ pesagemId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState<PesagemCompraCfg | null>(null);
  const [clienteNome, setClienteNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [pesos, setPesos] = useState<PesoAnimal[]>([]);

  useEffect(() => {
    (async () => {
      if (!pesagemId) return;
      const { data: p } = await supabase
        .from("pesagens_compra")
        .select("cliente_id, categoria, tipo_preco, preco_valor, modo_percentual, percentual_fixo")
        .eq("id", pesagemId)
        .maybeSingle();
      if (p) {
        setCfg({
          tipo_preco: p.tipo_preco as any,
          preco_valor: Number(p.preco_valor),
          modo_percentual: p.modo_percentual as any,
          percentual_fixo: p.percentual_fixo != null ? Number(p.percentual_fixo) : null,
        });
        setCategoria(p.categoria);
        const { data: c } = await supabase
          .from("clientes_pesador")
          .select("nome")
          .eq("id", p.cliente_id)
          .maybeSingle();
        setClienteNome((c?.nome as string) ?? "");
      }
      const { data: ps } = await supabase
        .from("pesos_pesagem_compra")
        .select("ordem, peso_kg, percentual_individual")
        .eq("pesagem_id", pesagemId)
        .order("ordem", { ascending: true });
      setPesos(
        (ps ?? []).map((x: any) => ({
          ordem: x.ordem,
          peso_kg: Number(x.peso_kg),
          percentual_individual:
            x.percentual_individual != null ? Number(x.percentual_individual) : null,
        }))
      );
      setLoading(false);
    })();
  }, [pesagemId]);

  if (loading || !cfg) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
      </div>
    );
  }

  const animais = calcularAnimais(cfg, pesos);
  const tot = totalizar(animais);
  const brl = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-4 pb-24">
      <div className="rounded-lg border bg-card p-4">
        <div className="text-xs uppercase text-muted-foreground">Pesagem finalizada</div>
        <div className="text-lg font-semibold">{clienteNome}</div>
        <div className="text-xs text-muted-foreground">
          {categoria} •{" "}
          {cfg.tipo_preco === "arroba"
            ? `@ ${brl(cfg.preco_valor)}`
            : cfg.tipo_preco === "kg"
            ? `kg ${brl(cfg.preco_valor)}`
            : `Fixo ${brl(cfg.preco_valor)}/animal`}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="text-xs text-muted-foreground">Animais</div>
          <div className="text-xl font-bold">{tot.totalAnimais}</div>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="text-xs text-muted-foreground">Peso médio</div>
          <div className="text-xl font-bold">{tot.mediaPeso.toString().replace(".", ",")} kg</div>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="text-xs text-muted-foreground">Peso total</div>
          <div className="text-xl font-bold">{tot.totalPeso.toString().replace(".", ",")} kg</div>
        </div>
        {cfg.tipo_preco === "arroba" && (
          <div className="rounded-lg border bg-card p-3 text-center">
            <div className="text-xs text-muted-foreground">@ pagáveis</div>
            <div className="text-xl font-bold">{tot.totalArroba.toString().replace(".", ",")}</div>
          </div>
        )}
        <div className="rounded-lg border bg-primary/10 border-primary/30 p-3 text-center col-span-2">
          <div className="text-xs text-muted-foreground">Total a pagar</div>
          <div className="text-2xl font-bold text-primary">{brl(tot.totalValor)}</div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-3">
        <div className="text-xs text-muted-foreground mb-2">Detalhamento</div>
        <div className="max-h-72 overflow-y-auto text-xs space-y-1">
          {animais.map((a) => (
            <div key={a.ordem} className="flex justify-between border-b border-border/40 py-1">
              <span>#{a.ordem}</span>
              <span>
                {a.peso_kg} kg
                {a.percentual_individual != null ? ` • ${a.percentual_individual}%` : ""}
                {" • "}
                {brl(a.valor)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="fixed left-0 right-0 bottom-16 px-4 pb-3 pt-3 bg-background/95 backdrop-blur border-t">
        <Button className="w-full h-12" onClick={() => navigate("/pesador/clientes")}>
          Concluir <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
