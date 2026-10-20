import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Mail, MailCheck } from "lucide-react";
import { useState } from "react";

import { PortalShell } from "../components/portal/PortalExperience";
import { Button } from "../components/ui/button";
import { getSupabaseBrowserClient } from "../lib/api/supabase-client";
import { isSupabaseConfigured } from "../lib/auth/owner-session";

export const Route = createFileRoute("/portal/recuperar")({
  head: () => ({
    meta: [{ title: "Recuperar acesso — Portal do Proprietário Stayo" }],
  }),
  component: OwnerRecoverPage,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell width="compact" footer="Seu imóvel e cada novidade, sempre por perto.">
      <div className="p-6 sm:p-8">{children}</div>
    </PortalShell>
  );
}

function OwnerRecoverPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const recover = useMutation({
    mutationFn: async (targetEmail: string) => {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("Supabase não configurado");
      // Mesma resposta para e-mail existente ou não: nunca revelar se a conta existe.
      await client.auth.resetPasswordForEmail(targetEmail.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/portal/redefinir-senha`,
      });
    },
    onSettled: () => setSent(true),
  });

  if (!isSupabaseConfigured()) {
    return (
      <Shell>
        <h1 className="text-xl" style={{ fontFamily: "var(--stayo-font-display)" }}>
          Entre pelo seu link de acesso
        </h1>
        <p className="mt-3 text-sm leading-6" style={{ color: "var(--stayo-ink-muted)" }}>
          Por enquanto, use o link enviado pela equipe Stayo. Ele leva você com segurança até o seu
          portal.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      {sent ? (
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--portal-gold-soft)] text-[var(--portal-gold)]">
            <MailCheck className="h-6 w-6" />
          </div>
          <h1
            className="text-2xl text-[var(--portal-navy)]"
            style={{ fontFamily: "var(--stayo-font-display)" }}
          >
            Verifique seu e-mail
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--portal-muted)]">
            Se este e-mail estiver cadastrado no portal, você receberá em instantes um link para
            criar uma nova senha. O link vale por tempo limitado.
          </p>
          <Link
            to="/portal/login"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[var(--portal-navy)] underline"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar para o login
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-7">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--portal-gold-soft)] text-[var(--portal-gold)]">
              <Mail className="h-5 w-5" />
            </div>
            <h1
              className="text-3xl text-[var(--portal-navy)]"
              style={{ fontFamily: "var(--stayo-font-display)" }}
            >
              Recuperar acesso
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--portal-muted)]">
              Informe o e-mail do seu cadastro. Enviaremos um link seguro para você definir uma nova
              senha.
            </p>
          </div>
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              recover.mutate(email);
            }}
          >
            <label className="block text-sm">
              <span
                className="mb-2 block text-xs font-medium"
                style={{ color: "var(--stayo-ink-muted)" }}
              >
                E-mail
              </span>
              <span className="relative block">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--portal-muted)]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="portal-input w-full rounded-xl px-10 py-3 text-sm placeholder:text-[var(--portal-muted)]/60"
                  placeholder="voce@exemplo.com"
                />
              </span>
            </label>
            <Button
              type="submit"
              disabled={recover.isPending}
              className="portal-action mt-1 h-12 w-full rounded-xl bg-[var(--portal-navy)] text-[var(--portal-hero-foreground)] hover:bg-[var(--portal-navy-strong)]"
            >
              {recover.isPending ? "Enviando..." : "Enviar link de recuperação"}
            </Button>
            <Link
              to="/portal/login"
              className="inline-flex items-center justify-center gap-2 text-xs text-[var(--portal-muted)] underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar para o login
            </Link>
          </form>
        </>
      )}
    </Shell>
  );
}
