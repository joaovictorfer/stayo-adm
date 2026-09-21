import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";
import { useState } from "react";

import { isSupabaseConfigured, ownerSignInWithPassword } from "../lib/auth/owner-session";

export const Route = createFileRoute("/portal/login")({
  head: () => ({
    meta: [{ title: "Entrar — Portal do Proprietário Stayo" }],
  }),
  component: OwnerLoginPage,
});

const surface = { backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" };

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-semibold shadow-sm" style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}>S</span>
      <div>
        <span className="block text-lg tracking-tight" style={{ fontFamily: "var(--stayo-font-display)" }}>Stayo</span>
        <span className="block text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--stayo-ink-muted)" }}>Portal do proprietário</span>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8" style={{ backgroundColor: "var(--stayo-bg)", color: "var(--stayo-ink)", fontFamily: "var(--stayo-font-ui)" }}>
      <div className="w-full max-w-md">
        <div className="mb-8 px-1"><Brand /></div>
        <main className="rounded-3xl border p-6 shadow-[0_20px_60px_rgba(32,48,40,0.07)] sm:p-8" style={surface}>{children}</main>
        <p className="mt-6 text-center text-xs" style={{ color: "var(--stayo-ink-muted)" }}>Acompanhe seu imóvel com mais clareza e tranquilidade.</p>
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
    return <Shell><h1 className="text-xl" style={{ fontFamily: "var(--stayo-font-display)" }}>Login não disponível</h1><p className="mt-3 text-sm leading-6" style={{ color: "var(--stayo-ink-muted)" }}>O acesso por conta ainda não está disponível. Use o link recebido para continuar.</p></Shell>;
  }

  return (
    <Shell>
      <div className="mb-7">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: "rgba(47, 91, 70, 0.1)", color: "var(--stayo-forest)" }}><LockKeyhole className="h-5 w-5" /></div>
        <h1 className="text-2xl" style={{ fontFamily: "var(--stayo-font-display)" }}>Bem-vindo de volta</h1>
        <p className="mt-2 text-sm leading-6" style={{ color: "var(--stayo-ink-muted)" }}>Entre para acompanhar a implantação do seu imóvel.</p>
      </div>
      <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); login.mutate(); }}>
        <label className="block text-sm">
          <span className="mb-2 block text-xs font-medium" style={{ color: "var(--stayo-ink-muted)" }}>E-mail</span>
          <span className="relative block"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--stayo-ink-muted)" }} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="w-full rounded-xl border px-10 py-3 text-sm outline-none transition placeholder:text-black/30 focus:ring-2" style={{ ...surface, color: "var(--stayo-ink)" }} placeholder="voce@exemplo.com" /></span>
        </label>
        <label className="block text-sm">
          <span className="mb-2 block text-xs font-medium" style={{ color: "var(--stayo-ink-muted)" }}>Senha</span>
          <span className="relative block"><LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--stayo-ink-muted)" }} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" className="w-full rounded-xl border px-10 py-3 text-sm outline-none transition focus:ring-2" style={{ ...surface, color: "var(--stayo-ink)" }} /></span>
        </label>
        {login.isError && <p className="rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: "color-mix(in srgb, var(--stayo-danger) 25%, transparent)", backgroundColor: "color-mix(in srgb, var(--stayo-danger) 7%, transparent)", color: "var(--stayo-danger)" }} role="alert">Não conseguimos entrar com esses dados. Confira seu e-mail e senha e tente novamente.</p>}
        <button type="submit" disabled={login.isPending} className="group mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60" style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}>{login.isPending ? "Entrando..." : <>Entrar <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>}</button>
      </form>
    </Shell>
  );
}
