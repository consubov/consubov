import { useEffect, useState } from "react";
import { useLocation, useOutletContext } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";

export default function PecuaristaDashboard() {
  const { nome } = useOutletContext<{ nome: string }>() ?? { nome: "" };
  const location = useLocation();
  const isLotes = location.pathname.endsWith("/lotes");

  const [greeting, setGreeting] = useState("");
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite");
  }, []);

  if (isLotes) {
    return (
      <div className="max-w-5xl mx-auto">
        <Card><CardContent className="py-16 text-center text-muted-foreground">Em breve</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{greeting}{nome ? `, ${nome}` : ""}!</h1>
        <p className="text-sm text-muted-foreground">Bem-vindo ao Mais Arrobas.</p>
      </div>
      <Card><CardContent className="py-16 text-center text-muted-foreground">Em breve: indicadores do seu rebanho.</CardContent></Card>
    </div>
  );
}
