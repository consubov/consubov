import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Bell } from "lucide-react";

interface Notif {
  id: string; titulo: string; mensagem: string | null;
  criado_em: string; lida: boolean; tipo: string;
  dados: any;
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "agora";
  const m = Math.floor(s / 60); if (m < 60) return `${m} min atrás`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} h atrás`;
  const d = Math.floor(h / 24); return `${d} d atrás`;
}

export default function FabricaNotificacoesBell({ fabricaId }: { fabricaId: string }) {
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  async function load() {
    // Notificações cujo dados->>fabrica_id corresponde a esta fábrica
    const { data } = await supabase.from("notificacoes")
      .select("id, titulo, mensagem, criado_em, lida, tipo, dados")
      .contains("dados", { fabrica_id: fabricaId })
      .order("criado_em", { ascending: false })
      .limit(20);
    setItems((data as Notif[]) || []);
  }

  useEffect(() => {
    load();
    const ch = supabase.channel(`notif-fab-${fabricaId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notificacoes" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fabricaId]);

  const naoLidas = items.filter(n => !n.lida).length;

  async function handleOpenChange(o: boolean) {
    setOpen(o);
    if (o && naoLidas > 0) {
      const ids = items.filter(n => !n.lida).map(n => n.id);
      await supabase.from("notificacoes").update({ lida: true }).in("id", ids);
      setItems(prev => prev.map(n => ({ ...n, lida: true })));
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-primary-foreground hover:bg-primary/80">
          <Bell className="w-5 h-5" />
          {naoLidas > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-destructive text-white text-[10px] font-bold rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="p-3 border-b flex items-center justify-between">
          <h4 className="font-semibold text-sm">Notificações</h4>
          {items.length > 0 && <Badge variant="secondary" className="text-xs">{items.length}</Badge>}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma notificação</div>
          ) : items.map(n => (
            <div key={n.id} className="p-3 border-b last:border-0 hover:bg-muted/40">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium leading-tight">{n.titulo}</p>
                <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(n.criado_em)}</span>
              </div>
              {n.mensagem && <p className="text-xs text-muted-foreground mt-1">{n.mensagem}</p>}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
