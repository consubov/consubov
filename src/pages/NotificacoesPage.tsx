import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bell, Check, Eye } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string | null;
  dados: Record<string, string> | null;
  lida: boolean;
  criado_em: string;
}

export default function NotificacoesPage() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Notificacao | null>(null);

  const fetchNotificacoes = async () => {
    const { data } = await supabase
      .from("notificacoes")
      .select("*")
      .order("criado_em", { ascending: false });
    setNotificacoes((data as Notificacao[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchNotificacoes(); }, []);

  const marcarLida = async (id: string) => {
    await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
    setNotificacoes((prev) => prev.map((n) => n.id === id ? { ...n, lida: true } : n));
  };

  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Notificações</h1>
          {naoLidas > 0 && <Badge variant="destructive">{naoLidas} nova{naoLidas > 1 ? "s" : ""}</Badge>}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Leads recebidos</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : notificacoes.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma notificação encontrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="hidden md:table-cell">E-mail</TableHead>
                    <TableHead className="hidden md:table-cell">Telefone</TableHead>
                    <TableHead className="hidden lg:table-cell">WhatsApp</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notificacoes.map((n) => (
                    <TableRow key={n.id} className={!n.lida ? "bg-primary/5" : ""}>
                      <TableCell>
                        <Badge variant={n.lida ? "secondary" : "default"} className="text-xs">
                          {n.lida ? "Lida" : "Nova"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{n.dados?.nome || n.titulo}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{n.dados?.email || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{n.dados?.telefone || "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">{n.dados?.whatsapp || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(n.criado_em), "dd/MM/yy HH:mm")}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setSelected(n)} title="Ver detalhes">
                            <Eye className="w-4 h-4" />
                          </Button>
                          {!n.lida && (
                            <Button size="icon" variant="ghost" onClick={() => marcarLida(n.id)} title="Marcar como lida">
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes do Lead</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div><strong>Nome:</strong> {selected.dados?.nome}</div>
              <div><strong>E-mail:</strong> {selected.dados?.email}</div>
              <div><strong>Telefone:</strong> {selected.dados?.telefone}</div>
              <div><strong>WhatsApp:</strong> {selected.dados?.whatsapp}</div>
              <div><strong>Mensagem:</strong> {selected.dados?.mensagem || "Sem mensagem"}</div>
              <div><strong>Data:</strong> {format(new Date(selected.criado_em), "dd/MM/yyyy HH:mm:ss")}</div>
              {!selected.lida && (
                <Button size="sm" onClick={() => { marcarLida(selected.id); setSelected({ ...selected, lida: true }); }}>
                  Marcar como lida
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
