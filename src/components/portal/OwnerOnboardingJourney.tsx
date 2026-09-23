import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cloud,
  FileCheck2,
  Home,
  KeyRound,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { StayoLogo } from "../brand/StayoLogo";
import { Button } from "../ui/button";
import { ACCOUNT_TYPES, BRAZILIAN_BANKS, PIX_KEY_TYPES } from "../../config/payment-data";
import { createOwnerAccountAndLink, isSupabaseConfigured } from "../../lib/auth/owner-session";
import { ownerJourneyApi, type OwnerJourneyProposal } from "../../lib/api/owner-journey";
import {
  adminApi,
  implementationQuery,
  ownerOnboardingSubmissionQuery,
  ownerQuery,
} from "../../lib/api/queries";
import {
  formatBrazilianDocument,
  formatBrazilianPhone,
  formatBrazilianPostalCode,
  normalizeOwnerSubmission,
  ownerOnboardingFormSchema,
  suggestPixKey,
  validateOwnerField,
  type OwnerFormField,
} from "../../lib/owner-form-validation";
import type {
  OwnerOnboardingPerson,
  OwnerOnboardingSubmissionInput,
} from "../../types/owner-onboarding";
import type { CommercialTerm } from "../../types/admin";

const STAGE_CODES = { owner: 20, property: 30, access: 40 } as const;
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

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
  propertyPostalCode: "",
  propertyStreet: "",
  propertyNumber: "",
  propertyComplement: null,
  propertyDistrict: "",
  propertyCity: "",
  propertyState: "",
  propertyType: "",
  propertyBedrooms: null,
  propertySuites: null,
  propertyBathrooms: null,
  propertyParkingSpots: null,
  propertyAccessType: null,
  propertyAccessNotes: "",
  propertyAccessCode: "",
  propertyWifiNetwork: "",
  propertyWifiPassword: "",
};

const ownerRequiredFields: OwnerFormField[] = [
  "personType",
  "fullName",
  "document",
  "email",
  "phone",
  "postalCode",
  "street",
  "number",
  "district",
  "city",
  "state",
  "bankName",
  "bankBranch",
  "accountNumber",
  "accountType",
  "accountHolder",
  "holderTaxId",
  "pixType",
  "pixKey",
];

type Stage = 1 | 2 | 3 | 4;

interface Props {
  implementationId: string;
  token: string;
}

export function OwnerOnboardingJourney({ implementationId, token }: Props) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const implementationQ = useQuery(implementationQuery(implementationId));
  const submissionQ = useQuery(ownerOnboardingSubmissionQuery(implementationId));
  const journeyQ = useQuery({
    queryKey: ["owner-journey", "proposal", token],
    queryFn: () => ownerJourneyApi.resolveProposal(token),
    retry: 1,
  });
  const draftQ = useQuery({
    queryKey: ["owner-onboarding-draft", token],
    queryFn: () => adminApi.ownerOnboarding.getDraft(token),
  });

  const ownerId = implementationQ.data?.ownerId ?? null;
  const ownerQ = useQuery({ ...ownerQuery(ownerId ?? ""), enabled: Boolean(ownerId) });

  const [form, setForm] = useState<OwnerOnboardingSubmissionInput>(emptyForm);
  const [stage, setStage] = useState<Stage>(1);
  const [maxStage, setMaxStage] = useState<Stage>(1);
  const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [showOwnerErrors, setShowOwnerErrors] = useState(false);
  const [showPropertyErrors, setShowPropertyErrors] = useState(false);
  const [acceptName, setAcceptName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [accountState, setAccountState] = useState<"idle" | "confirmation_required" | "linked">("idle");

  const hydrated = useRef(false);
  const formRef = useRef(form);
  const stageRef = useRef<Stage>(stage);
  const maxStageRef = useRef<Stage>(maxStage);
  const lastSaved = useRef("");
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const finalizing = useRef(false);

  const proposalAccepted = Boolean(journeyQ.data?.proposal.acceptedAt);
  const submitted = Boolean(submissionQ.data?.submittedAt || draftQ.data?.submittedAt);

  useEffect(() => {
    formRef.current = form;
  }, [form]);
  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);
  useEffect(() => {
    maxStageRef.current = maxStage;
  }, [maxStage]);

  useEffect(() => {
    if (
      hydrated.current ||
      draftQ.isPending ||
      implementationQ.isPending ||
      (ownerId && ownerQ.isPending) ||
      journeyQ.isPending
    )
      return;

    const implementation = implementationQ.data;
    const owner = ownerQ.data;
    const basePerson: OwnerOnboardingPerson = {
      role: "proprietario",
      personType: "pf",
      fullName: owner?.name ?? "",
      document: owner?.document ?? "",
      email: owner?.email ?? "",
      phone: owner?.phone ?? "",
    };
    const initial = draftQ.data
      ? { ...emptyForm, ...draftQ.data }
      : {
          ...emptyForm,
          fullName: basePerson.fullName,
          document: basePerson.document,
          email: basePerson.email,
          phone: basePerson.phone,
          accountHolder: basePerson.fullName,
          holderTaxId: basePerson.document,
          people: [basePerson],
          propertyPostalCode: implementation?.postalCode ?? "",
          propertyStreet: implementation?.address ?? "",
          propertyCity: implementation?.city ?? "",
          propertyType: implementation?.propertyType ?? "",
          propertyBedrooms: implementation?.bedrooms ?? null,
        };

    if (!initial.people.length) initial.people = [basePerson];
    setForm(initial);
    formRef.current = initial;
    lastSaved.current = JSON.stringify(initial);

    const savedStep = draftQ.data?.currentStep ?? 0;
    let reached: Stage = 1;
    let initialStage: Stage = 1;
    if (proposalAccepted) {
      reached = 2;
      initialStage = 2;
      if (savedStep >= STAGE_CODES.property) {
        reached = 3;
        initialStage = 3;
      }
      if (submitted || savedStep >= STAGE_CODES.access) {
        reached = 4;
        initialStage = 4;
      }
    }
    setMaxStage(reached);
    setStage(initialStage);
    maxStageRef.current = reached;
    stageRef.current = initialStage;
    setAcceptName(journeyQ.data?.proposal.acceptedName ?? owner?.name ?? "");
    setAgreed(Boolean(journeyQ.data?.proposal.acceptedAt));
    hydrated.current = true;
  }, [
    draftQ.data,
    draftQ.isPending,
    implementationQ.data,
    implementationQ.isPending,
    journeyQ.data,
    journeyQ.isPending,
    ownerId,
    ownerQ.data,
    ownerQ.isPending,
    proposalAccepted,
    submitted,
  ]);

  const persistDraft = useCallback(
    (snapshot: OwnerOnboardingSubmissionInput, targetStage: Stage) => {
      const signature = JSON.stringify(snapshot);
      if (
        !hydrated.current ||
        finalizing.current ||
        targetStage < 2 ||
        !proposalAccepted ||
        snapshot.people.length === 0 ||
        signature === lastSaved.current ||
        submitted
      )
        return saveQueue.current;

      const code = targetStage >= 3 ? STAGE_CODES.property : STAGE_CODES.owner;
      setAutoSaveState("saving");
      saveQueue.current = saveQueue.current
        .catch(() => undefined)
        .then(async () => {
          const saved = await adminApi.ownerOnboarding.saveDraft(token, snapshot, code, false);
          lastSaved.current = signature;
          queryClient.setQueryData(["owner-onboarding-draft", token], saved);
          queryClient.setQueryData(ownerOnboardingSubmissionQuery(implementationId).queryKey, saved);
          setAutoSaveState("saved");
        })
        .catch(() => {
          setAutoSaveState("error");
        });
      return saveQueue.current;
    },
    [implementationId, proposalAccepted, queryClient, submitted, token],
  );

  useEffect(() => {
    if (!hydrated.current || stage < 2 || submitted || finalizing.current) return;
    const timer = window.setTimeout(() => void persistDraft(form, stage), 900);
    return () => window.clearTimeout(timer);
  }, [form, persistDraft, stage, submitted]);

  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden" && !finalizing.current)
        void persistDraft(formRef.current, stageRef.current);
    };
    const flushOnExit = () => {
      if (!finalizing.current) void persistDraft(formRef.current, stageRef.current);
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flushOnExit);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flushOnExit);
    };
  }, [persistDraft]);

  const set = <K extends keyof OwnerOnboardingSubmissionInput>(
    key: K,
    value: OwnerOnboardingSubmissionInput[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const people = form.people.length ? form.people : emptyForm.people;
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
  const removePerson = (index: number) =>
    setForm((current) => ({
      ...current,
      people: current.people.filter((_, personIndex) => personIndex !== index),
    }));

  useEffect(() => {
    const primary = people[0];
    if (!primary) return;
    setForm((current) => {
      let changed = false;
      const next = { ...current };
      if (!current.accountHolder && primary.fullName) {
        next.accountHolder = primary.fullName;
        changed = true;
      }
      if (!current.holderTaxId && primary.document) {
        next.holderTaxId = primary.document;
        changed = true;
      }
      if (!current.pixKey && current.pixType !== "random") {
        const suggested = suggestPixKey(primary, current.pixType);
        if (suggested) {
          next.pixKey = suggested;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [people]);

  const ownerValid = useMemo(() => {
    if (!ownerRequiredFields.every((field) => !validateOwnerField(field, form[field]))) return false;
    return people.every(
      (person) =>
        Boolean(person.fullName) &&
        !validateOwnerField("fullName", person.fullName) &&
        !validateOwnerField("document", person.document) &&
        (!person.email || !validateOwnerField("email", person.email)) &&
        (!person.phone || !validateOwnerField("phone", person.phone)),
    );
  }, [form, people]);

  const propertyErrors = useMemo(() => validateProperty(form), [form]);
  const propertyValid = Object.keys(propertyErrors).length === 0;

  const acceptProposal = useMutation({
    mutationFn: () => ownerJourneyApi.acceptProposal(token, acceptName.trim()),
    onSuccess: async (journey) => {
      queryClient.setQueryData(["owner-journey", "proposal", token], journey);
      setMaxStage((current) => (current < 2 ? 2 : current));
      setStage(2);
      toast.success("Proposta aceita", {
        description: "Agora vamos concluir seus dados e preparar o imóvel.",
      });
    },
    onError: (error) =>
      toast.error("Não foi possível registrar o aceite", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      }),
  });

  const finishRegistration = useMutation({
    mutationFn: async () => {
      const parsed = ownerOnboardingFormSchema.parse(form);
      finalizing.current = true;
      await saveQueue.current;
      return adminApi.ownerOnboarding.saveDraft(
        token,
        normalizeOwnerSubmission(parsed),
        STAGE_CODES.access,
        true,
      );
    },
    onSuccess: async (submission) => {
      queryClient.setQueryData(["owner-onboarding-draft", token], submission);
      queryClient.setQueryData(ownerOnboardingSubmissionQuery(implementationId).queryKey, submission);
      lastSaved.current = JSON.stringify(form);
      setAutoSaveState("saved");
      setMaxStage(4);
      setStage(4);
      toast.success("Cadastro recebido", {
        description: "Falta apenas preparar seu acesso ao Portal do Proprietário.",
      });
    },
    onError: (error) =>
      toast.error("Não foi possível concluir o cadastro", {
        description: ownerErrorMessage(error),
      }),
    onSettled: () => {
      finalizing.current = false;
    },
  });

  const createAccount = useMutation({
    mutationFn: async () => {
      if (password.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
      if (password !== passwordConfirmation) throw new Error("As senhas não coincidem.");
      return createOwnerAccountAndLink(form.email, password, token);
    },
    onSuccess: (result) => {
      if (result.status === "confirmation_required") {
        setAccountState("confirmation_required");
        toast.success("Confirme seu e-mail para ativar o acesso");
        return;
      }
      setAccountState("linked");
      toast.success("Seu acesso está pronto");
      void navigate({ to: "/portal/inicio" });
    },
    onError: (error) =>
      toast.error("Não foi possível criar o acesso", {
        description: accountErrorMessage(error),
      }),
  });

  const advanceOwner = () => {
    setShowOwnerErrors(true);
    if (!ownerValid) {
      toast.error("Confira os dados antes de continuar");
      return;
    }
    setMaxStage((current) => (current < 3 ? 3 : current));
    setStage(3);
    void persistDraft(formRef.current, 3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const advanceProperty = () => {
    setShowPropertyErrors(true);
    if (!propertyValid) {
      toast.error("Complete os dados essenciais do imóvel");
      return;
    }
    if (!ownerValid) {
      setShowOwnerErrors(true);
      setStage(2);
      toast.error("Revise os dados do proprietário antes de finalizar");
      return;
    }
    finishRegistration.mutate();
  };

  const goToStage = (target: Stage) => {
    if (target > maxStageRef.current) return;
    setStage(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="portal-onboarding">
      <header className="portal-onboarding-header">
        <div className="portal-onboarding-brand-row">
          <StayoLogo variant="white" className="h-auto w-24" />
          {stage >= 2 && !submitted && (
            <div className={`portal-autosave is-${autoSaveState}`} role="status">
              {autoSaveState === "saved" ? <CheckCircle2 /> : <Cloud />}
              <span>
                {autoSaveState === "saving"
                  ? "Salvando…"
                  : autoSaveState === "error"
                    ? "Tentaremos novamente"
                    : autoSaveState === "saved"
                      ? "Tudo salvo"
                      : "Salvamento ativo"}
              </span>
            </div>
          )}
        </div>
        <p className="portal-onboarding-eyebrow">Sua jornada com a STAYO</p>
        <h1>{journeyHeadline(stage)}</h1>
        <p className="portal-onboarding-lead">
          {stage === 1
            ? "Conheça as condições combinadas antes de começarmos o cadastro."
            : "Uma etapa por vez. Você pode sair e continuar depois pelo mesmo link."}
        </p>
        <JourneyTimeline stage={stage} maxStage={maxStage} onSelect={goToStage} />
      </header>

      <main className="portal-onboarding-main">
        <div className="portal-onboarding-card">
          {stage === 1 && (
            <ProposalStage
              journey={journeyQ.data ?? null}
              loading={journeyQ.isPending}
              error={journeyQ.isError}
              acceptName={acceptName}
              agreed={agreed}
              accepting={acceptProposal.isPending}
              onAcceptName={setAcceptName}
              onAgree={setAgreed}
              onAccept={() => acceptProposal.mutate()}
              onContinue={() => {
                setMaxStage((current) => (current < 2 ? 2 : current));
                setStage(2);
              }}
            />
          )}

          {stage === 2 && (
            <OwnerDataStage
              form={form}
              people={people}
              showErrors={showOwnerErrors}
              onSet={set}
              onUpdatePerson={updatePerson}
              onAddPerson={addPerson}
              onRemovePerson={removePerson}
              onBack={() => goToStage(1)}
              onContinue={advanceOwner}
            />
          )}

          {stage === 3 && (
            <PropertyStage
              form={form}
              implementationName={
                implementationQ.data?.condominiumName || implementationQ.data?.nickname || null
              }
              errors={showPropertyErrors ? propertyErrors : {}}
              finishing={finishRegistration.isPending}
              onSet={set}
              onBack={() => goToStage(2)}
              onContinue={advanceProperty}
            />
          )}

          {stage === 4 && (
            <AccessStage
              email={form.email}
              password={password}
              passwordConfirmation={passwordConfirmation}
              creating={createAccount.isPending}
              accountState={accountState}
              supabaseReady={isSupabaseConfigured()}
              onPassword={setPassword}
              onPasswordConfirmation={setPasswordConfirmation}
              onCreate={() => createAccount.mutate()}
              onBack={() => goToStage(3)}
              onEnterPortal={() => void navigate({ to: "/portal/inicio" })}
            />
          )}
        </div>

        <div className="portal-onboarding-trust">
          <ShieldCheck />
          <span>
            Seus dados são protegidos e acessíveis apenas à equipe autorizada. Informações do imóvel
            não são publicadas automaticamente no Guia do Hóspede.
          </span>
        </div>
      </main>
    </div>
  );
}

function JourneyTimeline({
  stage,
  maxStage,
  onSelect,
}: {
  stage: Stage;
  maxStage: Stage;
  onSelect: (stage: Stage) => void;
}) {
  const steps: Array<{ id: Stage; label: string; icon: React.ReactNode }> = [
    { id: 1, label: "Proposta", icon: <FileCheck2 /> },
    { id: 2, label: "Seus dados", icon: <UserRound /> },
    { id: 3, label: "Seu imóvel", icon: <Home /> },
    { id: 4, label: "Seu acesso", icon: <KeyRound /> },
  ];
  return (
    <nav className="mt-7 grid grid-cols-4 gap-2" aria-label="Etapas do cadastro">
      {steps.map((item) => {
        const complete = item.id < stage || item.id < maxStage;
        const current = item.id === stage;
        const enabled = item.id <= maxStage;
        return (
          <button
            key={item.id}
            type="button"
            disabled={!enabled}
            onClick={() => onSelect(item.id)}
            className={`group min-w-0 rounded-xl border px-2 py-2.5 text-left transition sm:px-3 ${
              current
                ? "border-white/65 bg-white/15 text-white"
                : complete
                  ? "border-white/25 bg-white/10 text-white"
                  : "border-white/10 bg-white/5 text-white/45"
            }`}
          >
            <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em] sm:text-xs">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white/10 [&>svg]:size-3.5">
                {complete && !current ? <Check /> : item.icon}
              </span>
              <span className="truncate">{item.label}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function ProposalStage({
  journey,
  loading,
  error,
  acceptName,
  agreed,
  accepting,
  onAcceptName,
  onAgree,
  onAccept,
  onContinue,
}: {
  journey: OwnerJourneyProposal | null;
  loading: boolean;
  error: boolean;
  acceptName: string;
  agreed: boolean;
  accepting: boolean;
  onAcceptName: (value: string) => void;
  onAgree: (value: boolean) => void;
  onAccept: () => void;
  onContinue: () => void;
}) {
  if (loading)
    return <StageLoading text="Estamos carregando a versão da proposta vinculada a este acesso." />;
  if (error)
    return (
      <StageBlocked
        title="Não conseguimos abrir a proposta agora"
        text="Nada foi alterado. Tente novamente em instantes ou fale com a equipe STAYO."
      />
    );
  if (!journey)
    return (
      <StageBlocked
        title="Sua proposta ainda está sendo preparada"
        text="Este cadastro já está reservado para você, mas a equipe STAYO ainda precisa vincular a versão da proposta. Assim que ela estiver pronta, este mesmo link será o ponto de partida."
      />
    );

  const accepted = Boolean(journey.proposal.acceptedAt);
  const terms = [...journey.commercialTerms].sort((a, b) => a.displayOrder - b.displayOrder);
  return (
    <section className="space-y-5">
      <StageHeading
        eyebrow={`Proposta comercial · versão ${journey.proposal.version}`}
        title="Confira o que combinamos"
        text="Este é o resumo comercial da implantação e da gestão do seu imóvel. A versão apresentada aqui fica registrada e não muda se uma nova proposta for criada depois."
      />

      {terms.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {terms.map((term) => (
            <CommercialTermCard key={term.id} term={term} />
          ))}
        </div>
      )}

      {journey.proposal.items.length > 0 && (
        <div className="rounded-2xl border border-[var(--portal-border)] bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <strong className="text-sm">Itens desta versão</strong>
            <span className="text-sm font-semibold text-[var(--portal-navy)]">
              {money.format(journey.proposal.total)}
            </span>
          </div>
          <div className="divide-y divide-[var(--portal-border)]">
            {journey.proposal.items.map((item, index) => (
              <div key={`${item.description}-${index}`} className="flex items-start justify-between gap-4 py-2.5 text-sm">
                <span>
                  {item.description}
                  {item.quantity > 1 && (
                    <small className="ml-1 text-[var(--portal-muted)]">x{item.quantity}</small>
                  )}
                </span>
                <span className="shrink-0 font-medium">{money.format(item.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {journey.contractConditions && (
        <div className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-4">
          <strong className="text-sm">Condições operacionais</strong>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <SummaryRow label="Repasse" value={journey.contractConditions.payoutRule} />
            <SummaryRow
              label="Manutenção sem autorização"
              value={
                journey.contractConditions.maintenanceLimit === null
                  ? null
                  : `Até ${money.format(journey.contractConditions.maintenanceLimit)}`
              }
            />
            <SummaryRow
              label="Exclusividade"
              value={
                journey.contractConditions.exclusivity === null
                  ? null
                  : journey.contractConditions.exclusivity
                    ? "Sim"
                    : "Não"
              }
            />
            <SummaryRow
              label="Vigência"
              value={
                journey.contractConditions.durationMonths === null
                  ? null
                  : `${journey.contractConditions.durationMonths} meses`
              }
            />
            <SummaryRow
              label="Aviso prévio"
              value={
                journey.contractConditions.noticePeriodDays === null
                  ? null
                  : `${journey.contractConditions.noticePeriodDays} dias`
              }
            />
          </div>
        </div>
      )}

      {accepted ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700" />
            <div>
              <strong className="text-sm text-emerald-950">Proposta aceita</strong>
              <p className="mt-1 text-xs text-emerald-800">
                Aceite registrado{journey.proposal.acceptedName ? ` por ${journey.proposal.acceptedName}` : ""}
                {journey.proposal.acceptedAt
                  ? ` em ${new Date(journey.proposal.acceptedAt).toLocaleString("pt-BR")}`
                  : ""}.
              </p>
            </div>
          </div>
          <Button type="button" className="mt-4 w-full" onClick={onContinue}>
            Continuar para meus dados <ChevronRight className="size-4" />
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--portal-border)] bg-white p-4 sm:p-5">
          <strong className="text-sm">Confirme para continuar</strong>
          <p className="mt-1 text-xs text-[var(--portal-muted)]">
            Este aceite registra sua concordância comercial com esta versão. O contrato formal continua sendo tratado separadamente pela equipe STAYO.
          </p>
          <div className="mt-4 space-y-3">
            <TextField
              label="Nome completo para confirmação"
              value={acceptName}
              onChange={onAcceptName}
              placeholder="Digite seu nome completo"
            />
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--portal-border)] p-3 text-sm">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(event) => onAgree(event.target.checked)}
                className="mt-0.5 size-4"
              />
              <span>Li a proposta e estou de acordo com as condições apresentadas.</span>
            </label>
            <Button
              type="button"
              className="w-full"
              disabled={accepting || !agreed || acceptName.trim().length < 3}
              onClick={onAccept}
            >
              {accepting ? "Registrando aceite..." : "Aceitar proposta e continuar"}
              {!accepting && <ChevronRight className="size-4" />}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function CommercialTermCard({ term }: { term: CommercialTerm }) {
  return (
    <div className="rounded-2xl border border-[var(--portal-border)] bg-white p-4">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--portal-muted)]">
        {term.label}
      </span>
      <strong className="mt-1 block text-lg text-[var(--portal-navy)]">{formatCommercialTerm(term)}</strong>
      {term.notes && <p className="mt-1 text-xs text-[var(--portal-muted)]">{term.notes}</p>}
    </div>
  );
}

function formatCommercialTerm(term: CommercialTerm) {
  switch (term.chargeType) {
    case "percentage":
      return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(term.value)}%`;
    case "fixed_once":
      return `${money.format(term.value)} · uma vez`;
    case "per_reservation":
      return `${money.format(term.value)} · por reserva`;
    case "monthly":
      return `${money.format(term.value)} · por mês`;
    case "optional":
      return term.value ? `${money.format(term.value)} · opcional` : "Opcional";
    case "informational":
      return term.notes || "Condição informativa";
    default:
      return String(term.value);
  }
}

function OwnerDataStage({
  form,
  people,
  showErrors,
  onSet,
  onUpdatePerson,
  onAddPerson,
  onRemovePerson,
  onBack,
  onContinue,
}: {
  form: OwnerOnboardingSubmissionInput;
  people: OwnerOnboardingPerson[];
  showErrors: boolean;
  onSet: <K extends keyof OwnerOnboardingSubmissionInput>(key: K, value: OwnerOnboardingSubmissionInput[K]) => void;
  onUpdatePerson: (index: number, patch: Partial<OwnerOnboardingPerson>) => void;
  onAddPerson: () => void;
  onRemovePerson: (index: number) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const fieldError = (field: OwnerFormField) =>
    showErrors ? validateOwnerField(field, form[field]) : undefined;
  const primary = people[0];
  return (
    <section className="space-y-6">
      <StageHeading
        eyebrow="Etapa 2 de 4"
        title="Conte um pouco sobre você"
        text="Usaremos estes dados para preparar a implantação, os repasses e o relacionamento com a STAYO."
      />

      <FormSection title="Identificação" icon={<UserRound />} text="Comece pelo proprietário principal. Se houver coproprietário ou proponente, adicione abaixo.">
        <div className="space-y-3">
          {people.map((person, index) => (
            <PersonCard
              key={index}
              person={person}
              index={index}
              showErrors={showErrors}
              onChange={(patch) => onUpdatePerson(index, patch)}
              onRemove={index > 0 ? () => onRemovePerson(index) : undefined}
            />
          ))}
        </div>
        <Button type="button" variant="outline" className="w-full" onClick={onAddPerson}>
          <Plus className="size-4" /> Adicionar coproprietário ou proponente
        </Button>
      </FormSection>

      <FormSection title="Contato" text="Este será também o e-mail sugerido para seu acesso ao portal.">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="E-mail"
            type="email"
            value={form.email}
            onChange={(value) => {
              onSet("email", value);
              if (primary) onUpdatePerson(0, { email: value });
            }}
            error={fieldError("email")}
          />
          <TextField
            label="WhatsApp ou telefone"
            inputMode="tel"
            value={formatBrazilianPhone(form.phone)}
            onChange={(value) => {
              const phone = formatBrazilianPhone(value);
              onSet("phone", phone);
              if (primary) onUpdatePerson(0, { phone });
            }}
            error={fieldError("phone")}
          />
        </div>
      </FormSection>

      <FormSection title="Seu endereço" text="Este é o endereço do proprietário, não o endereço do imóvel que será administrado.">
        <div className="grid gap-3 sm:grid-cols-6">
          <TextField
            className="sm:col-span-2"
            label="CEP"
            inputMode="numeric"
            value={formatBrazilianPostalCode(form.postalCode)}
            onChange={(value) => onSet("postalCode", formatBrazilianPostalCode(value))}
            onBlur={() => void lookupPostalCode(form.postalCode, onSet, false)}
            error={fieldError("postalCode")}
          />
          <TextField
            className="sm:col-span-4"
            label="Endereço"
            value={form.street}
            onChange={(value) => onSet("street", value)}
            error={fieldError("street")}
          />
          <TextField
            className="sm:col-span-2"
            label="Número"
            value={form.number}
            onChange={(value) => onSet("number", value)}
            error={fieldError("number")}
          />
          <TextField
            className="sm:col-span-4"
            label="Complemento (opcional)"
            value={form.complement ?? ""}
            onChange={(value) => onSet("complement", value || null)}
          />
          <TextField
            className="sm:col-span-3"
            label="Bairro"
            value={form.district}
            onChange={(value) => onSet("district", value)}
            error={fieldError("district")}
          />
          <TextField
            className="sm:col-span-2"
            label="Cidade"
            value={form.city}
            onChange={(value) => onSet("city", value)}
            error={fieldError("city")}
          />
          <TextField
            className="sm:col-span-1"
            label="UF"
            value={form.state}
            onChange={(value) => onSet("state", value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))}
            error={fieldError("state")}
          />
        </div>
      </FormSection>

      <FormSection
        title="Dados para repasse"
        icon={<LockKeyhole />}
        text="Informações financeiras ficam restritas à equipe autorizada e são confirmadas antes do primeiro repasse."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            label="Banco"
            value={form.bankName}
            onChange={(value) => onSet("bankName", value)}
            error={fieldError("bankName")}
            options={BRAZILIAN_BANKS.map((bank) => ({ value: bank, label: bank }))}
            placeholder="Selecione o banco"
          />
          <SelectField
            label="Tipo de conta"
            value={form.accountType}
            onChange={(value) => onSet("accountType", value as OwnerOnboardingSubmissionInput["accountType"])}
            error={fieldError("accountType")}
            options={[...ACCOUNT_TYPES]}
          />
          <TextField
            label="Agência"
            value={form.bankBranch}
            onChange={(value) => onSet("bankBranch", value)}
            error={fieldError("bankBranch")}
          />
          <TextField
            label="Conta com dígito"
            value={form.accountNumber}
            onChange={(value) => onSet("accountNumber", value)}
            error={fieldError("accountNumber")}
          />
          <TextField
            label="Titular da conta"
            value={form.accountHolder}
            onChange={(value) => onSet("accountHolder", value)}
            error={fieldError("accountHolder")}
          />
          <TextField
            label="CPF/CNPJ do titular"
            inputMode="numeric"
            value={formatBrazilianDocument(form.holderTaxId)}
            onChange={(value) => onSet("holderTaxId", formatBrazilianDocument(value))}
            error={fieldError("holderTaxId")}
          />
          <SelectField
            label="Tipo da chave Pix"
            value={form.pixType}
            onChange={(value) => {
              const type = value as OwnerOnboardingSubmissionInput["pixType"];
              onSet("pixType", type);
              if (primary && type !== "random") onSet("pixKey", suggestPixKey(primary, type));
              if (type === "random") onSet("pixKey", "");
            }}
            error={fieldError("pixType")}
            options={[...PIX_KEY_TYPES]}
          />
          <TextField
            label="Chave Pix"
            value={form.pixKey}
            onChange={(value) => onSet("pixKey", value)}
            error={fieldError("pixKey")}
          />
        </div>
      </FormSection>

      <StageActions onBack={onBack} onContinue={onContinue} continueLabel="Continuar para o imóvel" />
    </section>
  );
}

function PersonCard({
  person,
  index,
  showErrors,
  onChange,
  onRemove,
}: {
  person: OwnerOnboardingPerson;
  index: number;
  showErrors: boolean;
  onChange: (patch: Partial<OwnerOnboardingPerson>) => void;
  onRemove?: () => void;
}) {
  const nameError = showErrors ? validateOwnerField("fullName", person.fullName) : undefined;
  const documentError = showErrors ? validateOwnerField("document", person.document) : undefined;
  return (
    <div className="rounded-2xl border border-[var(--portal-border)] bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <strong className="text-sm">{index === 0 ? "Proprietário principal" : `Pessoa ${index + 1}`}</strong>
          <p className="mt-0.5 text-xs text-[var(--portal-muted)]">
            {index === 0 ? "Responsável principal pela jornada" : "Coproprietário ou proponente"}
          </p>
        </div>
        {onRemove && (
          <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label="Remover pessoa">
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {index > 0 && (
          <SelectField
            label="Participação"
            value={person.role}
            onChange={(value) => onChange({ role: value as OwnerOnboardingPerson["role"] })}
            options={[
              { value: "coproprietario", label: "Coproprietário" },
              { value: "proponente", label: "Proponente" },
            ]}
          />
        )}
        <SelectField
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
          inputMode="numeric"
          value={formatBrazilianDocument(person.document)}
          onChange={(value) => onChange({ document: formatBrazilianDocument(value) })}
          error={documentError}
        />
        {index > 0 && (
          <>
            <TextField
              label="E-mail (opcional)"
              type="email"
              value={person.email}
              onChange={(value) => onChange({ email: value })}
              error={showErrors && person.email ? validateOwnerField("email", person.email) : undefined}
            />
            <TextField
              label="Telefone (opcional)"
              inputMode="tel"
              value={formatBrazilianPhone(person.phone)}
              onChange={(value) => onChange({ phone: formatBrazilianPhone(value) })}
              error={showErrors && person.phone ? validateOwnerField("phone", person.phone) : undefined}
            />
          </>
        )}
      </div>
    </div>
  );
}

function PropertyStage({
  form,
  implementationName,
  errors,
  finishing,
  onSet,
  onBack,
  onContinue,
}: {
  form: OwnerOnboardingSubmissionInput;
  implementationName: string | null;
  errors: Record<string, string>;
  finishing: boolean;
  onSet: <K extends keyof OwnerOnboardingSubmissionInput>(key: K, value: OwnerOnboardingSubmissionInput[K]) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const numeric = (
    key: "propertyBedrooms" | "propertySuites" | "propertyBathrooms" | "propertyParkingSpots",
    value: string,
  ) => onSet(key, value === "" ? null : Math.max(0, Number.parseInt(value, 10) || 0));
  return (
    <section className="space-y-6">
      <StageHeading
        eyebrow="Etapa 3 de 4"
        title="Agora, seu imóvel"
        text="Estas informações iniciam a ficha de implantação. A equipe STAYO valida os dados antes de qualquer uso operacional ou publicação no Guia do Hóspede."
      />

      {implementationName && (
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-4">
          <Building2 className="size-5 text-[var(--portal-navy)]" />
          <div>
            <span className="text-xs text-[var(--portal-muted)]">Pré-cadastro STAYO</span>
            <strong className="block text-sm">{implementationName}</strong>
          </div>
        </div>
      )}

      <FormSection title="Localização" icon={<Home />} text="Se o endereço já veio preenchido pela STAYO, confira e complete o que estiver faltando.">
        <div className="grid gap-3 sm:grid-cols-6">
          <TextField
            className="sm:col-span-2"
            label="CEP do imóvel"
            inputMode="numeric"
            value={formatBrazilianPostalCode(form.propertyPostalCode)}
            onChange={(value) => onSet("propertyPostalCode", formatBrazilianPostalCode(value))}
            onBlur={() => void lookupPostalCode(form.propertyPostalCode, onSet, true)}
            error={errors.propertyPostalCode}
          />
          <TextField
            className="sm:col-span-4"
            label="Endereço"
            value={form.propertyStreet}
            onChange={(value) => onSet("propertyStreet", value)}
            error={errors.propertyStreet}
          />
          <TextField
            className="sm:col-span-2"
            label="Número / unidade"
            value={form.propertyNumber}
            onChange={(value) => onSet("propertyNumber", value)}
            error={errors.propertyNumber}
          />
          <TextField
            className="sm:col-span-4"
            label="Complemento (opcional)"
            value={form.propertyComplement ?? ""}
            onChange={(value) => onSet("propertyComplement", value || null)}
          />
          <TextField
            className="sm:col-span-3"
            label="Bairro"
            value={form.propertyDistrict}
            onChange={(value) => onSet("propertyDistrict", value)}
            error={errors.propertyDistrict}
          />
          <TextField
            className="sm:col-span-2"
            label="Cidade"
            value={form.propertyCity}
            onChange={(value) => onSet("propertyCity", value)}
            error={errors.propertyCity}
          />
          <TextField
            className="sm:col-span-1"
            label="UF"
            value={form.propertyState}
            onChange={(value) => onSet("propertyState", value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))}
            error={errors.propertyState}
          />
        </div>
      </FormSection>

      <FormSection title="Características" text="Uma visão inicial é suficiente; a vistoria e a implantação completam a ficha depois.">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Tipo do imóvel"
            value={form.propertyType}
            onChange={(value) => onSet("propertyType", value)}
            placeholder="Ex.: Apartamento"
            error={errors.propertyType}
          />
          <NumberField label="Dormitórios" value={form.propertyBedrooms} onChange={(value) => numeric("propertyBedrooms", value)} />
          <NumberField label="Suítes" value={form.propertySuites} onChange={(value) => numeric("propertySuites", value)} />
          <NumberField label="Banheiros" value={form.propertyBathrooms} onChange={(value) => numeric("propertyBathrooms", value)} />
          <NumberField label="Vagas" value={form.propertyParkingSpots} onChange={(value) => numeric("propertyParkingSpots", value)} />
        </div>
      </FormSection>

      <FormSection title="Acesso e informações operacionais" icon={<KeyRound />} text="Preencha apenas o que já souber. Senhas e códigos são tratados como informação restrita e não são publicados automaticamente.">
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            label="Forma de acesso"
            value={form.propertyAccessType ?? ""}
            onChange={(value) => onSet("propertyAccessType", (value || null) as OwnerOnboardingSubmissionInput["propertyAccessType"])}
            options={[
              { value: "key", label: "Chave" },
              { value: "lock", label: "Fechadura" },
              { value: "concierge", label: "Portaria" },
              { value: "other", label: "Outro" },
            ]}
            placeholder="Selecione"
          />
          <TextField
            label="Orientações de acesso (opcional)"
            value={form.propertyAccessNotes}
            onChange={(value) => onSet("propertyAccessNotes", value)}
          />
          {form.propertyAccessType === "lock" && (
            <TextField
              label="Código da fechadura (opcional)"
              type="password"
              value={form.propertyAccessCode}
              onChange={(value) => onSet("propertyAccessCode", value)}
            />
          )}
          <TextField
            label="Rede Wi-Fi (opcional)"
            value={form.propertyWifiNetwork}
            onChange={(value) => onSet("propertyWifiNetwork", value)}
          />
          <TextField
            label="Senha do Wi-Fi (opcional)"
            type="password"
            value={form.propertyWifiPassword}
            onChange={(value) => onSet("propertyWifiPassword", value)}
          />
        </div>
      </FormSection>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
        <strong className="block">Importante</strong>
        <p className="mt-1">
          Dados enviados aqui alimentam a implantação administrativa. Nada é publicado automaticamente no Guia do Hóspede sem revisão da equipe STAYO.
        </p>
      </div>

      <StageActions
        onBack={onBack}
        onContinue={onContinue}
        continueLabel={finishing ? "Enviando cadastro..." : "Finalizar cadastro e criar acesso"}
        disabled={finishing}
      />
    </section>
  );
}

function AccessStage({
  email,
  password,
  passwordConfirmation,
  creating,
  accountState,
  supabaseReady,
  onPassword,
  onPasswordConfirmation,
  onCreate,
  onBack,
  onEnterPortal,
}: {
  email: string;
  password: string;
  passwordConfirmation: string;
  creating: boolean;
  accountState: "idle" | "confirmation_required" | "linked";
  supabaseReady: boolean;
  onPassword: (value: string) => void;
  onPasswordConfirmation: (value: string) => void;
  onCreate: () => void;
  onBack: () => void;
  onEnterPortal: () => void;
}) {
  return (
    <section className="space-y-6">
      <StageHeading
        eyebrow="Etapa 4 de 4"
        title="Seu acesso à STAYO"
        text="Proposta aceita e cadastro recebido. Agora crie sua senha para acompanhar a implantação e, depois, a operação do imóvel."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <CompletionCard label="Proposta" text="Aceita" />
        <CompletionCard label="Seus dados" text="Recebidos" />
        <CompletionCard label="Seu imóvel" text="Recebido" />
      </div>

      {!supabaseReady ? (
        <StageBlocked
          title="Cadastro concluído"
          text="O ambiente atual ainda não está conectado ao serviço de autenticação. Seus dados foram preservados; a equipe STAYO poderá liberar seu acesso assim que o serviço estiver disponível."
        />
      ) : accountState === "confirmation_required" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <CheckCircle2 className="mx-auto size-8 text-emerald-700" />
          <strong className="mt-3 block text-emerald-950">Confirme seu e-mail</strong>
          <p className="mt-1 text-sm text-emerald-800">
            Enviamos a confirmação para {email}. Depois de confirmar, volte por este mesmo acesso ou entre no Portal do Proprietário.
          </p>
        </div>
      ) : accountState === "linked" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <CheckCircle2 className="mx-auto size-8 text-emerald-700" />
          <strong className="mt-3 block text-emerald-950">Tudo pronto</strong>
          <Button type="button" className="mt-4 w-full" onClick={onEnterPortal}>
            Entrar no Portal do Proprietário
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--portal-border)] bg-white p-4 sm:p-5">
          <div className="mb-4 flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--portal-surface-soft)] text-[var(--portal-navy)]">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <strong className="text-sm">Crie sua senha</strong>
              <p className="mt-1 text-xs text-[var(--portal-muted)]">
                O acesso será vinculado ao mesmo proprietário deste cadastro.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <TextField label="E-mail" type="email" value={email} onChange={() => undefined} disabled />
            <TextField
              label="Crie uma senha"
              type="password"
              value={password}
              onChange={onPassword}
              hint="Use pelo menos 8 caracteres."
            />
            <TextField
              label="Confirme a senha"
              type="password"
              value={passwordConfirmation}
              onChange={onPasswordConfirmation}
              error={
                passwordConfirmation && password !== passwordConfirmation
                  ? "As senhas não coincidem."
                  : undefined
              }
            />
            <Button
              type="button"
              className="w-full"
              disabled={creating || password.length < 8 || password !== passwordConfirmation}
              onClick={onCreate}
            >
              {creating ? "Preparando acesso..." : "Criar meu acesso"}
              {!creating && <KeyRound className="size-4" />}
            </Button>
          </div>
        </div>
      )}

      <Button type="button" variant="ghost" onClick={onBack} className="w-full">
        <ChevronLeft className="size-4" /> Voltar aos dados do imóvel
      </Button>
    </section>
  );
}

function CompletionCard({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="size-4 text-emerald-700" />
        <span className="text-xs font-medium text-emerald-950">{label}</span>
      </div>
      <span className="mt-1 block text-xs text-emerald-800">{text}</span>
    </div>
  );
}

function FormSection({
  title,
  text,
  icon,
  children,
}: {
  title: string;
  text: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-[var(--portal-border)] bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--portal-surface-soft)] text-[var(--portal-navy)] [&>svg]:size-4">
            {icon}
          </div>
        )}
        <div>
          <strong className="text-sm">{title}</strong>
          <p className="mt-1 text-xs leading-relaxed text-[var(--portal-muted)]">{text}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function StageHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div>
      <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--portal-muted)]">
        {eyebrow}
      </span>
      <h2 className="mt-1 text-xl font-semibold text-[var(--portal-navy)] sm:text-2xl">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--portal-muted)]">{text}</p>
    </div>
  );
}

function StageActions({
  onBack,
  onContinue,
  continueLabel,
  disabled,
}: {
  onBack: () => void;
  onContinue: () => void;
  continueLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-[var(--portal-border)] pt-5 sm:flex-row sm:justify-between">
      <Button type="button" variant="ghost" onClick={onBack} disabled={disabled}>
        <ChevronLeft className="size-4" /> Voltar
      </Button>
      <Button type="button" onClick={onContinue} disabled={disabled}>
        {continueLabel} {!disabled && <ChevronRight className="size-4" />}
      </Button>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  onBlur,
  type = "text",
  inputMode,
  placeholder,
  error,
  hint,
  className,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  placeholder?: string;
  error?: string;
  hint?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`block text-sm ${className ?? ""}`}>
      <span className="mb-1.5 block text-xs font-medium text-[var(--portal-muted)]">{label}</span>
      <input
        className="portal-input w-full rounded-xl px-3 py-2.5 disabled:cursor-not-allowed disabled:opacity-65"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        inputMode={inputMode}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        disabled={disabled}
      />
      {error ? (
        <span className="mt-1 block text-xs text-[var(--portal-danger)]">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[11px] text-[var(--portal-muted)]">{hint}</span>
      ) : null}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: string) => void;
}) {
  return (
    <TextField
      label={label}
      type="number"
      inputMode="numeric"
      value={value === null ? "" : String(value)}
      onChange={onChange}
    />
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  placeholder?: string;
  error?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-xs font-medium text-[var(--portal-muted)]">{label}</span>
      <select
        className="portal-input w-full rounded-xl px-3 py-2.5"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <span className="mt-1 block text-xs text-[var(--portal-danger)]">{error}</span>}
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="rounded-xl bg-white/70 px-3 py-2">
      <span className="block text-[10px] uppercase tracking-[0.08em] text-[var(--portal-muted)]">{label}</span>
      <strong className="mt-0.5 block text-xs">{value}</strong>
    </div>
  );
}

function StageLoading({ text }: { text: string }) {
  return (
    <div className="py-10 text-center">
      <Cloud className="mx-auto size-7 animate-pulse text-[var(--portal-muted)]" />
      <p className="mt-3 text-sm text-[var(--portal-muted)]">{text}</p>
    </div>
  );
}

function StageBlocked({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-5 text-center">
      <LockKeyhole className="mx-auto size-7 text-[var(--portal-navy)]" />
      <strong className="mt-3 block text-sm">{title}</strong>
      <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-[var(--portal-muted)]">{text}</p>
    </div>
  );
}

function journeyHeadline(stage: Stage) {
  if (stage === 1) return "Antes de começar, confira sua proposta";
  if (stage === 2) return "Vamos preparar seu cadastro";
  if (stage === 3) return "Conte-nos sobre o seu imóvel";
  return "Último passo: seu acesso";
}

function validateProperty(form: OwnerOnboardingSubmissionInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (form.propertyPostalCode && form.propertyPostalCode.replace(/\D/g, "").length !== 8)
    errors.propertyPostalCode = "Confira o CEP informado.";
  if (form.propertyStreet.trim().length < 2) errors.propertyStreet = "Informe o endereço do imóvel.";
  if (!form.propertyNumber.trim()) errors.propertyNumber = "Informe o número ou unidade.";
  if (form.propertyDistrict.trim().length < 2) errors.propertyDistrict = "Informe o bairro.";
  if (form.propertyCity.trim().length < 2) errors.propertyCity = "Informe a cidade.";
  if (form.propertyState.trim().length !== 2) errors.propertyState = "Informe a UF.";
  if (form.propertyType.trim().length < 2) errors.propertyType = "Informe o tipo do imóvel.";
  return errors;
}

async function lookupPostalCode(
  value: string,
  set: <K extends keyof OwnerOnboardingSubmissionInput>(
    key: K,
    value: OwnerOnboardingSubmissionInput[K],
  ) => void,
  property: boolean,
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
    if (data.erro) return;
    if (property) {
      set("propertyStreet", data.logradouro ?? "");
      set("propertyDistrict", data.bairro ?? "");
      set("propertyCity", data.localidade ?? "");
      set("propertyState", data.uf ?? "");
    } else {
      set("street", data.logradouro ?? "");
      set("district", data.bairro ?? "");
      set("city", data.localidade ?? "");
      set("state", data.uf ?? "");
    }
    toast.success("Endereço encontrado");
  } catch {
    toast.info("Preencha o endereço manualmente", {
      description: "A busca do CEP está indisponível no momento.",
    });
  }
}

function ownerErrorMessage(cause: unknown): string {
  const message = cause instanceof Error ? cause.message.toLocaleLowerCase("pt-BR") : "";
  if (message.includes("cpf") || message.includes("cnpj") || message.includes("documento"))
    return "Confira o CPF ou CNPJ informado.";
  if (message.includes("telefone")) return "Confira o telefone e o DDD.";
  if (message.includes("e-mail") || message.includes("email")) return "Confira o e-mail informado.";
  if (message.includes("repasse") || message.includes("pix") || message.includes("conta"))
    return "Confira os dados de repasse.";
  return "Há um dado obrigatório ainda incompleto. Revise as etapas anteriores.";
}

function accountErrorMessage(cause: unknown): string {
  const message = cause instanceof Error ? cause.message.toLocaleLowerCase("pt-BR") : "";
  if (message.includes("8 caracteres")) return "A senha precisa ter pelo menos 8 caracteres.";
  if (message.includes("não coincidem")) return "Digite a mesma senha nos dois campos.";
  if (message.includes("already registered") || message.includes("já possui"))
    return "Este e-mail já possui acesso. Use a senha criada anteriormente ou recupere seu acesso.";
  if (message.includes("email not confirmed")) return "Confirme o e-mail recebido antes de entrar.";
  if (message.includes("mesmo e-mail")) return "Use o mesmo e-mail informado no cadastro.";
  return "Tente novamente em alguns instantes.";
}
