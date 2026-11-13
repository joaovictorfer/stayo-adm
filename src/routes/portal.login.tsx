import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";
import { useState } from "react";

import { PortalShell } from "../components/portal/PortalExperience";
import { Button } from "../components/ui/button";
import { isSupabaseConfigured, ownerSignInWithPassword } from "../lib/auth/owner-session";

export const Route = createFileRoute("/portal/login")({
  validateSearch: (s: Record<string, unknown>): { returnTo?: string } => ({ returnTo: typeof s['returnTo'] === 'string' && /^\/portal\/imovel\/[a-f0-9]{64}$/.test(s['returnTo']) ? s['returnTo'] : undefined }),
  head: () => ({
    meta: [{ title: "Entrar — Portal do Proprietário Stayo" }, { name: 'description', content: 'Acesse sua conta vinculada para acompanhar seu imóvel e consultar informações protegidas.' }, { property: 'og:title', content: 'Entrar — Portal do Proprietário Stayo' }, { property: 'og:description', content: 'Acesso protegido à conta do proprietário STAYO.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }],
  }),
  component: OwnerLoginPage,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell width="compact" footer="Seu imóvel e cada novidade, sempre por perto.">
      <div className="p-6 sm:p-8">{children}</div>
    </PortalShell>
  );
}

function OwnerLoginPage() {
  const navigate = useNavigate();
  const { returnTo } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = useMutation({
    mutationFn: () => ownerSignInWithPassword(email, password),
    onSuccess: () => {
      const token = returnTo?.split('/').pop();
      if (token) void navigate({ to: '/portal/imovel/$token', params: { token } });
      else void navigate({ to: '/portal/inicio' });
    },
  });

  if (!isSupabaseConfigured()) {
    return <Shell><h1 className="text-xl" style={{ fontFamily: "var(--stayo-font-display)" }}>Entre pelo seu link de acesso</h1><p className="mt-3 text-sm leading-6" style={{ color: "var(--stayo-ink-muted)" }}>Por enquanto, use o link enviado pela equipe Stayo. Ele leva você com segurança até o seu portal.</p></Shell>;
  }

  return (
    <Shell>
      <div className="mb-7">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--portal-gold-soft)] text-[var(--portal-gold)]"><LockKeyhole className="h-5 w-5" /></div>
        <h1 className="text-3xl text-[var(--portal-navy)]" style={{ fontFamily: "var(--stayo-font-display)" }}>Que bom ter você aqui.</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--portal-muted)]">Acompanhe seu imóvel, seus documentos e cada próximo passo.</p>
      </div>
      <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); login.mutate(); }}>
        <label className="block text-sm">
          <span className="mb-2 block text-xs font-medium" style={{ color: "var(--stayo-ink-muted)" }}>E-mail</span>
          <span className="relative block"><Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--portal-muted)]" /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="portal-input w-full rounded-xl px-10 py-3 text-sm placeholder:text-[var(--portal-muted)]/60" placeholder="voce@exemplo.com" /></span>
        </label>
        <label className="block text-sm">
          <span className="mb-2 block text-xs font-medium" style={{ color: "var(--stayo-ink-muted)" }}>Senha</span>
          <span className="relative block"><LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--portal-muted)]" /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" className="portal-input w-full rounded-xl px-10 py-3 text-sm" /></span>
        </label>
        {login.isError && <p className="rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: "color-mix(in srgb, var(--stayo-danger) 25%, transparent)", backgroundColor: "color-mix(in srgb, var(--stayo-danger) 7%, transparent)", color: "var(--stayo-danger)" }} role="alert">Não foi possível entrar. Confira o e-mail e a senha ou tente novamente em instantes.</p>}
        <Button type="submit" disabled={login.isPending} className="portal-action group mt-1 h-12 w-full rounded-xl bg-[var(--portal-navy)] text-[var(--portal-hero-foreground)] hover:bg-[var(--portal-navy-strong)]">{login.isPending ? "Abrindo seu portal..." : <>Acessar meu portal <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>}</Button>
        <Link to="/portal/recuperar" className="text-center text-xs text-[var(--portal-muted)] underline">Esqueci minha senha</Link>
      </form>
    </Shell>
  );
}
