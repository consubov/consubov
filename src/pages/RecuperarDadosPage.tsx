import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import type { PendingBackup } from "@/lib/backupMirror";
import SyncCapatazPanel from "@/components/sync/SyncCapatazPanel";

export default function RecuperarDadosPage() {
  const [importing, setImporting] = useState(false);

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as PendingBackup;
      if (!data || typeof data !== "object") throw new Error("Formato inválido");

      let imported = 0;
      let failed = 0;

      for (const l of data.lancamentos ?? []) {
        try {
          const insertData: any = {
            id: l.id,
            pasto_id: l.pasto_id,
            num_sacos: l.sacos ?? 0,
            cocho_cheio: !!l.cocho_cheio,
            ciclo_id: l.ciclo_id ?? null,
            origem: l.tipo === "falha_qr" ? "manual" : "qr_code",
          };
          if (!insertData.pasto_id) { failed++; continue; }
          const { error } = await supabase.from("lancamentos").upsert(insertData, { onConflict: "id" });
          if (error) failed++; else imported++;
        } catch { failed++; }
      }

      for (const o of data.observacoes ?? []) {
        try {
          const { error } = await supabase.from("observacoes").upsert({
            id: o.id,
            pasto_id: o.pasto_id,
            retiro_id: o.retiro_id,
            fazenda_id: o.fazenda_id,
            capataz_nome: o.capataz_nome,
            tipo: o.tipo,
            descricao: o.descricao,
            foto_url: o.foto_url,
            criado_em: o.criado_em,
          } as any, { onConflict: "id" });
          if (error) failed++; else imported++;
        } catch { failed++; }
      }

      toast.success(`Importação concluída: ${imported} sucesso(s), ${failed} falha(s)`);
    } catch (err: any) {
      toast.error("Falha ao importar JSON: " + (err?.message ?? "desconhecido"));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-foreground">Recuperar Dados</h1>
        <label className="inline-flex">
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImport(f);
              e.currentTarget.value = "";
            }}
          />
          <Button asChild variant="default" size="sm" disabled={importing}>
            <span>
              {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Importar JSON de emergência
            </span>
          </Button>
        </label>
      </div>

      <SyncCapatazPanel title="Sincronização dos Capatazes" />

      <Card>
        <CardHeader><CardTitle className="text-base">Como funciona</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Os dados de cada capataz são reportados automaticamente após cada tentativa de sincronização.
            Use "Importar JSON de emergência" se um capataz enviar manualmente o backup exportado pelo PWA.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
