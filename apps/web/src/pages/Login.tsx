import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import logoConsubov from "@/assets/logo-consubov.jpeg";

export default function Login() {
  // Guarda SOMENTE o e-mail no aparelho. A senha nunca é armazenada pelo app.
  const REMEMBER_KEY = "consubov_lembrar_email";
  const [email, setEmail] = useState(() => {
    try { return localStorage.getItem(REMEMBER_KEY) ?? ""; } catch { return ""; }
  });
  const [lembrarEmail, setLembrarEmail] = useState(() => {
    try { return !!localStorage.getItem(REMEMBER_KEY); } catch { return false; }
  });
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const location = useLocation();
  const passwordReset = Boolean((location.state as { passwordReset?: boolean } | null)?.passwordReset);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await signIn(email, password);
    if (error) {
      setError("Email ou senha inválidos.");
      setLoading(false);
      return;
    }
    try {
      if (lembrarEmail) localStorage.setItem(REMEMBER_KEY, email.trim());
      else localStorage.removeItem(REMEMBER_KEY);
    } catch { /* armazenamento indisponível */ }
    // redirect is handled by App.tsx based on role
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary px-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center pb-2 pt-8">
          <div className="flex flex-col items-center gap-2">
            <div className="w-20 h-20 rounded-xl overflow-hidden mb-2">
              <img src={logoConsubov} alt="Consubov" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Consubov</h1>
            <p className="text-sm text-muted-foreground">Sistema de Gestão Pecuária</p>
          </div>
        </CardHeader>
        <CardContent className="pt-4 pb-8 px-8">
          {passwordReset && (
            <p className="mb-4 rounded-md bg-muted px-3 py-2 text-sm text-foreground" role="status">
              Senha atualizada. Entre novamente com a nova senha.
            </p>
          )}
          <form onSubmit={handleSubmit} className="space-y-5" method="post" action="#" autoComplete="on">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <PasswordInput
                id="password"
                name="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="lembrar-email"
                checked={lembrarEmail}
                onCheckedChange={(v) => setLembrarEmail(v === true)}
              />
              <Label htmlFor="lembrar-email" className="text-sm font-normal cursor-pointer">
                Lembrar meu e-mail
              </Label>
            </div>
            <div className="text-right">
              <Link
                to="/recuperar-senha"
                className="text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                Esqueci minha senha
              </Link>
            </div>
            {error && (
              <p className="text-sm text-destructive font-medium">{error}</p>
            )}
            <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}