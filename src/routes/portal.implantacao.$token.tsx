import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Wizard, type WizardStep } from "../components/patterns/Wizard";
import { PortalShell, PortalSkeleton } from "../components/portal/PortalExperience";
import {
  adminApi,
  implementationQuery,
  ownerOnboardingLinkByTokenQuery,
  ownerOnboardingSubmissionQuery,
  ownerQuery,
} from "../lib/api/queries";
import { createOwnerAccountAndLink, isSupabaseConfigured } from "../lib/auth/owner-session";
import { ownerOnboardingLinkStatus } from "../types/owner-onboarding";
import type { OwnerOnboardingSubmissionInput } from "../types/owner-onboarding";

export const Route = createFileRoute("/portal/implantacao/$token")({
  head: () => ({
    meta: [
      { title: "Cadastro do proprietário — Stayo" },
      { name: "description", content: "Complete seu cadastro para a implantação do seu imóvel." },
    ],
  }),
  component: OwnerOnboardingPortalPage,
});

const surface = { backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell width="compact" context="Cadastro do proprietário" footer="Seus dados são tratados com cuidado pela equipe Stayo.">
      <div className="p-5 sm:p-7">{children}</div>
    </PortalShell>
  );
}

function OwnerOnboardingPortalPage() {
  const { token } = Route.useParams();
  const linkQuery = useQuery(ownerOnboardingLinkByTokenQuery(token));
  const link = linkQuery.data;

  if (linkQuery.isPending) {
    return (
      <Shell>
        <PortalSkeleton />
      </Shell>
    );
  }

  if (!link) {
    return (
      <Shell>
        <h1 className="text-lg" style={{ fontFamily: "var(--stayo-font-display)" }}>
          Link inválido
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          Este link de cadastro não existe. Fale com quem enviou o link para receber um novo.
        </p>
      </Shell>
    );
  }

  const status = ownerOnboardingLinkStatus(link);
  if (status === "expirado" || status === "revogado") {
    return (
      <Shell>
        <h1 className="text-lg" style={{ fontFamily: "var(--stayo-font-display)" }}>
          {status === "expirado" ? "Link expirado" : "Link revogado"}
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          Fale com quem enviou o link para receber um novo.
        </p>
      </Shell>
    );
  }

  return <OwnerOnboardingForm implementationId={link.implementationId} token={token} />;
}

function OwnerOnboardingForm({
  implementationId,
  token,
}: {
  implementationId: string;
  token: string;
}) {
  const queryClient = useQueryClient();
  const implementationQ = useQuery(implementationQuery(implementationId));
  const submissionQ = useQuery(ownerOnboardingSubmissionQuery(implementationId));
  const ownerId = implementationQ.data?.ownerId ?? null;
  const ownerQ = useQuery({ ...ownerQuery(ownerId ?? ""), enabled: !!ownerId });

  const [form, setForm] = useState<OwnerOnboardingSubmissionInput>({
    fullName: "",
    document: null,
    email: "",
    phone: "",
    pixKey: null,
  });

  useEffect(() => {
    const owner = ownerQ.data;
    if (submissionQ.data || !owner) return;
    setForm((f) => ({
      ...f,
      fullName: owner.name,
      email: owner.email ?? "",
      phone: owner.phone ?? "",
    }));
  }, [ownerQ.data, submissionQ.data]);

  const submit = useMutation({
    mutationFn: () => adminApi.ownerOnboarding.submit(implementationId, token, form),
    onSuccess: (submission) => {
      queryClient.setQueryData(
        ownerOnboardingSubmissionQuery(implementationId).queryKey,
        submission,
      );
    },
  });

  const set =
    (key: keyof OwnerOnboardingSubmissionInput) =>
    (value: string): void =>
      setForm((f) => ({ ...f, [key]: value || null }));

  if (submissionQ.data) {
    return (
      <Shell>
        <h1 className="text-lg" style={{ fontFamily: "var(--stayo-font-display)" }}>
          Cadastro recebido
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          Obrigado, {submissionQ.data.fullName}! Já recebemos seus dados. A equipe Stayo entra em
          contato para os próximos passos da implantação.
        </p>
        <CreateOwnerAccountPanel token={token} defaultEmail={submissionQ.data.email} />
      </Shell>
    );
  }

  const steps: WizardStep[] = [
    {
      id: "identificacao",
      label: "Identificação",
      isValid: form.fullName.trim() !== "",
      content: (
        <div className="flex flex-col gap-3">
          <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
            Confirme seus dados para a implantação do seu imóvel na Stayo.
          </p>
          <TextField label="Nome completo" value={form.fullName} onChange={set("fullName")} />
          <TextField label="CPF ou CNPJ" value={form.document ?? ""} onChange={set("document")} />
        </div>
      ),
    },
    {
      id: "contato",
      label: "Contato",
      isValid: form.email.trim() !== "" && form.phone.trim() !== "",
      content: (
        <div className="flex flex-col gap-3">
          <TextField label="E-mail" type="email" value={form.email} onChange={set("email")} />
          <TextField label="Telefone" value={form.phone} onChange={set("phone")} />
        </div>
      ),
    },
    {
      id: "pagamento",
      label: "Pagamento",
      content: (
        <div className="flex flex-col gap-3">
          <TextField
            label="Chave Pix (para repasses futuros)"
            value={form.pixKey ?? ""}
            onChange={set("pixKey")}
          />
          {submit.isError && (
            <span className="text-sm" style={{ color: "var(--stayo-danger)" }} role="alert">
              Não foi possível enviar. Tente novamente.
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <Shell>
      <h1 className="mb-1 text-lg" style={{ fontFamily: "var(--stayo-font-display)" }}>
        Complete seu cadastro
      </h1>
      <p className="mb-4 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
        Leva menos de um minuto.
      </p>
      <Wizard
        steps={steps}
        completeLabel="Enviar"
        submitting={submit.isPending}
        onComplete={() => submit.mutate()}
      />
    </Shell>
  );
}

/**
 * Passo opcional de Owner Auth (Fase 17H): logo após o envio do
 * auto-cadastro, oferece criar uma conta de verdade (e-mail/senha via
 * Supabase Auth) vinculada ao proprietário pelo MESMO token do convite —
 * `owner_account_link` (migration 0013) revalida tudo server-side antes
 * de vincular. Sem Supabase configurado, isto não existe ainda (o
 * auto-cadastro em si continua funcionando normalmente, só sem "ver
 * depois" sem o link).
 */
function CreateOwnerAccountPanel({ token, defaultEmail }: { token: string; defaultEmail: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");

  const createAccount = useMutation({
    mutationFn: () => createOwnerAccountAndLink(email, password, token),
  });

  if (!isSupabaseConfigured()) {
    return (
      <p className="mt-4 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        Criar uma conta para acompanhar depois ainda não está disponível.
      </p>
    );
  }

  if (createAccount.isSuccess) {
    return (
      <p className="mt-4 text-sm" style={{ color: "var(--stayo-forest)" }}>
        {createAccount.data.account ? (
          <>
            Conta criada e vinculada! Você já pode{" "}
            <a href="/portal/login" className="underline">
              entrar
            </a>{" "}
            com este e-mail e senha para acompanhar depois.
          </>
        ) : (
          "Conta criada — confirme seu e-mail para poder entrar depois."
        )}
      </p>
    );
  }

  return (
    <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--stayo-border)" }}>
      <h2 className="mb-1 text-sm" style={{ fontFamily: "var(--stayo-font-display)" }}>
        Quer acompanhar depois?
      </h2>
      <p className="mb-3 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        Crie uma senha para entrar de novo mais tarde, sem depender de um link.
      </p>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          createAccount.mutate();
        }}
      >
        <TextField label="E-mail" type="email" value={email} onChange={setEmail} />
        <TextField label="Senha" type="password" value={password} onChange={setPassword} />
        {createAccount.isError && (
          <span className="text-sm" style={{ color: "var(--stayo-danger)" }} role="alert">
            Não foi possível criar a conta. Tente novamente.
          </span>
        )}
        <button
          type="submit"
          disabled={createAccount.isPending}
          className="rounded-[var(--radius-control)] px-3 py-2 text-sm disabled:opacity-60"
          style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
        >
          {createAccount.isPending ? "Criando..." : "Criar conta"}
        </button>
      </form>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
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
        className="portal-input w-full rounded-xl px-3 py-2.5 text-sm"
      />
    </label>
  );
}
