import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Lock, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cpfToEmail, formatCpf, onlyDigits } from "@/lib/cpf";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Aurora Comunicação Interna" },
      { name: "description", content: "Acesse a comunicação interna da sua empresa com CPF e senha." },
      { property: "og:title", content: "Entrar — Aurora" },
      { property: "og:description", content: "Acesse com seu CPF e senha." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (onlyDigits(cpf).length !== 11) return setError("Informe um CPF com 11 dígitos.");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: cpfToEmail(cpf), password });
    setLoading(false);
    if (error) {
      setError(error.message.toLowerCase().includes("banned") ? "Usuário desativado." : "CPF ou senha incorretos.");
      return;
    }
    navigate({ to: "/timeline" });
  }

  return (
    <div className="grid min-h-screen bg-sky lg:grid-cols-2">
      <div className="hidden flex-col justify-between p-12 lg:flex">
        <div className="flex items-center gap-2 text-lg font-semibold text-secondary-foreground">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-soft">A</span>
          Aurora
        </div>
        <div className="max-w-md">
          <h1 className="text-5xl leading-tight text-foreground">
            Sua empresa, <em className="text-primary">em sintonia.</em>
          </h1>
          <p className="mt-4 text-muted-foreground">
            Postagens, comunicados, eventos e enquetes reunidos em um só lugar — com leveza.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Aurora</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm animate-rise rounded-3xl bg-card p-8 shadow-lift">
          <h2 className="text-3xl text-foreground">Bem-vindo</h2>
          <p className="mt-1 text-sm text-muted-foreground">Entre com seu CPF e senha.</p>
          <div className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <div className="relative">
                <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="cpf" inputMode="numeric" placeholder="000.000.000-00" className="h-11 pl-9"
                  value={formatCpf(cpf)} onChange={(e) => setCpf(e.target.value)} autoFocus />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="password" type="password" className="h-11 pl-9" value={password}
                  onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="h-11 w-full rounded-xl" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Entrar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
