import { LocalizedText, useStaticUiText } from "@/components/i18n/LocalizedText";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bell, Check, Eye, Plus } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MODULOS_AVISO, type ModuloAviso } from "@/lib/avisosModulo";
import { toast } from "sonner";

interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string | null;
  dados: Record<string, string> | null;
  lida: boolean;
  criado_em: string;
  modulo: ModuloAviso | null;
}

const MODULO_LABEL: Record<string, string> = {
  geral: "Geral",
  consubov: "Consubov",
  relatto: "Relatto",
  mais_arrobas: "Mais Arrobas",
};

export default function NotificacoesPage() {
  const uiText = useStaticUiText();
  const { language } = useTranslation();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Notificacao | null>(null);

  // Criação de aviso
  const [novoOpen, setNovoOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [modulo, setModulo] = useState<ModuloAviso>("geral");
  const [salvando, setSalvando] = useState(false);

  const fetchNotificacoes = async () => {
    // Eventos de plataforma (lead e aviso manual) — visíveis somente para o Admin.
    // Eventos internos da fazenda pertencem a Gerente/Capataz e não aparecem aqui.
    const { data } = await supabase
      .from("notificacoes")
      .select("*")
      .in("tipo", ["lead", "aviso"])
      .order("criado_em", { ascending: false });
    setNotificacoes((data as Notificacao[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchNotificacoes(); }, []);

  const marcarLida = async (id: string) => {
    await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
    setNotificacoes((prev) => prev.map((n) => n.id === id ? { ...n, lida: true } : n));
  };

  const criarAviso = async () => {
    if (!titulo.trim()) { toast.error(uiText("Informe o título do aviso.")); return; }
    setSalvando(true);
    const { error } = await supabase.from("notificacoes").insert({
      tipo: "aviso",
      titulo: titulo.trim(),
      mensagem: mensagem.trim() || null,
      modulo,
    });
    setSalvando(false);
    if (error) { toast.error(uiText("Não foi possível criar o aviso.")); return; }
    toast.success(uiText("Aviso publicado."));
    setTitulo(""); setMensagem(""); setModulo("geral"); setNovoOpen(false);
    fetchNotificacoes();
  };

  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Bell className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground"><LocalizedText source={"Notificações"} /></h1>
          {naoLidas > 0 && <Badge variant="destructive">{naoLidas} {uiText(naoLidas === 1 ? "nova" : "novas")}</Badge>}
        </div>
        <Button size="sm" onClick={() => setNovoOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> <LocalizedText source={"Novo aviso"} /></Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg"><LocalizedText source={"Leads recebidos"} /></CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm"><LocalizedText source={"Carregando..."} /></p>
          ) : notificacoes.length === 0 ? (
            <p className="text-muted-foreground text-sm"><LocalizedText source={"Nenhuma notificação encontrada."} /></p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead><LocalizedText source={"Módulo"} /></TableHead>
                    <TableHead><LocalizedText source={"Nome"} /></TableHead>
                    <TableHead className="hidden md:table-cell"><LocalizedText source={"E-mail"} /></TableHead>
                    <TableHead className="hidden md:table-cell"><LocalizedText source={"Telefone"} /></TableHead>
                    <TableHead className="hidden lg:table-cell">WhatsApp</TableHead>
                    <TableHead><LocalizedText source={"Data"} /></TableHead>
                    <TableHead><LocalizedText source={"Ações"} /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notificacoes.map((n) => (
                    <TableRow key={n.id} className={!n.lida ? "bg-primary/5" : ""}>
                      <TableCell>
                        <Badge variant={n.lida ? "secondary" : "default"} className="text-xs">
                          {uiText(n.lida ? "Lida" : "Nova")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {uiText(MODULO_LABEL[n.modulo ?? "geral"] ?? "Geral")}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{n.dados?.nome || n.titulo}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{n.dados?.email || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{n.dados?.telefone || "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">{n.dados?.whatsapp || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(n.criado_em).toLocaleString(language, { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setSelected(n)} title={uiText("Ver detalhes")}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {!n.lida && (
                            <Button size="icon" variant="ghost" onClick={() => marcarLida(n.id)} title={uiText("Marcar como lida")}>
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

      {/* Novo aviso */}
      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle><LocalizedText source={"Novo aviso de atualização"} /></DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="aviso-titulo"><LocalizedText source={"Título"} /></Label>
              <Input id="aviso-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={uiText("Ex.: Novidades da versão")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aviso-mensagem"><LocalizedText source={"Mensagem"} /></Label>
              <Textarea id="aviso-mensagem" value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={4} />
            </div>
            <div className="space-y-1.5">
              <Label><LocalizedText source={"Módulo"} /></Label>
              <Select value={modulo} onValueChange={(v) => setModulo(v as ModuloAviso)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODULOS_AVISO.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{uiText(m.label)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                <LocalizedText source={"Somente usuários do módulo escolhido verão este aviso. \"Geral\" aparece para todos."} /></p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNovoOpen(false)}><LocalizedText source={"Cancelar"} /></Button>
            <Button onClick={criarAviso} disabled={salvando}>{uiText(salvando ? "Publicando..." : "Publicar")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle><LocalizedText source={"Detalhes do Lead"} /></DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div><strong><LocalizedText source={"Módulo:"} /></strong> {uiText(MODULO_LABEL[selected.modulo ?? "geral"] ?? "Geral")}</div>
              <div><strong><LocalizedText source={"Nome:"} /></strong> {selected.dados?.nome}</div>
              <div><strong>E-mail:</strong> {selected.dados?.email}</div>
              <div><strong><LocalizedText source={"Telefone:"} /></strong> {selected.dados?.telefone}</div>
              <div><strong>WhatsApp:</strong> {selected.dados?.whatsapp}</div>
              <div><strong><LocalizedText source={"Mensagem:"} /></strong> {selected.dados?.mensagem || selected.mensagem || uiText("Sem mensagem")}</div>
              <div><strong><LocalizedText source={"Data:"} /></strong> {new Date(selected.criado_em).toLocaleString(language, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>
              {!selected.lida && (
                <Button size="sm" onClick={() => { marcarLida(selected.id); setSelected({ ...selected, lida: true }); }}>
                  <LocalizedText source={"Marcar como lida"} /></Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
