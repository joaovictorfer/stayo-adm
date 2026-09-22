import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, LockKeyhole, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Wizard, type WizardStep } from "../components/patterns/Wizard";
import { PortalShell, PortalSkeleton } from "../components/portal/PortalExperience";
import { Button } from "../components/ui/button";
import {
  adminApi,
  implementationQuery,
  ownerOnboardingLinkByTokenQuery,
  ownerOnboardingSubmissionQuery,
  ownerQuery,
} from "../lib/api/queries";
import { createOwnerAccountAndLink, isSupabaseConfigured } from "../lib/auth/owner-session";
import { formatBrazilianDocument, formatBrazilianPhone, ownerOnboardingFormSchema, validateOwnerField, type OwnerFormField } from "../lib/owner-form-validation";
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
  const [touched, setTouched] = useState<Partial<Record<OwnerFormField, boolean>>>({});

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
    mutationFn: () => {
      const validated = ownerOnboardingFormSchema.parse(form);
      return adminApi.ownerOnboarding.submit(implementationId, token, {
        ...validated,
        document: validated.document.replace(/\D/g, ""),
        phone: `+55${validated.phone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "")}`,
        pixKey: validated.pixKey || null,
      });
    },
    onSuccess: (submission) => {
      queryClient.setQueryData(
        ownerOnboardingSubmissionQuery(implementationId).queryKey,
        submission,
      );
      toast.success("Cadastro enviado", { description: "Recebemos seus dados com segurança." });
    },
    onError: () => toast.error("Não foi possível enviar agora", { description: "Seus dados continuam na tela. Confira sua conexão e tente novamente." }),
  });

  const set =
    (key: keyof OwnerOnboardingSubmissionInput) =>
    (value: string): void =>
      setForm((f) => ({ ...f, [key]: value || null }));

  const fieldError = (field: OwnerFormField) => touched[field]
    ? validateOwnerField(field, form[field])
    : undefined;
  const touch = (field: OwnerFormField) => () => setTouched((current) => ({ ...current, [field]: true }));

  if (submissionQ.data) {
    return (
      <Shell>
        <div className="portal-form-success" role="status">
          <CheckCircle2 aria-hidden="true" />
          <div><h1>Cadastro recebido</h1><p>Obrigado, {submissionQ.data.fullName}! Seus dados foram enviados com segurança para validação. A equipe Stayo avisará se precisar confirmar algo.</p></div>
        </div>
        <CreateOwnerAccountPanel token={token} defaultEmail={submissionQ.data.email} />
      </Shell>
    );
  }

  const steps: WizardStep[] = [
    {
      id: "identificacao",
      label: "Identificação",
      isValid: !validateOwnerField("fullName", form.fullName) && !validateOwnerField("document", form.document),
      invalidMessage: "Preencha seu nome e confira o CPF ou CNPJ para continuar.",
      content: (
        <div className="portal-form-section">
          <div className="portal-form-guidance"><ShieldCheck aria-hidden="true" /><p>Precisamos destas informações para identificar você com segurança.</p></div>
          <TextField label="Seu nome completo" placeholder="Como aparece no documento" autoComplete="name" value={form.fullName} onChange={set("fullName")} onBlur={touch("fullName")} error={fieldError("fullName")} maxLength={120} />
          <TextField label="CPF ou CNPJ" placeholder="000.000.000-00" inputMode="numeric" autoComplete="off" value={form.document ?? ""} onChange={(value) => set("document")(formatBrazilianDocument(value))} onBlur={touch("document")} error={fieldError("document")} maxLength={18} hint="Usamos este dado somente para seu cadastro e documentos." />
        </div>
      ),
    },
    {
      id: "contato",
      label: "Contato",
      isValid: !validateOwnerField("email", form.email) && !validateOwnerField("phone", form.phone),
      invalidMessage: "Confira o e-mail e informe um telefone com DDD.",
      content: (
        <div className="portal-form-section">
          <p className="portal-form-copy">Como você prefere receber atualizações da equipe Stayo?</p>
          <TextField label="Seu melhor e-mail" type="email" placeholder="voce@exemplo.com" autoComplete="email" value={form.email} onChange={set("email")} onBlur={touch("email")} error={fieldError("email")} maxLength={255} />
          <TextField label="WhatsApp ou telefone" placeholder="(11) 99999-9999" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(value) => set("phone")(formatBrazilianPhone(value))} onBlur={touch("phone")} error={fieldError("phone")} maxLength={15} hint="Inclua o DDD. Podemos usar este número para avisos importantes." />
        </div>
      ),
    },
    {
      id: "pagamento",
      label: "Pagamento",
      content: (
        <div className="portal-form-section">
          <div className="portal-form-guidance"><LockKeyhole aria-hidden="true" /><p>Informe uma chave Pix para futuros repasses. Este dado recebe acesso restrito.</p></div>
          <TextField
            label="Chave Pix para repasses"
            placeholder="CPF, CNPJ, telefone, e-mail ou chave aleatória"
            value={form.pixKey ?? ""}
            onChange={set("pixKey")}
            onBlur={touch("pixKey")}
            error={fieldError("pixKey")}
            maxLength={255}
            hint="A equipe Stayo confirmará os dados bancários antes do primeiro repasse."
          />
          {submit.isError && (
            <span className="text-sm" style={{ color: "var(--stayo-danger)" }} role="alert">
              Não conseguimos enviar agora. Seus dados continuam nesta tela; confira sua conexão e tente novamente.
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <Shell>
      <h1 className="mb-1 text-lg" style={{ fontFamily: "var(--stayo-font-display)" }}>
        Vamos concluir seu cadastro
      </h1>
      <p className="mb-4 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
        São três etapas curtas. Confira com calma — seus dados serão enviados somente no final.
      </p>
      <Wizard
        steps={steps}
        completeLabel="Enviar cadastro"
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
    onSuccess: () => toast.success("Conta criada", { description: "Agora você poderá acompanhar tudo com seu e-mail e senha." }),
    onError: () => toast.error("Não foi possível criar a conta", { description: "Confira os dados e tente novamente." }),
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
        <Button
          type="submit"
          disabled={createAccount.isPending}
          className="portal-action rounded-xl bg-[var(--portal-navy)] text-[var(--portal-hero-foreground)] hover:bg-[var(--portal-navy-strong)]"
        >
          {createAccount.isPending ? "Criando..." : "Criar conta"}
        </Button>
      </form>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  onBlur,
  type = "text",
  placeholder,
  hint,
  error,
  inputMode,
  autoComplete,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  type?: string;
  placeholder?: string;
  hint?: string;
  error?: string | undefined;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  maxLength?: number;
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
        onBlur={onBlur}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? `${label.replace(/\s/g, "-").toLowerCase()}-help` : undefined}
        className="portal-input w-full rounded-xl px-3 py-2.5 text-sm placeholder:text-[var(--portal-muted)]/60"
      />
      {(error || hint) && <span id={`${label.replace(/\s/g, "-").toLowerCase()}-help`} className={`mt-1.5 block text-xs ${error ? "text-[var(--portal-danger)]" : "text-[var(--portal-muted)]"}`}>{error ?? hint}</span>}
    </label>
  );
}
