import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { Wizard, type WizardStep } from "../components/patterns/Wizard";
import { PortalShell, PortalSkeleton } from "../components/portal/PortalExperience";
import { Button } from "../components/ui/button";
import { ACCOUNT_TYPES, BRAZILIAN_BANKS, PIX_KEY_TYPES } from "../config/payment-data";
import {
  adminApi,
  implementationQuery,
  ownerOnboardingLinkByTokenQuery,
  ownerOnboardingSubmissionQuery,
  ownerQuery,
} from "../lib/api/queries";
import { createOwnerAccountAndLink, isSupabaseConfigured } from "../lib/auth/owner-session";
import {
  formatBrazilianDocument,
  formatBrazilianPhone,
  formatBrazilianPostalCode,
  normalizeOwnerSubmission,
  ownerOnboardingFormSchema,
  validateOwnerField,
  suggestPixKey,
  type OwnerFormField,
} from "../lib/owner-form-validation";
import {
  ownerOnboardingLinkStatus,
  type OwnerOnboardingSubmissionInput,
  type OwnerOnboardingPerson,
} from "../types/owner-onboarding";

export const Route = createFileRoute("/portal/implantacao/$token")({
  head: () => ({
    meta: [
      { title: "Cadastro do proprietário — Stayo" },
      { name: "description", content: "Complete seu cadastro para a implantação do seu imóvel." },
      { property: "og:title", content: "Cadastro do proprietário — Stayo" },
      {
        property: "og:description",
        content: "Complete seu cadastro para a implantação do seu imóvel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OwnerOnboardingPortalPage,
});

const emptyForm: OwnerOnboardingSubmissionInput = {
  personType: "pf",
  fullName: "",
  document: "",
  email: "",
  phone: "",
  postalCode: "",
  street: "",
  number: "",
  complement: null,
  district: "",
  city: "",
  state: "",
  bankName: "",
  bankBranch: "",
  accountNumber: "",
  accountType: "checking",
  accountHolder: "",
  holderTaxId: "",
  pixType: "cpf",
  pixKey: "",
  isPrimary: true,
  people: [
    { role: "proprietario", personType: "pf", fullName: "", document: "", email: "", phone: "" },
  ],
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell
      width="compact"
      context="Cadastro do proprietário"
      footer="Seus dados são tratados com cuidado pela equipe Stayo."
    >
      <div className="p-5 sm:p-7">{children}</div>
    </PortalShell>
  );
}

function OwnerOnboardingPortalPage() {
  const { token } = Route.useParams();
  const linkQuery = useQuery(ownerOnboardingLinkByTokenQuery(token));
  if (linkQuery.isPending)
    return (
      <Shell>
        <PortalSkeleton />
      </Shell>
    );
  if (!linkQuery.data)
    return (
      <AccessMessage
        title="Este acesso não está disponível"
        text="Não conseguimos reconhecer este link. Peça um novo acesso à equipe Stayo e continue de onde parou."
      />
    );
  const status = ownerOnboardingLinkStatus(linkQuery.data);
  if (status === "expirado" || status === "revogado")
    return (
      <AccessMessage
        title={status === "expirado" ? "Este acesso venceu" : "Este acesso foi encerrado"}
        text="Seus dados continuam protegidos. Peça um novo link à equipe Stayo para continuar."
      />
    );
  return <OwnerOnboardingForm implementationId={linkQuery.data.implementationId} token={token} />;
}

function AccessMessage({ title, text }: { title: string; text: string }) {
  return (
    <Shell>
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-[var(--portal-muted)]">{text}</p>
    </Shell>
  );
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
  const draftQ = useQuery({
    queryKey: ["owner-onboarding-draft", token],
    queryFn: () => adminApi.ownerOnboarding.getDraft(token),
  });
  const ownerId = implementationQ.data?.ownerId ?? null;
  const ownerQ = useQuery({ ...ownerQuery(ownerId ?? ""), enabled: !!ownerId });
  const [form, setForm] = useState<OwnerOnboardingSubmissionInput>(emptyForm);
  const [touched, setTouched] = useState<Partial<Record<OwnerFormField, boolean>>>({});
  const [currentStep, setCurrentStep] = useState(1);
  const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const hydrated = useRef(false);
  const formRef = useRef(form);
  const stepRef = useRef(currentStep);
  const lastSaved = useRef("");
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (hydrated.current || draftQ.isPending || (ownerId && ownerQ.isPending)) return;
    const initialForm = draftQ.data
      ? { ...emptyForm, ...draftQ.data }
      : ownerQ.data
        ? {
            ...emptyForm,
            fullName: ownerQ.data.name ?? "",
            email: ownerQ.data.email ?? "",
            phone: ownerQ.data.phone ?? "",
            accountHolder: ownerQ.data.name ?? "",
            holderTaxId: ownerQ.data.document ?? "",
            people: [
              {
                role: "proprietario" as const,
                personType: "pf" as const,
                fullName: ownerQ.data.name ?? "",
                document: ownerQ.data.document ?? "",
                email: ownerQ.data.email ?? "",
                phone: ownerQ.data.phone ?? "",
              },
            ],
          }
        : emptyForm;
    setForm(initialForm);
    formRef.current = initialForm;
    const restoredStep = Math.max(1, Math.min(5, draftQ.data?.currentStep ?? 1));
    setCurrentStep(restoredStep);
    stepRef.current = restoredStep;
    lastSaved.current = JSON.stringify(initialForm);
    hydrated.current = true;
  }, [draftQ.data, draftQ.isPending, ownerId, ownerQ.data, ownerQ.isPending]);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    stepRef.current = currentStep;
  }, [currentStep]);

  const persistDraft = useCallback(
    (snapshot: OwnerOnboardingSubmissionInput, step: number) => {
      const signature = JSON.stringify(snapshot);
      if (!hydrated.current || signature === lastSaved.current) return saveQueue.current;
      setAutoSaveState("saving");
      saveQueue.current = saveQueue.current
        .catch(() => undefined)
        .then(async () => {
          const saved = await adminApi.ownerOnboarding.saveDraft(token, snapshot, step, false);
          lastSaved.current = signature;
          queryClient.setQueryData(["owner-onboarding-draft", token], saved);
          queryClient.setQueryData(
            ownerOnboardingSubmissionQuery(implementationId).queryKey,
            saved,
          );
          setAutoSaveState("saved");
        })
        .catch(() => {
          setAutoSaveState("error");
        });
      return saveQueue.current;
    },
    [implementationId, queryClient, token],
  );

  useEffect(() => {
    if (!hydrated.current || submissionQ.data?.submittedAt) return;
    const timer = window.setTimeout(() => void persistDraft(form, currentStep), 900);
    return () => window.clearTimeout(timer);
  }, [currentStep, form, persistDraft, submissionQ.data?.submittedAt]);

  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden")
        void persistDraft(formRef.current, stepRef.current);
    };
    const flushOnExit = () => void persistDraft(formRef.current, stepRef.current);
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flushOnExit);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flushOnExit);
      flushOnExit();
    };
  }, [persistDraft]);

  const valid = (keys: OwnerFormField[]) =>
    keys.every((key) => !validateOwnerField(key, form[key]));
  const save = useMutation({
    mutationFn: async ({ submit, step }: { submit: boolean; step: number }) => {
      const parsed = ownerOnboardingFormSchema.parse(form);
      await saveQueue.current;
      return adminApi.ownerOnboarding.saveDraft(
        token,
        normalizeOwnerSubmission(parsed),
        step,
        submit,
      );
    },
    onSuccess: (submission, variables) => {
      queryClient.setQueryData(["owner-onboarding-draft", token], submission);
      if (variables.submit)
        queryClient.setQueryData(
          ownerOnboardingSubmissionQuery(implementationId).queryKey,
          submission,
        );
      lastSaved.current = JSON.stringify(form);
      setAutoSaveState("saved");
      toast.success(variables.submit ? "Recebemos seu cadastro" : "Dados salvos", {
        description: "Suas informações foram guardadas com segurança.",
      });
    },
    onError: (cause) =>
      toast.error("Não foi possível concluir o cadastro", {
        description: ownerOnboardingErrorMessage(cause),
      }),
  });
  const set = <K extends keyof OwnerOnboardingSubmissionInput>(
    key: K,
    value: OwnerOnboardingSubmissionInput[K],
  ) => setForm((current) => ({ ...current, [key]: value }));
  const error = (field: OwnerFormField) =>
    touched[field] ? validateOwnerField(field, form[field]) : undefined;
  const touch = (field: OwnerFormField) => () =>
    setTouched((current) => ({ ...current, [field]: true }));
  const people = useMemo(
    () =>
      form.people.length
        ? form.people
        : [
            {
              role: "proprietario" as const,
              personType: form.personType,
              fullName: form.fullName,
              document: form.document,
              email: form.email,
              phone: form.phone,
            },
          ],
    [form.people, form.personType, form.fullName, form.document, form.email, form.phone],
  );
  const [selectedHolder, setSelectedHolder] = useState(0);
  const [manualHolder, setManualHolder] = useState(false);
  const [manualPix, setManualPix] = useState(false);
  const selectedPerson = people[selectedHolder] ?? people[0];
  const updatePerson = (index: number, patch: Partial<OwnerOnboardingPerson>) => {
    setForm((current) => {
      const nextPeople = current.people.map((person, personIndex) =>
        personIndex === index ? { ...person, ...patch } : person,
      );
      const primary = nextPeople[0];
      return primary
        ? {
            ...current,
            people: nextPeople,
            personType: primary.personType,
            fullName: primary.fullName,
            document: primary.document,
            email: primary.email || current.email,
            phone: primary.phone || current.phone,
          }
        : current;
    });
  };
  const addPerson = () =>
    setForm((current) => ({
      ...current,
      people: [
        ...current.people,
        {
          role: "coproprietario",
          personType: "pf",
          fullName: "",
          document: "",
          email: "",
          phone: "",
        },
      ],
    }));
  const removePerson = (index: number) => {
    setForm((current) => ({
      ...current,
      people: current.people.filter((_, personIndex) => personIndex !== index),
    }));
    setSelectedHolder(0);
  };
  const selectPersonAsHolder = (index: number) => {
    const person = people[index];
    if (!person) return;
    setSelectedHolder(index);
    setManualHolder(false);
    set("accountHolder", person.fullName);
    set("holderTaxId", person.document);
    if (form.pixType !== "random") {
      const suggestion = suggestPixKey(person, form.pixType);
      if (suggestion) set("pixKey", suggestion);
    }
    toast.success("Titular selecionado", {
      description: "Os dados cadastrais foram preenchidos no repasse.",
    });
  };

  useEffect(() => {
    if (!form.accountNumber || manualHolder || !selectedPerson) return;
    if (!form.accountHolder) set("accountHolder", selectedPerson.fullName);
    if (!form.holderTaxId) set("holderTaxId", selectedPerson.document);
  }, [form.accountNumber, form.accountHolder, form.holderTaxId, manualHolder, selectedPerson]);

  useEffect(() => {
    if (!form.holderTaxId || manualHolder) return;
    const holderIndex = people.findIndex(
      (person) =>
        formatBrazilianDocument(person.document) === formatBrazilianDocument(form.holderTaxId),
    );
    if (holderIndex >= 0 && holderIndex !== selectedHolder) setSelectedHolder(holderIndex);
  }, [form.holderTaxId, manualHolder, people, selectedHolder]);

  if (submissionQ.data?.submittedAt)
    return (
      <Shell>
        <div className="portal-form-success" role="status">
          <CheckCircle2 />
          <div>
            <h1>Recebemos seu cadastro</h1>
            <p>
              Obrigado, {submissionQ.data.fullName}! Agora nossa equipe vai conferir as informações
              com cuidado.
            </p>
          </div>
        </div>
        <CreateOwnerAccountPanel token={token} defaultEmail={submissionQ.data.email} />
      </Shell>
    );

  const identityFields: OwnerFormField[] = ["personType", "fullName", "document"];
  const contactFields: OwnerFormField[] = ["email", "phone"];
  const addressFields: OwnerFormField[] = [
    "postalCode",
    "street",
    "number",
    "district",
    "city",
    "state",
  ];
  const payoutFields: OwnerFormField[] = [
    "bankName",
    "bankBranch",
    "accountNumber",
    "accountType",
    "accountHolder",
    "holderTaxId",
    "pixType",
    "pixKey",
  ];
  const steps: WizardStep[] = [
    {
      id: "identificacao",
      label: "Identificação",
      isValid:
        valid(identityFields) &&
        people.every(
          (person) =>
            !!person.fullName &&
            !validateOwnerField("fullName", person.fullName) &&
            !validateOwnerField("document", person.document),
        ),
      hasInlineErrors: identityFields.some((field) => !!error(field)),
      invalidMessage: "Confira os dados desta etapa.",
      content: (
        <Section icon={<ShieldCheck />} text="Primeiro, confirme quem é o titular do imóvel.">
          <div className="space-y-3">
            {people.map((person, index) => (
              <PersonEditor
                key={index}
                person={person}
                index={index}
                canRemove={index > 0}
                onChange={(patch) => updatePerson(index, patch)}
                onRemove={() => removePerson(index)}
              />
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            className="portal-add-person w-full"
            onClick={addPerson}
          >
            <Plus className="size-4" /> Adicionar proprietário ou proponente
          </Button>
        </Section>
      ),
    },
    {
      id: "contato",
      label: "Contato",
      isValid: valid(contactFields),
      hasInlineErrors: contactFields.some((field) => !!error(field)),
      invalidMessage: "Confira os dados desta etapa.",
      content: (
        <Section text="Informe como a equipe Stayo pode falar com você.">
          <TextField
            label="E-mail"
            type="email"
            value={form.email}
            onChange={(value) => {
              set("email", value);
              updatePerson(0, { email: value });
            }}
            onBlur={touch("email")}
            error={error("email")}
          />
          <TextField
            label="WhatsApp ou telefone"
            value={formatBrazilianPhone(form.phone)}
            onChange={(value) => {
              const phone = formatBrazilianPhone(value);
              set("phone", phone);
              updatePerson(0, { phone });
            }}
            onBlur={touch("phone")}
            error={error("phone")}
            inputMode="tel"
          />
        </Section>
      ),
    },
    {
      id: "endereco",
      label: "Endereço",
      isValid: valid(addressFields),
      hasInlineErrors: addressFields.some((field) => !!error(field)),
      invalidMessage: "Complete o endereço para continuar.",
      content: (
        <Section text="Buscamos o CEP automaticamente; se não encontrarmos, você pode preencher manualmente.">
          <TextField
            label="CEP"
            value={formatBrazilianPostalCode(form.postalCode)}
            onChange={(value) => set("postalCode", formatBrazilianPostalCode(value))}
            onBlur={() => {
              touch("postalCode")();
              void lookupPostalCode(form.postalCode, set);
            }}
            error={error("postalCode")}
            inputMode="numeric"
          />
          <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
            <TextField
              label="Endereço"
              value={form.street}
              onChange={(value) => set("street", value)}
              error={error("street")}
            />
            <TextField
              label="Número"
              value={form.number}
              onChange={(value) => set("number", value)}
              error={error("number")}
            />
          </div>
          <TextField
            label="Complemento (opcional)"
            value={form.complement ?? ""}
            onChange={(value) => set("complement", value || null)}
          />
          <TextField
            label="Bairro"
            value={form.district}
            onChange={(value) => set("district", value)}
            error={error("district")}
          />
          <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
            <TextField
              label="Cidade"
              value={form.city}
              onChange={(value) => set("city", value)}
              error={error("city")}
            />
            <TextField
              label="UF"
              value={form.state}
              onChange={(value) => set("state", value.toUpperCase().slice(0, 2))}
              error={error("state")}
            />
          </div>
        </Section>
      ),
    },
    {
      id: "repasse",
      label: "Repasse",
      isValid: valid(payoutFields),
      hasInlineErrors: payoutFields.some((field) => !!error(field)),
      invalidMessage: "Complete os dados de repasse.",
      content: (
        <Section
          icon={<LockKeyhole />}
          text="Estes dados ficam restritos à equipe autorizada e serão confirmados antes do primeiro repasse."
        >
          <TextField
            label="Banco"
            list="owner-banks"
            value={form.bankName}
            onChange={(value) => set("bankName", value)}
            error={error("bankName")}
          />
          <datalist id="owner-banks">
            {BRAZILIAN_BANKS.map((bank) => (
              <option key={bank}>{bank}</option>
            ))}
          </datalist>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label="Agência"
              value={form.bankBranch}
              onChange={(value) => set("bankBranch", value)}
              error={error("bankBranch")}
            />
            <TextField
              label="Conta com dígito"
              value={form.accountNumber}
              onChange={(value) => set("accountNumber", value)}
              error={error("accountNumber")}
            />
          </div>
          <Choice
            label="Tipo de conta"
            value={form.accountType}
            onChange={(value) =>
              set("accountType", value as OwnerOnboardingSubmissionInput["accountType"])
            }
            options={[...ACCOUNT_TYPES]}
          />
          <div className="portal-smart-field">
            <div className="portal-smart-field-head">
              <span>Titular da conta</span>
              <Sparkles className="size-4" />
            </div>
            {people.length > 1 && !manualHolder ? (
              <div className="grid gap-2">
                {people.map((person, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`portal-person-option ${selectedHolder === index ? "is-selected" : ""}`}
                    onClick={() => selectPersonAsHolder(index)}
                  >
                    <UserRound className="size-4" />
                    <span>
                      <strong>{person.fullName || `Pessoa ${index + 1}`}</strong>
                      <small>
                        {formatBrazilianDocument(person.document) || "Documento pendente"}
                      </small>
                    </span>
                    {selectedHolder === index && <Check className="size-4" />}
                  </button>
                ))}
              </div>
            ) : !manualHolder && selectedPerson ? (
              <div className="portal-person-summary">
                <UserRound className="size-5" />
                <div>
                  <strong>{selectedPerson.fullName}</strong>
                  <span>{formatBrazilianDocument(selectedPerson.document)}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <TextField
                  label="Titular"
                  value={form.accountHolder}
                  onChange={(value) => set("accountHolder", value)}
                  error={error("accountHolder")}
                />
                <TextField
                  label="CPF/CNPJ do titular"
                  value={formatBrazilianDocument(form.holderTaxId)}
                  onChange={(value) => set("holderTaxId", formatBrazilianDocument(value))}
                  error={error("holderTaxId")}
                />
              </div>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="portal-inline-action"
              onClick={() => setManualHolder((value) => !value)}
            >
              {manualHolder ? "Usar proprietário cadastrado" : "Alterar titular da conta"}
            </Button>
          </div>
          <Choice
            label="Tipo da chave Pix"
            value={form.pixType}
            onChange={(value) => {
              const type = value as OwnerOnboardingSubmissionInput["pixType"];
              set("pixType", type);
              setManualPix(type === "random");
              if (selectedPerson && type !== "random")
                set("pixKey", suggestPixKey(selectedPerson, type));
            }}
            options={[...PIX_KEY_TYPES]}
          />
          <div className="portal-smart-field">
            {!manualPix && form.pixType !== "random" ? (
              <div className="portal-pix-suggestion">
                <Sparkles className="size-4" />
                <span>
                  <small>Chave sugerida pelos dados do titular</small>
                  <strong>{form.pixKey || "Dado ainda não informado"}</strong>
                </span>
              </div>
            ) : (
              <TextField
                label="Chave Pix"
                value={form.pixKey}
                onChange={(value) => set("pixKey", value)}
                error={error("pixKey")}
              />
            )}
            {form.pixType !== "random" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="portal-inline-action"
                onClick={() => setManualPix((value) => !value)}
              >
                {manualPix ? "Usar sugestão inteligente" : "Alterar chave Pix"}
              </Button>
            )}
          </div>
        </Section>
      ),
    },
    {
      id: "revisao",
      label: "Revisão",
      isValid: ownerOnboardingFormSchema.safeParse(form).success,
      content: (
        <Section text="Revise os dados antes de confirmar. Você continuará com acesso após o envio.">
          <Review
            label={people.length > 1 ? "Proprietários e proponentes" : "Titular"}
            value={people
              .map((person) => person.fullName)
              .filter(Boolean)
              .join(" · ")}
          />
          <Review label="Contato" value={`${form.email} · ${formatBrazilianPhone(form.phone)}`} />
          <Review
            label="Endereço"
            value={`${form.street}, ${form.number} · ${form.city}/${form.state}`}
          />
          <Review label="Repasse" value={`${form.bankName} · conta principal`} />
          {save.isError && (
            <p className="text-sm text-[var(--portal-danger)]" role="alert">
              Não conseguimos enviar agora. Seus dados continuam nesta tela.
            </p>
          )}
        </Section>
      ),
    },
  ];

  return (
    <Shell>
      <h1 className="mb-1 text-lg font-semibold">Vamos concluir seu cadastro</h1>
      <p className="mb-4 text-sm text-[var(--portal-muted)]">
        São cinco etapas curtas. Suas alterações são salvas automaticamente.
      </p>
      <div
        className="mb-4 flex items-center gap-2 text-xs text-[var(--portal-muted)]"
        role="status"
      >
        <span
          className={`size-2 rounded-full ${
            autoSaveState === "error"
              ? "bg-[var(--portal-danger)]"
              : autoSaveState === "saving"
                ? "animate-pulse bg-[var(--portal-gold)]"
                : "bg-[var(--portal-success)]"
          }`}
        />
        {autoSaveState === "saving"
          ? "Salvando alterações…"
          : autoSaveState === "error"
            ? "Não foi possível salvar agora. Tentaremos novamente."
            : autoSaveState === "saved"
              ? "Alterações salvas"
              : "Salvamento automático ativo"}
      </div>
      <Wizard
        steps={steps}
        initialStep={currentStep - 1}
        onStepChange={(index) => {
          const nextStep = index + 1;
          setCurrentStep(nextStep);
          void persistDraft(formRef.current, nextStep);
        }}
        completeLabel="Confirmar e enviar cadastro"
        submitting={save.isPending}
        onComplete={() => save.mutate({ submit: true, step: 5 })}
      />
      <Button
        variant="ghost"
        className="mt-3 w-full"
        disabled={save.isPending}
        onClick={() => save.mutate({ submit: false, step: currentStep })}
      >
        Salvar e continuar depois
      </Button>
    </Shell>
  );
}

function ownerOnboardingErrorMessage(cause: unknown): string {
  const message = cause instanceof Error ? cause.message.toLocaleLowerCase("pt-BR") : "";
  if (message.includes("acesso inválido"))
    return "Este acesso expirou ou foi encerrado. Solicite um novo link à equipe Stayo.";
  if (message.includes("cpf") || message.includes("cnpj") || message.includes("documento"))
    return "Confira o CPF ou CNPJ informado antes de enviar.";
  if (message.includes("endereço") || message.includes("state") || message.includes("estado"))
    return "Confira o endereço e a UF informados antes de enviar.";
  if (message.includes("telefone")) return "Confira o telefone e o DDD antes de enviar.";
  if (message.includes("e-mail") || message.includes("email"))
    return "Confira o e-mail informado antes de enviar.";
  if (message.includes("repasse") || message.includes("pix") || message.includes("conta"))
    return "Confira os dados bancários e a chave Pix antes de enviar.";
  return "Seus dados continuam nesta tela. Tente novamente em alguns instantes.";
}

async function lookupPostalCode(
  value: string,
  set: <K extends keyof OwnerOnboardingSubmissionInput>(
    key: K,
    value: OwnerOnboardingSubmissionInput[K],
  ) => void,
) {
  const postalCode = value.replace(/\D/g, "");
  if (postalCode.length !== 8) return;
  try {
    const response = await fetch(`https://viacep.com.br/ws/${postalCode}/json/`);
    const data = (await response.json()) as {
      erro?: boolean;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
    };
    if (!data.erro) {
      set("street", data.logradouro ?? "");
      set("district", data.bairro ?? "");
      set("city", data.localidade ?? "");
      set("state", data.uf ?? "");
      toast.success("Endereço encontrado");
    }
  } catch {
    toast.info("Preencha o endereço manualmente", {
      description: "A busca do CEP está indisponível no momento.",
    });
  }
}

function Section({
  icon,
  text,
  children,
}: {
  icon?: React.ReactNode;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <div className="portal-form-section">
      <div className="portal-form-guidance">
        {icon}
        <p>{text}</p>
      </div>
      {children}
    </div>
  );
}
function Review({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--portal-border)] p-3">
      <span className="text-xs text-[var(--portal-muted)]">{label}</span>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
function PersonEditor({
  person,
  index,
  canRemove,
  onChange,
  onRemove,
}: {
  person: OwnerOnboardingPerson;
  index: number;
  canRemove: boolean;
  onChange: (patch: Partial<OwnerOnboardingPerson>) => void;
  onRemove: () => void;
}) {
  const nameError = person.fullName ? validateOwnerField("fullName", person.fullName) : undefined;
  const documentError = person.document
    ? validateOwnerField("document", person.document)
    : undefined;
  return (
    <div className="portal-person-card">
      <div className="portal-person-card-head">
        <div>
          <span>{index === 0 ? "Proprietário principal" : `Pessoa ${index + 1}`}</span>
          <small>
            {index === 0 ? "Responsável principal pelo cadastro" : "Coproprietário ou proponente"}
          </small>
        </div>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remover pessoa"
            onClick={onRemove}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
      {canRemove && (
        <Choice
          label="Participação"
          value={person.role}
          onChange={(value) => onChange({ role: value as OwnerOnboardingPerson["role"] })}
          options={[
            { value: "coproprietario", label: "Coproprietário" },
            { value: "proponente", label: "Proponente" },
          ]}
        />
      )}
      <Choice
        label="Tipo de pessoa"
        value={person.personType}
        onChange={(value) => onChange({ personType: value as OwnerOnboardingPerson["personType"] })}
        options={[
          { value: "pf", label: "Pessoa física" },
          { value: "pj", label: "Pessoa jurídica" },
        ]}
      />
      <TextField
        label={person.personType === "pf" ? "Nome completo" : "Razão social"}
        value={person.fullName}
        onChange={(value) => onChange({ fullName: value })}
        error={nameError}
      />
      <TextField
        label={person.personType === "pf" ? "CPF" : "CNPJ"}
        value={formatBrazilianDocument(person.document)}
        onChange={(value) => onChange({ document: formatBrazilianDocument(value) })}
        error={documentError}
        inputMode="numeric"
      />
      {canRemove && (
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="E-mail (opcional)"
            type="email"
            value={person.email}
            onChange={(value) => onChange({ email: value })}
          />
          <TextField
            label="Telefone (opcional)"
            value={formatBrazilianPhone(person.phone)}
            onChange={(value) => onChange({ phone: formatBrazilianPhone(value) })}
            inputMode="tel"
          />
        </div>
      )}
    </div>
  );
}
function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs text-[var(--portal-muted)]">{label}</span>
      <select
        className="portal-input w-full rounded-xl px-3 py-2.5"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
function TextField({
  label,
  value,
  onChange,
  onBlur,
  type = "text",
  error,
  inputMode,
  list,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: (() => void) | undefined;
  type?: string | undefined;
  error?: string | undefined;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"] | undefined;
  list?: string | undefined;
}) {
  const id = useMemo(() => label.replace(/\s/g, "-").toLowerCase(), [label]);
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs text-[var(--portal-muted)]">{label}</span>
      <input
        className="portal-input w-full rounded-xl px-3 py-2.5"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        inputMode={inputMode}
        list={list}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-help` : undefined}
      />
      {error && (
        <span id={`${id}-help`} className="mt-1 block text-xs text-[var(--portal-danger)]">
          {error}
        </span>
      )}
    </label>
  );
}

function CreateOwnerAccountPanel({ token, defaultEmail }: { token: string; defaultEmail: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const createAccount = useMutation({
    mutationFn: () => createOwnerAccountAndLink(email, password, token),
    onSuccess: () => toast.success("Conta criada"),
    onError: () => toast.error("Não foi possível criar a conta"),
  });
  if (!isSupabaseConfigured())
    return (
      <p className="mt-4 text-xs text-[var(--portal-muted)]">
        Continue usando o link enviado pela equipe Stayo.
      </p>
    );
  if (createAccount.isSuccess)
    return (
      <p className="mt-4 text-sm text-[var(--portal-success)]">
        Sua conta está pronta para acessar o portal.
      </p>
    );
  return (
    <form
      className="mt-4 space-y-3 border-t pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        createAccount.mutate();
      }}
    >
      <h2 className="text-sm font-semibold">Quer acessar quando precisar?</h2>
      <TextField label="E-mail" type="email" value={email} onChange={setEmail} />
      <TextField label="Senha" type="password" value={password} onChange={setPassword} />
      <Button type="submit" disabled={createAccount.isPending} className="w-full">
        Criar meu acesso
      </Button>
    </form>
  );
}
