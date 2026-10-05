import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { requestPasswordRecovery } from "@/features/auth/repositories/authRecoveryRepository";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const redirectTo = `${window.location.origin}/redefinir-senha`;
      const { error: requestError } = await requestPasswordRecovery(email.trim(), redirectTo);
      if (requestError) {
        setError("Não foi possível solicitar a recuperação agora. Tente novamente.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Não foi possível solicitar a recuperação agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary px-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Mail className="h-5 w-5" /> Recuperar senha
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Informe seu e-mail. Se existir uma conta válida, você receberá as instruções de redefinição.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {submitted ? (
            <div className="space-y-4" role="status">
              <p className="text-sm text-foreground">
                Solicitação enviada. Verifique sua caixa de entrada e o spam.
              </p>
              <Button asChild className="w-full">
                <Link to="/login">Voltar ao login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recovery-email">E-mail</Label>
                <Input
                  id="recovery-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm font-medium text-destructive" role="alert">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar instruções"}
              </Button>
            </form>
          )}

          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
