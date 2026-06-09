import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Mail, Lock, LogIn } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { Card, PageTitle } from "@/components/primitives";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — LevelUp" }] }),
  component: Auth,
});

function Auth() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/voce" });
  }, [loading, user, navigate]);

  async function handleGoogle() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast("Falha no login com Google", { description: result.error.message });
        return;
      }
      if (result.redirected) return; // browser is redirecting
      toast("Conectado!", { description: "Seus dados estão sincronizando." });
      navigate({ to: "/voce" });
    } finally {
      setBusy(false);
    }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast("Preencha e-mail e senha");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) {
          toast("Não foi possível criar a conta", { description: error.message });
          return;
        }
        toast("Conta criada!", { description: "Verifique seu e-mail se for solicitado." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          toast("Não foi possível entrar", { description: error.message });
          return;
        }
        toast("Bem-vindo de volta!", { description: "Sincronizando seus dados." });
      }
      navigate({ to: "/voce" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="px-4 pt-6">
      <Link to="/voce" className="no-tap mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <PageTitle title="Entrar" subtitle="Sincronize seus dados em todos os aparelhos." />

      <Card className="space-y-4">
        <button
          onClick={handleGoogle}
          disabled={busy}
          className="no-tap flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background py-3 text-sm font-bold disabled:opacity-60"
        >
          <GoogleIcon /> Continuar com Google
        </button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">ou</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          <label className="flex items-center gap-2 rounded-xl border border-input bg-background px-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full bg-transparent py-2.5 text-sm outline-none"
            />
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-input bg-background px-3">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <input
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha"
              className="w-full bg-transparent py-2.5 text-sm outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="no-tap flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" />
            {mode === "signup" ? "Criar conta" : "Entrar"}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          {mode === "signup" ? "Já tem conta?" : "Ainda não tem conta?"}{" "}
          <button
            onClick={() => setMode(mode === "signup" ? "login" : "signup")}
            className="no-tap font-semibold text-primary"
          >
            {mode === "signup" ? "Entrar" : "Criar conta"}
          </button>
        </p>
      </Card>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        O login é opcional. Sem entrar, o app continua funcionando neste aparelho.
      </p>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  );
}
