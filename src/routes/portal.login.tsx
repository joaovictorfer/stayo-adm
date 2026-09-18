import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { isSupabaseConfigured, ownerSignInWithPassword } from "../lib/auth/owner-session";

export const Route = createFileRoute("/portal/login")({
  head: () => ({
    meta: [{ title: "Entrar — Portal do Proprietário Stayo" }],
  }),
  component: OwnerLoginPage,
});

const surface = { backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{
        backgroundColor: "var(--stayo-bg)",
        color: "var(--stayo-ink)",
        fontFamily: "var(--stayo-font-ui)",
      }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-sm"
            style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
          >
            S
          </span>
          <span className="text-base" style={{ fontFamily: "var(--stayo-font-display)" }}>
            Stayo
          </span>
        </div>
        <div className="rounded-[var(--radius-card)] border p-6" style={surface}>
          {children}
        </div>
      </div>
    </div>
  );
}

function OwnerLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = useMutation({
    mutationFn: () => ownerSignInWithPassword(email, password),
    onSuccess: () => void navigate({ to: "/portal/inicio" }),
  });

  if (!isSupabaseConfigured()) {
    return (
      <Shell>
        <h1 className="text-lg" style={{ fontFamily: "var(--stayo-font-display)" }}>
          Login não disponível
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          Sem um projeto Supabase configurado, o acesso continua sendo só pelo link recebido por
          WhatsApp/e-mail.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="mb-1 text-lg" style={{ fontFamily: "var(--stayo-font-display)" }}>
        Entrar
      </h1>
      <p className="mb-4 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
        Acompanhe a implantação do seu imóvel.
      </p>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          login.mutate();
        }}
      >
        <label className="block text-sm">
          <span className="mb-1 block text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
            E-mail
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
            style={{ ...surface, color: "var(--stayo-ink)" }}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
            Senha
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
            style={{ ...surface, color: "var(--stayo-ink)" }}
          />
        </label>

        {login.isError && (
          <p className="text-sm" style={{ color: "var(--stayo-danger)" }} role="alert">
            E-mail ou senha incorretos.
          </p>
        )}

        <button
          type="submit"
          disabled={login.isPending}
          className="mt-1 rounded-[var(--radius-control)] px-4 py-2.5 text-sm disabled:opacity-60"
          style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
        >
          {login.isPending ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </Shell>
  );
}
