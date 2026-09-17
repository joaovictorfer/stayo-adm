import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Wizard, type WizardStep } from "../components/patterns/Wizard";
import { ownerOnboardingStore } from "../lib/api/local-store";
import {
  implementationQuery,
  ownerOnboardingLinkByTokenQuery,
  ownerOnboardingSubmissionQuery,
  ownerQuery,
} from "../lib/api/queries";
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
    <div
      className="flex min-h-screen items-start justify-center px-4 py-10 sm:items-center"
      style={{
        backgroundColor: "var(--stayo-bg)",
        color: "var(--stayo-ink)",
        fontFamily: "var(--stayo-font-ui)",
      }}
    >
      <div className="w-full max-w-md">
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

function OwnerOnboardingPortalPage() {
  const { token } = Route.useParams();
  const linkQuery = useQuery(ownerOnboardingLinkByTokenQuery(token));
  const link = linkQuery.data;

  if (linkQuery.isPending) {
    return (
      <Shell>
        <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          Carregando...
        </p>
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

  return <OwnerOnboardingForm implementationId={link.implementationId} />;
}

function OwnerOnboardingForm({ implementationId }: { implementationId: string }) {
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
    mutationFn: () => ownerOnboardingStore.submit(implementationId, form),
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
        className="w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
        style={{ ...surface, color: "var(--stayo-ink)" }}
      />
    </label>
  );
}
