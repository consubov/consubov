import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LogOut, Plus, TreePine } from "lucide-react";

export default function CapatazDashboard() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center">
            <span className="text-lg font-extrabold text-secondary-foreground">C</span>
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Consubov</h1>
            <p className="text-xs opacity-80">Painel do Capataz</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={signOut} className="text-primary-foreground hover:bg-primary/80">
          <LogOut className="w-5 h-5" />
        </Button>
      </header>

      <main className="px-4 py-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-foreground">Meus Pastos</h2>
          <Button size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" />
            Novo Lançamento
          </Button>
        </div>

        <Card>
          <CardContent className="p-8 text-center">
            <TreePine className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              O perfil de capataz requer uma tabela dedicada no banco de dados para funcionar.
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              Entre em contato com o administrador para configurar seu acesso.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
