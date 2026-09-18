import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { adminApi } from "../lib/api/queries";
import { isSupabaseConfigured } from "../lib/api/supabase-client";
import { signInWithPassword, signUp } from "../lib/auth/session";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Entrar — Stayo Admin" }],
  }),
  component: LoginPage,
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
            Stayo Admin
          </span>
        </div>
        <div className="rounded-[var(--radius-card)] border p-6" style={surface}>
          {children}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
        style={{ ...surface, color: "var(--stayo-ink)" }}
      />
    </label>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [bootstrapMessage, setBootstrapMessage] = useState<string | null>(null);

  const login = useMutation({
    mutationFn: () => signInWithPassword(email, password),
    onSuccess: async (session) => {
      await adminApi.audit.log({
        actorId: session.user.id,
        event: "auth.login",
        entityType: "admin_profile",
        entityId: session.user.id,
        metadata: {},
      });
      void navigate({ to: "/" });
    },
  });

  const signup = useMutation({
    mutationFn: () => signUp(email, password, fullName),
    onSuccess: ({ session, bootstrapped }) => {
      if (bootstrapped && session) {
        void navigate({ to: "/" });
        return;
      }
      setBootstrapMessage(
        "Sua conta foi criada, mas precisa ser liberada por um administrador existente antes de acessar o Admin.",
      );
    },
  });

  if (!isSupabaseConfigured()) {
    return (
      <Shell>
        <h1 className="text-lg" style={{ fontFamily: "var(--stayo-font-display)" }}>
          Autenticação não configurada
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          Sem um projeto Supabase configurado (VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY), o
          Admin roda sem login, sobre o adapter local — esta tela não deveria ter sido acessada.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="mb-1 text-lg" style={{ fontFamily: "var(--stayo-font-display)" }}>
        {mode === "login" ? "Entrar" : "Criar o primeiro acesso"}
      </h1>
      <p className="mb-4 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
        {mode === "login"
          ? "Acesso restrito ao time interno Stayo."
          : "Só funciona se ainda não existir nenhum administrador cadastrado."}
      </p>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (mode === "login") login.mutate();
          else signup.mutate();
        }}
      >
        {mode === "signup" && (
          <Field label="Nome completo" value={fullName} onChange={setFullName} />
        )}
        <Field label="E-mail" type="email" value={email} onChange={setEmail} />
        <Field label="Senha" type="password" value={password} onChange={setPassword} />

        {(login.isError || signup.isError) && (
          <p className="text-sm" style={{ color: "var(--stayo-danger)" }} role="alert">
            {mode === "login"
              ? "E-mail ou senha incorretos."
              : "Não foi possível criar a conta. Tente novamente."}
          </p>
        )}
        {bootstrapMessage && (
          <p className="text-sm" style={{ color: "var(--stayo-warning)" }} role="status">
            {bootstrapMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={login.isPending || signup.isPending}
          className="mt-1 rounded-[var(--radius-control)] px-4 py-2.5 text-sm disabled:opacity-60"
          style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
        >
          {mode === "login"
            ? login.isPending
              ? "Entrando..."
              : "Entrar"
            : signup.isPending
              ? "Criando..."
              : "Criar conta"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "login" ? "signup" : "login");
          setBootstrapMessage(null);
        }}
        className="mt-4 text-xs underline"
        style={{ color: "var(--stayo-ink-muted)" }}
      >
        {mode === "login" ? "Primeiro acesso? Criar o administrador inicial" : "Já tenho uma conta"}
      </button>
    </Shell>
  );
}
