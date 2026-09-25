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
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { StayoLogo } from "../brand/StayoLogo";
import institutionalCover from "../../assets/owner-portal-property-fallback.jpg";
import { useOwnerCoverByToken } from "../../hooks/use-owner-cover";
import { Button } from "../ui/button";
import { ACCOUNT_TYPES, BRAZILIAN_BANKS, PIX_KEY_TYPES } from "../../config/payment-data";
import { ownerJourneyApi, type OwnerJourneyProposal } from "../../lib/api/owner-journey";
import {
  adminApi,
  implementationQuery,
  ownerOnboardingSubmissionQuery,
  ownerQuery,
} from "../../lib/api/queries";
import { createOwnerAccountAndLink, isSupabaseConfigured } from "../../lib/auth/owner-session";
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
import type { CommercialTerm } from "../../types/admin";
import type {
  OwnerOnboardingPerson,
  OwnerOnboardingSubmissionInput,
} from "../../types/owner-onboarding";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const STEP = { owner: 20, property: 30, access: 40 } as const;
type Stage = 1 | 2 | 3 | 4;

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

const ownerFields: OwnerFormField[] = [
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

interface PropertyErrors {
  propertyPostalCode?: string | undefined;
  propertyStreet?: string | undefined;
  propertyNumber?: string | undefined;
  propertyDistrict?: string | undefined;
  propertyCity?: string | undefined;
  propertyState?: string | undefined;
  propertyType?: string | undefined;
}

export function OwnerJourney({
  implementationId,
  token,
}: {
  implementationId: string;
  token: string;
}) {
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

  const coverQ = useOwnerCoverByToken(token);
  const [coverBroken, setCoverBroken] = useState(false);
  const coverData = coverBroken ? null : (coverQ.data ?? null);
  const [form, setForm] = useState<OwnerOnboardingSubmissionInput>(emptyForm);
  const [stage, setStage] = useState<Stage>(1);
  const [maxStage, setMaxStage] = useState<Stage>(1);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [showOwnerErrors, setShowOwnerErrors] = useState(false);
  const [showPropertyErrors, setShowPropertyErrors] = useState(false);
  const [acceptName, setAcceptName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [accountState, setAccountState] = useState<"idle" | "confirmation_required" | "linked">(
    "idle",
  );

  const hydrated = useRef(false);
  const formRef = useRef(form);
  const stageRef = useRef<Stage>(stage);
  const maxStageRef = useRef<Stage>(maxStage);
  const lastSaved = useRef("");
  const queue = useRef<Promise<void>>(Promise.resolve());
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
      journeyQ.isPending ||
      (ownerId !== null && ownerQ.isPending)
    )
      return;

    const owner = ownerQ.data;
    const implementation = implementationQ.data;
    const primary: OwnerOnboardingPerson = {
      role: "proprietario",
      personType: "pf",
      fullName: owner?.name ?? "",
      document: owner?.document ?? "",
      email: owner?.email ?? "",
      phone: owner?.phone ?? "",
    };
    const initial: OwnerOnboardingSubmissionInput = draftQ.data
      ? { ...emptyForm, ...draftQ.data }
      : {
          ...emptyForm,
          fullName: primary.fullName,
          document: primary.document,
          email: primary.email,
          phone: primary.phone,
          accountHolder: primary.fullName,
          holderTaxId: primary.document,
          people: [primary],
          propertyPostalCode: implementation?.postalCode ?? "",
          propertyStreet: implementation?.address ?? "",
          propertyCity: implementation?.city ?? "",
          propertyType: implementation?.propertyType ?? "",
          propertyBedrooms: implementation?.bedrooms ?? null,
        };
    if (initial.people.length === 0) initial.people = [primary];

    let reached: Stage = 1;
    let current: Stage = 1;
    const savedStep = draftQ.data?.currentStep ?? 0;
    if (proposalAccepted) {
      reached = 2;
      current = 2;
      if (savedStep >= STEP.property) {
        reached = 3;
        current = 3;
      }
      if (submitted || savedStep >= STEP.access) {
        reached = 4;
        current = 4;
      }
    }

    setForm(initial);
    formRef.current = initial;
    lastSaved.current = JSON.stringify(initial);
    setStage(current);
    stageRef.current = current;
    setMaxStage(reached);
    maxStageRef.current = reached;
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

  const persist = useCallback(
    (snapshot: OwnerOnboardingSubmissionInput, target: Stage) => {
      const signature = JSON.stringify(snapshot);
      if (
        !hydrated.current ||
        finalizing.current ||
        target < 2 ||
        !proposalAccepted ||
        submitted ||
        snapshot.people.length === 0 ||
        signature === lastSaved.current
      )
        return queue.current;

      setSaveState("saving");
      const code = target >= 3 ? STEP.property : STEP.owner;
      queue.current = queue.current
        .catch(() => undefined)
        .then(async () => {
          const saved = await adminApi.ownerOnboarding.saveDraft(token, snapshot, code, false);
          lastSaved.current = signature;
          queryClient.setQueryData(["owner-onboarding-draft", token], saved);
          queryClient.setQueryData(
            ownerOnboardingSubmissionQuery(implementationId).queryKey,
            saved,
          );
          setSaveState("saved");
        })
        .catch(() => setSaveState("error"));
      return queue.current;
    },
    [implementationId, proposalAccepted, queryClient, submitted, token],
  );

  useEffect(() => {
    if (!hydrated.current || stage < 2 || submitted || finalizing.current) return;
    const timer = window.setTimeout(() => void persist(form, stage), 900);
    return () => window.clearTimeout(timer);
  }, [form, persist, stage, submitted]);

  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden" && !finalizing.current)
        void persist(formRef.current, stageRef.current);
    };
    const flushOnExit = () => {
      if (!finalizing.current) void persist(formRef.current, stageRef.current);
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flushOnExit);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flushOnExit);
    };
  }, [persist]);

  const set = <K extends keyof OwnerOnboardingSubmissionInput>(
    key: K,
    value: OwnerOnboardingSubmissionInput[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const people = form.people.length > 0 ? form.people : emptyForm.people;
  const updatePerson = (index: number, patch: Partial<OwnerOnboardingPerson>) => {
    setForm((current) => {
      const nextPeople = current.people.map((person, position) =>
        position === index ? { ...person, ...patch } : person,
      );
      const primary = nextPeople[0];
      if (!primary) return { ...current, people: nextPeople };
      return {
        ...current,
        people: nextPeople,
        personType: primary.personType,
        fullName: primary.fullName,
        document: primary.document,
        email: primary.email || current.email,
        phone: primary.phone || current.phone,
      };
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
      people: current.people.filter((_, position) => position !== index),
    }));

  useEffect(() => {
    const primary = people[0];
    if (!primary) return;
    setForm((current) => {
      const next = { ...current };
      let changed = false;
      if (!current.accountHolder && primary.fullName) {
        next.accountHolder = primary.fullName;
        changed = true;
      }
      if (!current.holderTaxId && primary.document) {
        next.holderTaxId = primary.document;
        changed = true;
      }
      if (!current.pixKey && current.pixType !== "random") {
        const suggestion = suggestPixKey(primary, current.pixType);
        if (suggestion) {
          next.pixKey = suggestion;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [people]);

  const ownerValid = useMemo(() => {
    if (!ownerFields.every((field) => !validateOwnerField(field, form[field]))) return false;
    return people.every(
      (person) =>
        Boolean(person.fullName) &&
        !validateOwnerField("fullName", person.fullName) &&
        !validateOwnerField("document", person.document) &&
        (!person.email || !validateOwnerField("email", person.email)) &&
        (!person.phone || !validateOwnerField("phone", person.phone)),
    );
  }, [form, people]);

  const propertyErrors = useMemo(() => getPropertyErrors(form), [form]);
  const propertyValid = Object.keys(propertyErrors).length === 0;

  const acceptProposal = useMutation({
    mutationFn: () => ownerJourneyApi.acceptProposal(token, acceptName.trim()),
    onSuccess: (journey) => {
      queryClient.setQueryData(["owner-journey", "proposal", token], journey);
      setMaxStage((value) => (value < 2 ? 2 : value));
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

  const finish = useMutation({
    mutationFn: async () => {
      const parsed = ownerOnboardingFormSchema.parse(form);
      finalizing.current = true;
      await queue.current;
      return adminApi.ownerOnboarding.saveDraft(
        token,
        normalizeOwnerSubmission(parsed),
        STEP.access,
        true,
      );
    },
    onSuccess: (submission) => {
      queryClient.setQueryData(["owner-onboarding-draft", token], submission);
      queryClient.setQueryData(
        ownerOnboardingSubmissionQuery(implementationId).queryKey,
        submission,
      );
      lastSaved.current = JSON.stringify(form);
      setSaveState("saved");
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
      if (password !== passwordAgain) throw new Error("As senhas não coincidem.");
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
      toast.error("Não foi possível criar o acesso", { description: accountErrorMessage(error) }),
  });

  const go = (target: Stage) => {
    if (target > maxStageRef.current) return;
    setStage(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const continueOwner = () => {
    setShowOwnerErrors(true);
    if (!ownerValid) {
      toast.error("Confira os dados antes de continuar");
      return;
    }
    setMaxStage((value) => (value < 3 ? 3 : value));
    setStage(3);
    void persist(formRef.current, 3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const continueProperty = () => {
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
    finish.mutate();
  };

  const firstName = (form.fullName || ownerQ.data?.name || "").trim().split(/\s+/)[0] ?? "";
  const impl = implementationQ.data;
  const propertyTitle =
    impl?.nickname ||
    [impl?.condominiumName, impl?.unit].filter(Boolean).join(" · ") ||
    "Seu imóvel";
  const journeyState: "loading" | "error" | "A" | "B" | "C" | "D" = journeyQ.isPending
    ? "loading"
    : journeyQ.isError
      ? "error"
      : submitted
        ? "D"
        : proposalAccepted
          ? "C"
          : journeyQ.data
            ? "A"
            : "B";
  const hasSavedDraft = Boolean(draftQ.data && (draftQ.data.currentStep ?? 0) > 0);
  const missing = [
    !ownerValid ? "seus dados" : null,
    !propertyValid ? "os dados do imóvel" : null,
  ].filter(Boolean) as string[];
  const copy = {
    loading: { title: "Preparando sua página", lead: "Só um instante." },
    error: {
      title: "Não conseguimos carregar agora",
      lead: "Nada foi alterado. Tente novamente em instantes.",
    },
    A: {
      title: "Conheça sua proposta",
      lead: "Leia as condições combinadas. Depois do aceite, o cadastro abre aqui mesmo.",
    },
    B: {
      title: "Estamos preparando sua proposta",
      lead: "Avisaremos quando estiver pronta. Este mesmo link continua valendo.",
    },
    C: hasSavedDraft
      ? {
          title: "Continuar de onde parou",
          lead: "O que você preencheu está guardado. Falta pouco.",
        }
      : {
          title: "Vamos ao seu cadastro",
          lead: "Leva poucos minutos. Você pode parar e voltar pelo mesmo link.",
        },
    D: {
      title: "Recebemos seu cadastro",
      lead: "A equipe STAYO está revisando as informações e fala com você em breve.",
    },
  }[journeyState];

  return (
    <div className="portal-onboarding">
      <header className={`portal-onboarding-header${coverData ? " has-photo" : ""}`}>
        <img
          src={coverData?.url ?? institutionalCover}
          onError={() => setCoverBroken(true)}
          alt=""
          aria-hidden="true"
          className="portal-onboarding-cover"
        />
        <div className="portal-onboarding-cover-overlay" aria-hidden="true" />
        <div className="portal-onboarding-header-content">
          <div className="portal-onboarding-brand-row">
            <StayoLogo variant="white" className="h-auto w-24" />
            {journeyState === "C" && stage >= 2 && <SaveStatus state={saveState} />}
          </div>
          <p className="portal-onboarding-eyebrow">
            {firstName ? `Olá, ${firstName}` : "Olá!"} · {propertyTitle}
          </p>
          <h1 key={journeyState} className="portal-onboarding-headline">
            {copy.title}
          </h1>
          <p className="portal-onboarding-lead">{copy.lead}</p>
          <span className="portal-onboarding-cover-note">
            {!coverData
              ? "Imagem institucional STAYO"
              : coverData.source === "condominium"
                ? coverData.label
                : "Foto do imóvel"}
          </span>
        </div>
      </header>

      {journeyState !== "B" && journeyState !== "loading" && journeyState !== "error" && (
        <div className="portal-journey-ruler-wrap">
          <Timeline stage={stage} maxStage={maxStage} onSelect={go} showFollowUp={submitted} />
        </div>
      )}

      {journeyState === "C" && hasSavedDraft && stage < 4 && (
        <div className="portal-resume-note" role="status">
          <CheckCircle2 aria-hidden="true" />
          <div>
            <strong>Etapa salva: {stage === 3 ? "Seu imóvel" : "Seus dados"}</strong>
            <span>
              {missing.length
                ? `Falta preencher ${missing.join(" e ")}.`
                : "Tudo preenchido. Revise e envie."}
            </span>
          </div>
        </div>
      )}

      <main className="portal-onboarding-main">
        <div className="portal-onboarding-card">
          <div key={stage} className="portal-onboarding-stage">
            {stage === 1 && (
              <ProposalStep
                journey={journeyQ.data ?? null}
                loading={journeyQ.isPending}
                failed={journeyQ.isError}
                acceptName={acceptName}
                agreed={agreed}
                accepting={acceptProposal.isPending}
                onAcceptName={setAcceptName}
                onAgree={setAgreed}
                onAccept={() => acceptProposal.mutate()}
                onContinue={() => {
                  setMaxStage((value) => (value < 2 ? 2 : value));
                  setStage(2);
                }}
              />
            )}
            {stage === 2 && (
              <OwnerStep
                form={form}
                people={people}
                showErrors={showOwnerErrors}
                onSet={set}
                onUpdatePerson={updatePerson}
                onAddPerson={addPerson}
                onRemovePerson={removePerson}
                onBack={() => go(1)}
                onContinue={continueOwner}
              />
            )}
            {stage === 3 && (
              <PropertyStep
                form={form}
                implementationName={
                  implementationQ.data?.condominiumName || implementationQ.data?.nickname || null
                }
                errors={showPropertyErrors ? propertyErrors : {}}
                finishing={finish.isPending}
                onSet={set}
                onBack={() => go(2)}
                onContinue={continueProperty}
              />
            )}
            {stage === 4 && (
              <AccessStep
                email={form.email}
                password={password}
                passwordAgain={passwordAgain}
                accountState={accountState}
                creating={createAccount.isPending}
                authReady={isSupabaseConfigured()}
                onPassword={setPassword}
                onPasswordAgain={setPasswordAgain}
                onCreate={() => createAccount.mutate()}
                onBack={() => go(3)}
                onEnter={() => void navigate({ to: "/portal/inicio" })}
              />
            )}
          </div>
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

function SaveStatus({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  return (
    <div className={`portal-autosave is-${state}`} role="status">
      {state === "saved" ? <CheckCircle2 /> : <Cloud />}
      <span>
        {state === "saving"
          ? "Salvando…"
          : state === "error"
            ? "Tentaremos novamente"
            : state === "saved"
              ? "Tudo salvo"
              : "Salvamento ativo"}
      </span>
    </div>
  );
}

function Timeline({
  stage,
  maxStage,
  onSelect,
  showFollowUp,
}: {
  stage: Stage;
  maxStage: Stage;
  onSelect: (stage: Stage) => void;
  showFollowUp: boolean;
}) {
  const steps: Array<{ id: Stage; label: string; short: string; icon: ReactNode }> = [
    { id: 1, label: "Proposta", short: "Proposta", icon: <FileCheck2 /> },
    { id: 2, label: "Seus dados", short: "Dados", icon: <UserRound /> },
    { id: 3, label: "Seu imóvel", short: "Imóvel", icon: <Home /> },
  ];
  // "Acompanhar" só aparece depois do envio: é a conta de acompanhamento,
  // nunca uma etapa de coleta inicial de senhas ou códigos.
  if (showFollowUp)
    steps.push({ id: 4, label: "Acompanhar", short: "Acompanhar", icon: <KeyRound /> });
  return (
    <nav
      className="portal-journey-steps"
      aria-label="Etapas da jornada"
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
    >
      {steps.map((item, position) => {
        const complete = item.id < stage || item.id < maxStage;
        const current = item.id === stage;
        const enabled = item.id <= maxStage;
        return (
          <button
            key={item.id}
            type="button"
            disabled={!enabled}
            onClick={() => onSelect(item.id)}
            style={{ transitionDelay: `${position * 40}ms` }}
            className={`portal-journey-step ${
              current ? "is-current" : complete ? "is-complete" : "is-locked"
            }`}
          >
            <span className="portal-journey-step-icon">
              {complete && !current ? <Check /> : item.icon}
            </span>
            <span className="portal-journey-step-label">
              <span className="max-sm:hidden">{item.label}</span>
              <span className="sm:hidden">{item.short}</span>
            </span>
            <span className="portal-journey-step-bar" aria-hidden="true" />
          </button>
        );
      })}
    </nav>
  );
}

function ProposalStep({
  journey,
  loading,
  failed,
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
  failed: boolean;
  acceptName: string;
  agreed: boolean;
  accepting: boolean;
  onAcceptName: (value: string) => void;
  onAgree: (value: boolean) => void;
  onAccept: () => void;
  onContinue: () => void;
}) {
  if (loading)
    return (
      <Blocked
        icon={<Cloud />}
        title="Carregando sua proposta"
        text="Estamos buscando a versão vinculada a este acesso."
      />
    );
  if (failed)
    return (
      <Blocked
        title="Não conseguimos abrir a proposta agora"
        text="Nada foi alterado. Tente novamente em instantes ou fale com a equipe STAYO."
      />
    );
  if (!journey)
    return (
      <Blocked
        icon={<Cloud />}
        title="Estamos preparando sua proposta"
        text="A equipe STAYO está finalizando as condições. Quando a proposta for publicada, ela aparece aqui e o cadastro abre logo depois do seu aceite. Não é preciso fazer nada agora."
      />
    );

  const accepted = Boolean(journey.proposal.acceptedAt);
  const terms = [...journey.commercialTerms].sort((a, b) => a.displayOrder - b.displayOrder);
  return (
    <section className="space-y-5">
      <Heading
        eyebrow={`Proposta comercial · versão ${journey.proposal.version}`}
        title="Confira o que combinamos"
        text="Este resumo registra as condições comerciais desta versão antes do início do seu cadastro."
      />
      {terms.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {terms.map((term) => (
            <TermCard key={term.id} term={term} />
          ))}
        </div>
      )}
      {journey.proposal.items.length > 0 && (
        <div className="rounded-2xl border border-[var(--portal-border)] bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <strong className="text-sm">Itens desta versão</strong>
            <strong className="text-sm text-[var(--portal-navy)]">
              {money.format(journey.proposal.total)}
            </strong>
          </div>
          <div className="divide-y divide-[var(--portal-border)]">
            {journey.proposal.items.map((item, index) => (
              <div
                key={`${item.description}-${index}`}
                className="flex justify-between gap-4 py-2.5 text-sm"
              >
                <span>
                  {item.description}
                  {item.quantity > 1 ? ` · x${item.quantity}` : ""}
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
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Summary label="Repasse" value={journey.contractConditions.payoutRule} />
            <Summary
              label="Manutenção sem autorização"
              value={
                journey.contractConditions.maintenanceLimit === null
                  ? null
                  : `Até ${money.format(journey.contractConditions.maintenanceLimit)}`
              }
            />
            <Summary
              label="Exclusividade"
              value={
                journey.contractConditions.exclusivity === null
                  ? null
                  : journey.contractConditions.exclusivity
                    ? "Sim"
                    : "Não"
              }
            />
            <Summary
              label="Vigência"
              value={
                journey.contractConditions.durationMonths === null
                  ? null
                  : `${journey.contractConditions.durationMonths} meses`
              }
            />
            <Summary
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
                Aceite registrado
                {journey.proposal.acceptedName ? ` por ${journey.proposal.acceptedName}` : ""}
                {journey.proposal.acceptedAt
                  ? ` em ${new Date(journey.proposal.acceptedAt).toLocaleString("pt-BR")}`
                  : ""}
                .
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
            Este aceite registra concordância comercial com esta versão. O contrato formal é tratado
            separadamente pela equipe STAYO.
          </p>
          <div className="mt-4 space-y-3">
            <Field
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
              className="portal-cta w-full"
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

function TermCard({ term }: { term: CommercialTerm }) {
  return (
    <div className="portal-term-card rounded-2xl border border-[var(--portal-border)] bg-white p-4">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--portal-muted)]">
        {term.label}
      </span>
      <strong className="mt-1 block text-lg text-[var(--portal-navy)]">{formatTerm(term)}</strong>
      {term.notes && <p className="mt-1 text-xs text-[var(--portal-muted)]">{term.notes}</p>}
    </div>
  );
}

function formatTerm(term: CommercialTerm) {
  if (term.chargeType === "percentage")
    return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(term.value)}%`;
  if (term.chargeType === "fixed_once") return `${money.format(term.value)} · uma vez`;
  if (term.chargeType === "per_reservation") return `${money.format(term.value)} · por reserva`;
  if (term.chargeType === "monthly") return `${money.format(term.value)} · por mês`;
  if (term.chargeType === "optional")
    return term.value ? `${money.format(term.value)} · opcional` : "Opcional";
  if (term.chargeType === "informational") return term.notes || "Condição informativa";
  return String(term.value);
}

function OwnerStep({
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
  onSet: <K extends keyof OwnerOnboardingSubmissionInput>(
    key: K,
    value: OwnerOnboardingSubmissionInput[K],
  ) => void;
  onUpdatePerson: (index: number, patch: Partial<OwnerOnboardingPerson>) => void;
  onAddPerson: () => void;
  onRemovePerson: (index: number) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const error = (field: OwnerFormField) =>
    showErrors ? validateOwnerField(field, form[field]) : undefined;
  const primary = people[0];
  return (
    <section className="space-y-6">
      <Heading
        eyebrow="Etapa 2 de 4"
        title="Conte um pouco sobre você"
        text="Usaremos estes dados para preparar a implantação, os repasses e o relacionamento com a STAYO."
      />
      <Section
        title="Identificação"
        icon={<UserRound />}
        text="Comece pelo proprietário principal. Se houver coproprietário ou proponente, adicione abaixo."
      >
        <div className="space-y-3">
          {people.map((person, index) => (
            <PersonEditor
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
      </Section>
      <Section title="Contato" text="Este será também o e-mail sugerido para seu acesso ao portal.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="E-mail"
            type="email"
            value={form.email}
            onChange={(value) => {
              onSet("email", value);
              if (primary) onUpdatePerson(0, { email: value });
            }}
            error={error("email")}
          />
          <Field
            label="WhatsApp ou telefone"
            inputMode="tel"
            value={formatBrazilianPhone(form.phone)}
            onChange={(value) => {
              const phone = formatBrazilianPhone(value);
              onSet("phone", phone);
              if (primary) onUpdatePerson(0, { phone });
            }}
            error={error("phone")}
          />
        </div>
      </Section>
      <Section
        title="Seu endereço"
        text="Este é o endereço do proprietário, não o endereço do imóvel administrado."
      >
        <div className="grid gap-3 sm:grid-cols-6">
          <Field
            className="sm:col-span-2"
            label="CEP"
            inputMode="numeric"
            value={formatBrazilianPostalCode(form.postalCode)}
            onChange={(value) => onSet("postalCode", formatBrazilianPostalCode(value))}
            onBlur={() => void findCep(form.postalCode, onSet, false)}
            error={error("postalCode")}
          />
          <Field
            className="sm:col-span-4"
            label="Endereço"
            value={form.street}
            onChange={(value) => onSet("street", value)}
            error={error("street")}
          />
          <Field
            className="sm:col-span-2"
            label="Número"
            value={form.number}
            onChange={(value) => onSet("number", value)}
            error={error("number")}
          />
          <Field
            className="sm:col-span-4"
            label="Complemento (opcional)"
            value={form.complement ?? ""}
            onChange={(value) => onSet("complement", value || null)}
          />
          <Field
            className="sm:col-span-3"
            label="Bairro"
            value={form.district}
            onChange={(value) => onSet("district", value)}
            error={error("district")}
          />
          <Field
            className="sm:col-span-2"
            label="Cidade"
            value={form.city}
            onChange={(value) => onSet("city", value)}
            error={error("city")}
          />
          <Field
            className="sm:col-span-1"
            label="UF"
            value={form.state}
            onChange={(value) =>
              onSet(
                "state",
                value
                  .toUpperCase()
                  .replace(/[^A-Z]/g, "")
                  .slice(0, 2),
              )
            }
            error={error("state")}
          />
        </div>
      </Section>
      <Section
        title="Dados para repasse"
        icon={<LockKeyhole />}
        text="Informações financeiras ficam restritas à equipe autorizada e são confirmadas antes do primeiro repasse."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Banco"
            value={form.bankName}
            onChange={(value) => onSet("bankName", value)}
            options={BRAZILIAN_BANKS.map((bank) => ({ value: bank, label: bank }))}
            placeholder="Selecione o banco"
            error={error("bankName")}
          />
          <Select
            label="Tipo de conta"
            value={form.accountType}
            onChange={(value) =>
              onSet("accountType", value as OwnerOnboardingSubmissionInput["accountType"])
            }
            options={[...ACCOUNT_TYPES]}
            error={error("accountType")}
          />
          <Field
            label="Agência"
            value={form.bankBranch}
            onChange={(value) => onSet("bankBranch", value)}
            error={error("bankBranch")}
          />
          <Field
            label="Conta com dígito"
            value={form.accountNumber}
            onChange={(value) => onSet("accountNumber", value)}
            error={error("accountNumber")}
          />
          <Field
            label="Titular da conta"
            value={form.accountHolder}
            onChange={(value) => onSet("accountHolder", value)}
            error={error("accountHolder")}
          />
          <Field
            label="CPF/CNPJ do titular"
            inputMode="numeric"
            value={formatBrazilianDocument(form.holderTaxId)}
            onChange={(value) => onSet("holderTaxId", formatBrazilianDocument(value))}
            error={error("holderTaxId")}
          />
          <Select
            label="Tipo da chave Pix"
            value={form.pixType}
            onChange={(value) => {
              const type = value as OwnerOnboardingSubmissionInput["pixType"];
              onSet("pixType", type);
              if (primary && type !== "random") onSet("pixKey", suggestPixKey(primary, type));
              if (type === "random") onSet("pixKey", "");
            }}
            options={[...PIX_KEY_TYPES]}
            error={error("pixType")}
          />
          <Field
            label="Chave Pix"
            value={form.pixKey}
            onChange={(value) => onSet("pixKey", value)}
            error={error("pixKey")}
          />
        </div>
      </Section>
      <Actions onBack={onBack} onContinue={onContinue} label="Continuar para o imóvel" />
    </section>
  );
}

function PersonEditor({
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
  onRemove?: (() => void) | undefined;
}) {
  const nameError = showErrors ? validateOwnerField("fullName", person.fullName) : undefined;
  const documentError = showErrors ? validateOwnerField("document", person.document) : undefined;
  return (
    <div className="rounded-2xl border border-[var(--portal-border)] bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <strong className="text-sm">
            {index === 0 ? "Proprietário principal" : `Pessoa ${index + 1}`}
          </strong>
          <p className="mt-0.5 text-xs text-[var(--portal-muted)]">
            {index === 0 ? "Responsável principal pela jornada" : "Coproprietário ou proponente"}
          </p>
        </div>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label="Remover pessoa"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {index > 0 && (
          <Select
            label="Participação"
            value={person.role}
            onChange={(value) => onChange({ role: value as OwnerOnboardingPerson["role"] })}
            options={[
              { value: "coproprietario", label: "Coproprietário" },
              { value: "proponente", label: "Proponente" },
            ]}
          />
        )}
        <Select
          label="Tipo de pessoa"
          value={person.personType}
          onChange={(value) =>
            onChange({ personType: value as OwnerOnboardingPerson["personType"] })
          }
          options={[
            { value: "pf", label: "Pessoa física" },
            { value: "pj", label: "Pessoa jurídica" },
          ]}
        />
        <Field
          label={person.personType === "pf" ? "Nome completo" : "Razão social"}
          value={person.fullName}
          onChange={(value) => onChange({ fullName: value })}
          error={nameError}
        />
        <Field
          label={person.personType === "pf" ? "CPF" : "CNPJ"}
          inputMode="numeric"
          value={formatBrazilianDocument(person.document)}
          onChange={(value) => onChange({ document: formatBrazilianDocument(value) })}
          error={documentError}
        />
        {index > 0 && (
          <>
            <Field
              label="E-mail (opcional)"
              type="email"
              value={person.email}
              onChange={(value) => onChange({ email: value })}
              error={
                showErrors && person.email ? validateOwnerField("email", person.email) : undefined
              }
            />
            <Field
              label="Telefone (opcional)"
              inputMode="tel"
              value={formatBrazilianPhone(person.phone)}
              onChange={(value) => onChange({ phone: formatBrazilianPhone(value) })}
              error={
                showErrors && person.phone ? validateOwnerField("phone", person.phone) : undefined
              }
            />
          </>
        )}
      </div>
    </div>
  );
}

function PropertyStep({
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
  errors: PropertyErrors;
  finishing: boolean;
  onSet: <K extends keyof OwnerOnboardingSubmissionInput>(
    key: K,
    value: OwnerOnboardingSubmissionInput[K],
  ) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const number = (
    key: "propertyBedrooms" | "propertySuites" | "propertyBathrooms" | "propertyParkingSpots",
    value: string,
  ) => onSet(key, value === "" ? null : Math.max(0, Number.parseInt(value, 10) || 0));
  return (
    <section className="space-y-6">
      <Heading
        eyebrow="Etapa 3 de 4"
        title="Agora, seu imóvel"
        text="Estas informações iniciam a ficha de implantação. A equipe STAYO valida os dados antes de uso operacional ou publicação."
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
      <Section
        title="Localização"
        icon={<Home />}
        text="Se o endereço já veio preenchido pela STAYO, confira e complete o que estiver faltando."
      >
        <div className="grid gap-3 sm:grid-cols-6">
          <Field
            className="sm:col-span-2"
            label="CEP do imóvel"
            inputMode="numeric"
            value={formatBrazilianPostalCode(form.propertyPostalCode)}
            onChange={(value) => onSet("propertyPostalCode", formatBrazilianPostalCode(value))}
            onBlur={() => void findCep(form.propertyPostalCode, onSet, true)}
            error={errors.propertyPostalCode}
          />
          <Field
            className="sm:col-span-4"
            label="Endereço"
            value={form.propertyStreet}
            onChange={(value) => onSet("propertyStreet", value)}
            error={errors.propertyStreet}
          />
          <Field
            className="sm:col-span-2"
            label="Número / unidade"
            value={form.propertyNumber}
            onChange={(value) => onSet("propertyNumber", value)}
            error={errors.propertyNumber}
          />
          <Field
            className="sm:col-span-4"
            label="Complemento (opcional)"
            value={form.propertyComplement ?? ""}
            onChange={(value) => onSet("propertyComplement", value || null)}
          />
          <Field
            className="sm:col-span-3"
            label="Bairro"
            value={form.propertyDistrict}
            onChange={(value) => onSet("propertyDistrict", value)}
            error={errors.propertyDistrict}
          />
          <Field
            className="sm:col-span-2"
            label="Cidade"
            value={form.propertyCity}
            onChange={(value) => onSet("propertyCity", value)}
            error={errors.propertyCity}
          />
          <Field
            className="sm:col-span-1"
            label="UF"
            value={form.propertyState}
            onChange={(value) =>
              onSet(
                "propertyState",
                value
                  .toUpperCase()
                  .replace(/[^A-Z]/g, "")
                  .slice(0, 2),
              )
            }
            error={errors.propertyState}
          />
        </div>
      </Section>
      <Section
        title="Características"
        text="Uma visão inicial é suficiente; a vistoria e a implantação completam a ficha depois."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Tipo do imóvel"
            value={form.propertyType}
            onChange={(value) => onSet("propertyType", value)}
            placeholder="Ex.: Apartamento"
            error={errors.propertyType}
          />
          <NumberInput
            label="Dormitórios"
            value={form.propertyBedrooms}
            onChange={(value) => number("propertyBedrooms", value)}
          />
          <NumberInput
            label="Suítes"
            value={form.propertySuites}
            onChange={(value) => number("propertySuites", value)}
          />
          <NumberInput
            label="Banheiros"
            value={form.propertyBathrooms}
            onChange={(value) => number("propertyBathrooms", value)}
          />
          <NumberInput
            label="Vagas"
            value={form.propertyParkingSpots}
            onChange={(value) => number("propertyParkingSpots", value)}
          />
        </div>
      </Section>
      <Section
        title="Acesso e informações operacionais"
        icon={<KeyRound />}
        text="Preencha apenas o que já souber. Senhas e códigos são restritos e não são publicados automaticamente."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Forma de acesso"
            value={form.propertyAccessType ?? ""}
            onChange={(value) =>
              onSet(
                "propertyAccessType",
                (value || null) as OwnerOnboardingSubmissionInput["propertyAccessType"],
              )
            }
            placeholder="Selecione"
            options={[
              { value: "key", label: "Chave" },
              { value: "lock", label: "Fechadura" },
              { value: "concierge", label: "Portaria" },
              { value: "other", label: "Outro" },
            ]}
          />
          <Field
            label="Orientações de acesso (opcional)"
            value={form.propertyAccessNotes}
            onChange={(value) => onSet("propertyAccessNotes", value)}
          />
          {form.propertyAccessType === "lock" && (
            <Field
              label="Código da fechadura (opcional)"
              type="password"
              value={form.propertyAccessCode}
              onChange={(value) => onSet("propertyAccessCode", value)}
            />
          )}
          <Field
            label="Rede Wi-Fi (opcional)"
            value={form.propertyWifiNetwork}
            onChange={(value) => onSet("propertyWifiNetwork", value)}
          />
          <Field
            label="Senha do Wi-Fi (opcional)"
            type="password"
            value={form.propertyWifiPassword}
            onChange={(value) => onSet("propertyWifiPassword", value)}
          />
        </div>
      </Section>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
        <strong className="block">Importante</strong>
        <p className="mt-1">
          Dados enviados aqui alimentam a implantação administrativa. Nada é publicado
          automaticamente no Guia do Hóspede sem revisão da equipe STAYO.
        </p>
      </div>
      <Actions
        onBack={onBack}
        onContinue={onContinue}
        label={finishing ? "Enviando cadastro..." : "Finalizar cadastro e criar acesso"}
        disabled={finishing}
      />
    </section>
  );
}

function AccessStep({
  email,
  password,
  passwordAgain,
  accountState,
  creating,
  authReady,
  onPassword,
  onPasswordAgain,
  onCreate,
  onBack,
  onEnter,
}: {
  email: string;
  password: string;
  passwordAgain: string;
  accountState: "idle" | "confirmation_required" | "linked";
  creating: boolean;
  authReady: boolean;
  onPassword: (value: string) => void;
  onPasswordAgain: (value: string) => void;
  onCreate: () => void;
  onBack: () => void;
  onEnter: () => void;
}) {
  return (
    <section className="space-y-6">
      <Heading
        eyebrow="Etapa 4 de 4"
        title="Seu acesso à STAYO"
        text="Proposta aceita e cadastro recebido. Agora crie sua senha para acompanhar a implantação e, depois, a operação do imóvel."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Done label="Proposta" text="Aceita" />
        <Done label="Seus dados" text="Recebidos" />
        <Done label="Seu imóvel" text="Recebido" />
      </div>
      {!authReady ? (
        <Blocked
          title="Cadastro concluído"
          text="O ambiente atual ainda não está conectado ao serviço de autenticação. Seus dados foram preservados e a equipe STAYO poderá liberar o acesso quando o serviço estiver disponível."
        />
      ) : accountState === "confirmation_required" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <CheckCircle2 className="mx-auto size-8 text-emerald-700" />
          <strong className="mt-3 block text-emerald-950">Confirme seu e-mail</strong>
          <p className="mt-1 text-sm text-emerald-800">
            Enviamos uma confirmação para {email}. Depois, volte por este mesmo acesso ou entre no
            Portal do Proprietário.
          </p>
        </div>
      ) : accountState === "linked" ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <CheckCircle2 className="mx-auto size-8 text-emerald-700" />
          <strong className="mt-3 block text-emerald-950">Tudo pronto</strong>
          <Button type="button" className="mt-4 w-full" onClick={onEnter}>
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
            <Field label="E-mail" type="email" value={email} onChange={() => undefined} disabled />
            <Field
              label="Crie uma senha"
              type="password"
              value={password}
              onChange={onPassword}
              hint="Use pelo menos 8 caracteres."
            />
            <Field
              label="Confirme a senha"
              type="password"
              value={passwordAgain}
              onChange={onPasswordAgain}
              error={
                passwordAgain && password !== passwordAgain ? "As senhas não coincidem." : undefined
              }
            />
            <Button
              type="button"
              className="w-full"
              disabled={creating || password.length < 8 || password !== passwordAgain}
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

function Section({
  title,
  text,
  icon,
  children,
}: {
  title: string;
  text: string;
  icon?: ReactNode | undefined;
  children: ReactNode;
}) {
  return (
    <div className="portal-onboarding-section space-y-4 rounded-2xl border border-[var(--portal-border)] bg-white p-4 sm:p-5">
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

function Heading({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
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

function Actions({
  onBack,
  onContinue,
  label,
  disabled,
}: {
  onBack: () => void;
  onContinue: () => void;
  label: string;
  disabled?: boolean | undefined;
}) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-[var(--portal-border)] pt-5 sm:flex-row sm:justify-between">
      <Button type="button" variant="ghost" onClick={onBack} disabled={disabled}>
        <ChevronLeft className="size-4" /> Voltar
      </Button>
      <Button type="button" className="portal-cta" onClick={onContinue} disabled={disabled}>
        {label}
        {!disabled && <ChevronRight className="size-4" />}
      </Button>
    </div>
  );
}

function Field({
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
  onBlur?: (() => void) | undefined;
  type?: string | undefined;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"] | undefined;
  placeholder?: string | undefined;
  error?: string | undefined;
  hint?: string | undefined;
  className?: string | undefined;
  disabled?: boolean | undefined;
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
        <span className="portal-field-error mt-1 block text-xs text-[var(--portal-danger)]">
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1 block text-[11px] text-[var(--portal-muted)]">{hint}</span>
      ) : null}
    </label>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: string) => void;
}) {
  return (
    <Field
      label={label}
      type="number"
      inputMode="numeric"
      value={value === null ? "" : String(value)}
      onChange={onChange}
    />
  );
}

function Select({
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
  placeholder?: string | undefined;
  error?: string | undefined;
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

function Summary({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="rounded-xl bg-white/70 px-3 py-2">
      <span className="block text-[10px] uppercase tracking-[0.08em] text-[var(--portal-muted)]">
        {label}
      </span>
      <strong className="mt-0.5 block text-xs">{value}</strong>
    </div>
  );
}

function Done({ label, text }: { label: string; text: string }) {
  return (
    <div className="portal-done-card rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="size-4 text-emerald-700" />
        <span className="text-xs font-medium text-emerald-950">{label}</span>
      </div>
      <span className="mt-1 block text-xs text-emerald-800">{text}</span>
    </div>
  );
}

function Blocked({
  title,
  text,
  icon,
}: {
  title: string;
  text: string;
  icon?: ReactNode | undefined;
}) {
  return (
    <div className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface-soft)] p-5 text-center">
      <div className="mx-auto grid size-8 place-items-center text-[var(--portal-navy)] [&>svg]:size-7">
        {icon ?? <LockKeyhole />}
      </div>
      <strong className="mt-3 block text-sm">{title}</strong>
      <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-[var(--portal-muted)]">
        {text}
      </p>
    </div>
  );
}

function getPropertyErrors(form: OwnerOnboardingSubmissionInput): PropertyErrors {
  const errors: PropertyErrors = {};
  if (form.propertyPostalCode && form.propertyPostalCode.replace(/\D/g, "").length !== 8)
    errors.propertyPostalCode = "Confira o CEP informado.";
  if (form.propertyStreet.trim().length < 2)
    errors.propertyStreet = "Informe o endereço do imóvel.";
  if (!form.propertyNumber.trim()) errors.propertyNumber = "Informe o número ou unidade.";
  if (form.propertyDistrict.trim().length < 2) errors.propertyDistrict = "Informe o bairro.";
  if (form.propertyCity.trim().length < 2) errors.propertyCity = "Informe a cidade.";
  if (form.propertyState.trim().length !== 2) errors.propertyState = "Informe a UF.";
  if (form.propertyType.trim().length < 2) errors.propertyType = "Informe o tipo do imóvel.";
  return errors;
}

async function findCep(
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

function ownerErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLocaleLowerCase("pt-BR") : "";
  if (message.includes("cpf") || message.includes("cnpj") || message.includes("documento"))
    return "Confira o CPF ou CNPJ informado.";
  if (message.includes("telefone")) return "Confira o telefone e o DDD.";
  if (message.includes("e-mail") || message.includes("email")) return "Confira o e-mail informado.";
  if (message.includes("repasse") || message.includes("pix") || message.includes("conta"))
    return "Confira os dados de repasse.";
  return "Há um dado obrigatório ainda incompleto. Revise as etapas anteriores.";
}

function accountErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLocaleLowerCase("pt-BR") : "";
  if (message.includes("8 caracteres")) return "A senha precisa ter pelo menos 8 caracteres.";
  if (message.includes("não coincidem")) return "Digite a mesma senha nos dois campos.";
  if (message.includes("already registered") || message.includes("já possui"))
    return "Este e-mail já possui acesso. Use a senha criada anteriormente ou recupere seu acesso.";
  if (message.includes("email not confirmed")) return "Confirme o e-mail recebido antes de entrar.";
  if (message.includes("mesmo e-mail")) return "Use o mesmo e-mail informado no cadastro.";
  return "Tente novamente em alguns instantes.";
}
