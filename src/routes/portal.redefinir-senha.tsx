import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CircleCheckBig, KeyRound, LockKeyhole, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { PortalShell } from "../components/portal/PortalExperience";
import { Button } from "../components/ui/button";
import { getSupabaseBrowserClient } from "../lib/api/supabase-client";
import { isSupabaseConfigured } from "../lib/auth/owner-session";

export const Route = createFileRoute("/portal/redefinir-senha")({
  head: () => ({
    meta: [{ title: "Definir nova senha — Portal do Proprietário Stayo" }],
  }),
  component: OwnerResetPasswordPage,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell width="compact" footer="Seu imóvel e cada novidade, sempre por perto.">
      <div className="p-6 sm:p-8">{children}</div>
    </PortalShell>
  );
}

type ResetStage = "checking" | "ready" | "invalid" | "done";

function OwnerResetPasswordPage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<ResetStage>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;

    // O link do e-mail chega com #type=recovery; o cliente troca o código e
    // emite PASSWORD_RECOVERY quando a sessão de recuperação está ativa.
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) setStage("ready");

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setStage("ready");
    });

    // Se nada acontecer em alguns segundos, o link é inválido ou expirou.
    const timeout = window.setTimeout(() => {
      setStage((current) => (current === "checking" ? "invalid" : current));
    }, 4000);

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  const save = useMutation({
    mutationFn: async (newPassword: string) => {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("Supabase não configurado");
      // Sessão de recuperação: não enviar current_password.
      const { error } = await client.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    onSuccess: () => {
      setStage("done");
      window.setTimeout(() => void navigate({ to: "/portal/inicio" }), 1800);
    },
  });

  if (!isSupabaseConfigured()) {
    return (
      <Shell>
        <h1 className="text-xl" style={{ fontFamily: "var(--stayo-font-display)" }}>
          Entre pelo seu link de acesso
        </h1>
        <p className="mt-3 text-sm leading-6" style={{ color: "var(--stayo-ink-muted)" }}>
          Por enquanto, use o link enviado pela equipe Stayo.
        </p>
      </Shell>
    );
  }

  if (stage === "checking") {
    return (
      <Shell>
        <p className="text-sm text-[var(--portal-muted)]">Confirmando seu link de acesso...</p>
      </Shell>
    );
  }

  if (stage === "invalid") {
    return (
      <Shell>
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--portal-gold-soft)] text-[var(--portal-gold)]">
            <TriangleAlert className="h-6 w-6" />
          </div>
          <h1
            className="text-2xl text-[var(--portal-navy)]"
            style={{ fontFamily: "var(--stayo-font-display)" }}
          >
            Este link expirou
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--portal-muted)]">
            Por segurança, o link de recuperação vale por tempo limitado. Peça um novo para definir
            sua senha.
          </p>
          <Link to="/portal/recuperar">
            <Button className="portal-action mt-6 h-12 w-full rounded-xl bg-[var(--portal-navy)] text-[var(--portal-hero-foreground)] hover:bg-[var(--portal-navy-strong)]">
              Pedir novo link
            </Button>
          </Link>
        </div>
      </Shell>
    );
  }

  if (stage === "done") {
    return (
      <Shell>
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--portal-gold-soft)] text-[var(--portal-gold)]">
            <CircleCheckBig className="h-6 w-6" />
          </div>
          <h1
            className="text-2xl text-[var(--portal-navy)]"
            style={{ fontFamily: "var(--stayo-font-display)" }}
          >
            Senha atualizada
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--portal-muted)]">
            Tudo certo. Estamos abrindo o seu portal com o novo acesso.
          </p>
        </div>
      </Shell>
    );
  }

  const mismatch = confirm.length > 0 && password !== confirm;
  const tooShort = password.length > 0 && password.length < 6;

  return (
    <Shell>
      <div className="mb-7">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--portal-gold-soft)] text-[var(--portal-gold)]">
          <KeyRound className="h-5 w-5" />
        </div>
        <h1
          className="text-3xl text-[var(--portal-navy)]"
          style={{ fontFamily: "var(--stayo-font-display)" }}
        >
          Defina sua nova senha
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--portal-muted)]">
          Escolha uma senha com pelo menos 6 caracteres. Você a usará para entrar no portal.
        </p>
      </div>
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (mismatch || password.length < 6) return;
          save.mutate(password);
        }}
      >
        <label className="block text-sm">
          <span
            className="mb-2 block text-xs font-medium"
            style={{ color: "var(--stayo-ink-muted)" }}
          >
            Nova senha
          </span>
          <span className="relative block">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--portal-muted)]" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="portal-input w-full rounded-xl px-10 py-3 text-sm"
            />
          </span>
        </label>
        <label className="block text-sm">
          <span
            className="mb-2 block text-xs font-medium"
            style={{ color: "var(--stayo-ink-muted)" }}
          >
            Repita a nova senha
          </span>
          <span className="relative block">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--portal-muted)]" />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              className="portal-input w-full rounded-xl px-10 py-3 text-sm"
            />
          </span>
        </label>
        {tooShort && (
          <p className="text-xs" style={{ color: "var(--stayo-danger)" }}>
            A senha precisa ter pelo menos 6 caracteres.
          </p>
        )}
        {mismatch && (
          <p className="text-xs" style={{ color: "var(--stayo-danger)" }}>
            As senhas não coincidem.
          </p>
        )}
        {save.isError && (
          <p
            className="rounded-xl border px-3 py-2.5 text-sm"
            style={{
              borderColor: "color-mix(in srgb, var(--stayo-danger) 25%, transparent)",
              backgroundColor: "color-mix(in srgb, var(--stayo-danger) 7%, transparent)",
              color: "var(--stayo-danger)",
            }}
            role="alert"
          >
            Não foi possível salvar a nova senha. Tente novamente em instantes.
          </p>
        )}
        <Button
          type="submit"
          disabled={save.isPending || mismatch || password.length < 6}
          className="portal-action mt-1 h-12 w-full rounded-xl bg-[var(--portal-navy)] text-[var(--portal-hero-foreground)] hover:bg-[var(--portal-navy-strong)]"
        >
          {save.isPending ? "Salvando..." : "Salvar nova senha"}
        </Button>
      </form>
    </Shell>
  );
}
