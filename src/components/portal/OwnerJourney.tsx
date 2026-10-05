import { OwnerGuide } from "@/components/portal/OwnerGuide";
import { OwnerSuppliersSection } from "@/components/suppliers/OwnerSuppliersSection";
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
  ArrowRight,
  ChevronDown,
  Loader2,
  Clock3,
  Sparkles,
  Camera,
  Shirt,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { StayoLogo } from "../brand/StayoLogo";
import { OwnerCoverBanner } from "./OwnerCoverBanner";
import { reconcileRegistrationContact } from "../../lib/owner-registration-contact";
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
import {
  commercialCleaningFee,
  ownerUseSummary,
  conditionSections,
  formatPercent,
  implementationDecisionItems,
  type ConditionItem,
} from "../../lib/contract-conditions";
import { resolvePricing, type ItemPricing } from "../../lib/proposal-pricing";
import { publishedProposalPresentation } from "../../lib/published-proposal-presentation";
import type {
  CommercialProposalSnapshot,
  ProposalSnapshotCommercialTerm,
} from "../../types/commercial-proposal";
import type {
  OwnerOnboardingPerson,
  OwnerOnboardingSubmissionInput,
} from "../../types/owner-onboarding";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
// Canal de contato exibido na proposta pública ("Ajuda" / "Falar com a STAYO").
const STAYO_SUPPORT_URL = "mailto:contato@stayogramado.com.br";
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
  const [coverReady, setCoverReady] = useState(false);
  const [form, setForm] = useState<OwnerOnboardingSubmissionInput>(emptyForm);
  const [stage, setStage] = useState<Stage>(1);
  const [maxStage, setMaxStage] = useState<Stage>(1);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [showOwnerErrors, setShowOwnerErrors] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const sending = useRef(false);
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

  const proposalAccepted = Boolean(
    journeyQ.data?.confirmation && !journeyQ.data.needsConfirmation,
  );
  const commandId = useRef<string>(crypto.randomUUID());
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
    const reconciled = reconcileRegistrationContact(initial);

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

    setForm(reconciled);
    formRef.current = reconciled;
    lastSaved.current = JSON.stringify(reconciled);
    setStage(current);
    stageRef.current = current;
    setMaxStage(reached);
    maxStageRef.current = reached;
    setAcceptName(journeyQ.data?.confirmation?.confirmedName ?? owner?.name ?? "");
    setAgreed(false);
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
      const code = Math.max(target, maxStageRef.current) >= 3 ? STEP.property : STEP.owner;
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
    mutationFn: () => {
      const proposalId = journeyQ.data?.current?.proposalId;
      if (!proposalId) throw new Error("Proposta indisponível.");
      return ownerJourneyApi.acceptProposal(token, acceptName.trim(), proposalId, commandId.current);
    },
    onSuccess: (journey) => {
      commandId.current = crypto.randomUUID();
      queryClient.setQueryData(["owner-journey", "proposal", token], journey);
      setMaxStage((value) => (value < 2 ? 2 : value));
      setStage(2);
      toast.success("Condições confirmadas", {
        description: "Agora vamos ao seu cadastro.",
      });
    },
    onError: (error) =>
      toast.error("Não foi possível registrar a confirmação", {
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
      setReviewing(false);
      setMaxStage(4);
      setStage(4);
      toast.success("Informações enviadas para análise", {
        description: "A equipe STAYO vai revisar. Agora você pode criar seu acesso.",
      });
    },
    onError: (error) =>
      toast.error("Não foi possível concluir o cadastro", {
        description: ownerErrorMessage(error),
      }),
    onSettled: () => {
      finalizing.current = false;
      sending.current = false;
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
    void persist(formRef.current, stageRef.current);
    setReviewing(false);
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
    void persist(formRef.current, 3);
    setReviewing(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const sendForReview = () => {
    if (finish.isPending || sending.current) return;
    sending.current = true;
    finish.mutate();
  };

  const firstName = (form.fullName || ownerQ.data?.name || "").trim().split(/\s+/)[0] ?? "";
  const impl = implementationQ.data;
  const ownerFullName = (ownerQ.data?.name || form.fullName || "").trim();
  const propertyTitle =
    impl?.nickname ||
    [impl?.condominiumName, impl?.unit].filter(Boolean).join(" · ") ||
    "Seu imóvel";
  const journeyState: "loading" | "error" | "A" | "B" | "C" | "D" = journeyQ.isPending
    ? "loading"
      : journeyQ.isError || draftQ.isError
      ? "error"
      : submitted
        ? "D"
        : proposalAccepted
          ? "C"
          : journeyQ.data?.current
            ? "A"
            : "B";
  const hasSavedDraft = Boolean(draftQ.data && (draftQ.data.currentStep ?? 0) > 0);
  const missing = [
    !ownerValid ? "seus dados" : null,
    !propertyValid ? "os dados do imóvel" : null,
  ].filter(Boolean) as string[];
  const resumeStage: Stage = stage === 2 || stage === 3 ? stage : 2;
  const mainRef = useRef<HTMLElement | null>(null);
  const openStage = (target: Stage) => {
    if (target > maxStageRef.current) {
      setMaxStage((value) => (value < target ? target : value));
      maxStageRef.current = target;
    }
    setStage(target);
    requestAnimationFrame(() =>
      mainRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };
  const copy: { title: string; lead: string; cta?: { label: string; onClick: () => void } } = {
    loading: { title: "Preparando sua página", lead: "Só um instante." },
    error: {
      title: "Não conseguimos carregar agora",
      lead: "Nada foi alterado. Tente novamente em instantes.",
    },
    A: {
      title: "Sua proposta STAYO",
      lead: "Confira as condições e confirme para iniciar.",
    },
    B: {
      title: "Estamos preparando sua proposta",
      lead: "A equipe STAYO avisa você quando ela estiver disponível. Este link continua valendo.",
    },
    C: hasSavedDraft
      ? {
          title: "Continue de onde parou",
          lead: "O que você preencheu está guardado.",
          cta: { label: "Continuar cadastro", onClick: () => openStage(resumeStage) },
        }
      : {
          title: "Vamos conhecer melhor você e seu imóvel",
          lead: "Leva poucos minutos. Você pode parar e voltar pelo mesmo link.",
          cta: { label: "Começar cadastro", onClick: () => openStage(2) },
        },
    D: {
      title: "Recebemos seu cadastro",
      lead: "A equipe STAYO está revisando as informações e fala com você em breve.",
    },
  }[journeyState];
  const coverSrc = coverQ.isPending ? null : (coverData?.url ?? institutionalCover);
  const coverNote = coverQ.isPending
    ? null
    : !coverData
    ? "Imagem institucional STAYO"
    : coverData.source === "condominium"
      ? coverData.label
      : null;
  const collecting = stage === 2 || stage === 3;

  return (
    <div className={`portal-onboarding${collecting ? " owner-contract-registration" : ""}`}>
      {journeyState === "A" ? (
        <header className="pj-top">
          <div className="pj-top-row">
            <StayoLogo className="h-8 w-auto" />
            <a className="pj-top-help" href={STAYO_SUPPORT_URL}>
              Ajuda
            </a>
          </div>
          {coverSrc && (
            <img
              key={coverSrc}
              src={coverSrc}
              onLoad={() => setCoverReady(true)}
              onError={() => {
                setCoverReady(false);
                setCoverBroken(true);
              }}
              alt=""
              aria-hidden="true"
              className={`pj-top-photo${coverReady ? " is-ready" : ""}`}
            />
          )}
          <p className="pj-top-progress">Etapa 1 de 5 · Proposta</p>
          <div className="pj-top-segments" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={`pj-top-segment${i === 0 ? " is-current" : ""}`} />
            ))}
          </div>
        </header>
      ) : collecting ? (
        <>
          <div className="owner-registration-brand"><StayoLogo className="h-12 w-auto" /></div>
          <OwnerCoverBanner token={token} />
          <header className="owner-registration-intro">
            <span className="text-xs font-medium text-[var(--portal-muted)]">CADASTRO PARA CONTRATO</span>
            <h1>Seu cadastro, passo a passo</h1>
            <p>Confira seus dados. Você pode continuar depois pelo mesmo link.</p>
            <div className="owner-registration-progress-meta">
              <span>Etapa {stage} de 4 · {stage === 2 ? "Seus dados" : "Seu imóvel"}</span>
              <SaveStatus state={saveState} onRetry={() => void persist(formRef.current, stageRef.current)} />
            </div>
          </header>
        </>
      ) : (
      <header className={`portal-onboarding-header is-compact${coverData ? " has-photo" : ""}`}>
        {coverSrc && (
          <img
            key={coverSrc}
            src={coverSrc}
            onLoad={() => setCoverReady(true)}
            onError={() => {
              setCoverReady(false);
              setCoverBroken(true);
            }}
            alt=""
            aria-hidden="true"
            className={`portal-onboarding-cover${coverReady ? " is-ready" : ""}`}
          />
        )}
        <div className="portal-onboarding-cover-overlay" aria-hidden="true" />
        <div className="portal-onboarding-header-content">
          <div className="portal-onboarding-brand-row">
            <StayoLogo variant="white" className="h-auto w-20" />
            {journeyState === "C" && stage >= 2 ? (
              <SaveStatus state={saveState} onRetry={() => void persist(formRef.current, stageRef.current)} />
            ) : coverNote ? (
              <span className="portal-onboarding-cover-tag">{coverNote}</span>
            ) : null}
          </div>
          {journeyState === "A" && <span className="pj-hero-badge">Proposta personalizada</span>}
          <p className="portal-onboarding-eyebrow">
            {journeyState === "A" && ownerFullName ? ownerFullName : firstName ? `Olá, ${firstName}` : "Olá!"} · {propertyTitle}
          </p>
          <h1 key={journeyState} className="portal-onboarding-headline">
            {copy.title}
          </h1>
          <p className="portal-onboarding-lead">{copy.lead}</p>
          {copy.cta && (
            <button type="button" className="portal-onboarding-header-cta" onClick={copy.cta.onClick}>
              {copy.cta.label}
              <ArrowRight aria-hidden="true" />
            </button>
          )}
        </div>
      </header>
      )}

      {journeyState !== "A" && journeyState !== "B" && journeyState !== "loading" && journeyState !== "error" && (
        <div className="portal-journey-ruler-wrap">
          <Timeline stage={stage} maxStage={maxStage} onSelect={go} showFollowUp={submitted} />
        </div>
      )}

      {journeyState === "C" && hasSavedDraft && stage < 4 && !collecting && (
        <div className="portal-resume-note" role="status">
          <CheckCircle2 aria-hidden="true" />
          <div>
            <strong>Continue seu cadastro</strong>
            <span>
              {missing.length
                ? `Falta preencher ${missing.join(" e ")}.`
                : "Tudo preenchido. Revise e envie."}
            </span>
          </div>
        </div>
      )}

      <main ref={mainRef} className="portal-onboarding-main">
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
            {(stage === 2 || stage === 3) && proposalAccepted && (
              <Button variant="ghost"
                type="button"
                onClick={() => go(1)}
                className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--portal-border)] px-3 text-sm font-medium text-[var(--portal-navy)] focus-visible:outline focus-visible:outline-2"
              >
                <FileCheck2 className="size-4" /> Ver condições da proposta
              </Button>
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
            {stage === 3 && reviewing && (
              <ReviewStep
                form={form}
                sending={finish.isPending}
                saveState={saveState}
                onEditOwner={() => go(2)}
                onEditProperty={() => setReviewing(false)}
                onSend={sendForReview}
              />
            )}
            {stage === 3 && !reviewing && (
              <PropertyStep
                token={token}
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

function SaveStatus({
  state,
  onRetry,
}: {
  state: "idle" | "saving" | "saved" | "error";
  onRetry: () => void;
}) {
  if (state === "error")
    return (
      <Button variant="ghost" type="button" className="portal-autosave is-error" role="status" onClick={onRetry}>
        <Cloud />
        <span>Não foi possível salvar — tentar novamente</span>
      </Button>
    );
  if (state !== "saving") return null;
  return (
    <div className={`portal-autosave is-${state}`} role="status" aria-live="polite">
      <Cloud />
      <span>Salvando…</span>
    </div>
  );
}

function ReviewStep({
  form,
  sending,
  saveState,
  onEditOwner,
  onEditProperty,
  onSend,
}: {
  form: OwnerOnboardingSubmissionInput;
  sending: boolean;
  saveState: "idle" | "saving" | "saved" | "error";
  onEditOwner: () => void;
  onEditProperty: () => void;
  onSend: () => void;
}) {
  const address = [
    form.propertyStreet,
    form.propertyNumber,
    form.propertyComplement,
    form.propertyDistrict,
    form.propertyCity,
    form.propertyState,
  ]
    .filter(Boolean)
    .join(", ");
  const rows = (items: Array<[string, string | number | null | undefined]>) =>
    items.filter(([, v]) => v !== null && v !== undefined && v !== "");
  const owner = rows([
    ["Nome", form.fullName],
    ["CPF/CNPJ", form.document],
    ["E-mail", form.email],
    ["Telefone", form.phone],
    ["Outras pessoas", form.people.length > 1 ? form.people.length - 1 : null],
    ["Banco", form.bankName],
    ["Chave Pix", form.pixKey],
  ]);
  const property = rows([
    ["Endereço", address],
    ["Tipo", form.propertyType],
    ["Quartos", form.propertyBedrooms],
    ["Banheiros", form.propertyBathrooms],
    ["Vagas", form.propertyParkingSpots],
  ]);
  const block = (title: string, list: typeof owner, onEdit: () => void) => (
    <div className="rounded-2xl border border-[var(--portal-border)] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <strong className="text-sm">{title}</strong>
        <button
          type="button"
          onClick={onEdit}
          className="min-h-11 px-2 text-sm font-medium text-[var(--portal-navy)] underline-offset-4 hover:underline"
        >
          Editar
        </button>
      </div>
      <dl className="mt-1 divide-y divide-[var(--portal-border)] text-sm">
        {list.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 py-1.5">
            <dt className="text-[var(--portal-muted)]">{k}</dt>
            <dd className="text-right font-medium break-all">{String(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
  return (
    <section className="space-y-4">
      <Heading
        eyebrow="Revisão final"
        title="Confira antes de enviar"
        text="Seu rascunho está salvo. Depois do envio, a equipe STAYO revisa as informações; nada vira imóvel em operação nem é publicado no Guia do Hóspede."
      />
      {block("Seus dados", owner, onEditOwner)}
      {block("Seu imóvel", property, onEditProperty)}
      <Button
        type="button"
        className="portal-cta w-full"
        disabled={sending || saveState === "saving"}
        onClick={onSend}
      >
        {sending ? "Enviando…" : "Enviar informações para análise"}
        {!sending && <ChevronRight className="size-4" />}
      </Button>
    </section>
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
    { id: 2, label: "Seus dados", short: "Seus dados", icon: <UserRound /> },
    { id: 3, label: "Seu imóvel", short: "Seu imóvel", icon: <Home /> },
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
        text="Estamos buscando a versão publicada para você."
      />
    );
  if (failed)
    return (
      <Blocked
        title="Não conseguimos abrir a proposta agora"
        text="Nada foi alterado. Atualize a página em instantes ou fale com a equipe STAYO."
      />
    );
  const current = journey?.current ?? null;
  const confirmation = journey?.confirmation ?? null;
  if (!current)
    return (
      <Blocked
        icon={<Cloud />}
        title="Estamos preparando sua proposta"
        text="A equipe STAYO avisa você quando ela estiver disponível. Não é preciso fazer nada agora."
      />
    );

  const needs = Boolean(journey?.needsConfirmation);
  // Após confirmar, mostra exatamente o texto confirmado.
  const shown = !needs && confirmation ? confirmation.snapshot : current.snapshot;
  const facts = proposalFacts(current.snapshot);
  const [showConditions, setShowConditions] = useState(false);
  const confirmed = !needs && confirmation;

  return (
    <section className="pj-proposal">
      {needs && confirmation && (
        <div className="pj-notice" role="status">
          <strong>Há uma nova versão da proposta.</strong>
          <span>
            Você confirmou a versão {confirmation.version} em {formatDateTime(confirmation.confirmedAt)}, e ela
            continua guardada. Para seguir, confirme a versão {current.version}.
          </span>
        </div>
      )}

      <div className="pj-open">
        <div className="pj-open-title-row">
          <h2 className="pj-open-title">Sua proposta STAYO</h2>
          <span className="pj-version-chip">Versão {current.version}</span>
        </div>
        <dl className="pj-open-facts">
          <div className="pj-open-fact">
            <dt>Administração</dt>
            <dd>{facts.admin ?? "A definir"}</dd>
          </div>
          <div className="pj-open-fact">
            <dt>Prazo</dt>
            <dd>{facts.duration ?? "A definir"}</dd>
          </div>
          <div className="pj-open-fact">
            <dt>Limpeza</dt>
            <dd>{facts.cleaning ? `${facts.cleaning} por uso` : "A definir"}</dd>
          </div>
        </dl>
        <p className="pj-open-note">
          <strong>
            Implantação: {facts.implementation ?? "valor definido após avaliação"}.
          </strong>
          <span>Combinaremos tudo antes de qualquer cobrança.</span>
        </p>
        <button
          type="button"
          className="pj-open-conditions"
          aria-expanded={showConditions}
          onClick={() => setShowConditions((value) => !value)}
        >
          {showConditions ? "Ocultar as condições" : "Ver todas as condições"}
          <ChevronDown className="size-4" aria-hidden="true" />
        </button>
        {!confirmed && (
          <>
            <Button
              type="button"
              className="portal-cta h-12 w-full text-sm"
              onClick={() =>
                document
                  .getElementById("confirmar-proposta")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              Revisar e confirmar <ChevronRight className="size-4" />
            </Button>
            <p className="pj-open-legal">A confirmação desta proposta não substitui o contrato.</p>
            <a className="pj-open-support" href={STAYO_SUPPORT_URL}>
              Falar com a STAYO
            </a>
          </>
        )}
      </div>

      {showConditions && <ProposalSnapshotSummary snapshot={shown} />}

      {confirmed ? (
        <div className="pj-confirmed">
          <CheckCircle2 aria-hidden="true" />
          <div>
            <strong>Você confirmou a versão {confirmation.version}</strong>
            <p>
              Confirmada por {confirmation.confirmedName} em {formatDateTime(confirmation.confirmedAt)}. Esta é a
              versão exibida acima. A formalização contratual será realizada em etapa própria.
            </p>
            <Button type="button" className="portal-cta mt-4 w-full sm:w-auto" onClick={onContinue}>
              Voltar ao cadastro <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div id="confirmar-proposta" className="pj-confirm">
          <p className="pj-confirm-eyebrow">Confirmação</p>
          <h2 className="pj-confirm-title">Você está confirmando a proposta versão {current.version}</h2>
          <p className="pj-confirm-summary">
            Você confirma a proposta versão {current.version}, com implantação definida em {facts.implementation ?? "valor a definir"}.
          </p>
          <button
            type="button"
            className="pj-review-link"
            onClick={() => {
              setShowConditions(true);
              window.setTimeout(
                () => document.getElementById("pj-cond-title")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                80,
              );
            }}
          >
            Revisar condições da proposta
          </button>
          <p className="pj-fineprint">
            Este aceite confirma as condições comerciais. O contrato será formalizado em etapa própria.
          </p>
          <label className="pj-field">
            <span>Nome completo</span>
            <input
              value={acceptName}
              onChange={(e) => onAcceptName(e.target.value)}
              autoComplete="name"
              placeholder="Como está no seu documento"
            />
          </label>
          <label className={`pj-agree${agreed ? " is-checked" : ""}`}>
            <input type="checkbox" checked={agreed} onChange={(event) => onAgree(event.target.checked)} />
            <span>Li e confirmo as condições desta proposta.</span>
          </label>
          <Button
            type="button"
            className="portal-cta h-12 w-full whitespace-nowrap px-3 text-center text-sm"
            disabled={accepting || !agreed || acceptName.trim().length < 3}
            aria-busy={accepting}
            onClick={onAccept}
          >
            {accepting ? (
              <><Loader2 className="size-4 animate-spin" /> Registrando sua confirmação…</>
            ) : (
              <>Confirmar e iniciar cadastro <ChevronRight className="size-4" /></>
            )}
          </Button>
          {(!agreed || acceptName.trim().length < 3) && !accepting && (
            <p className="pj-hint">Informe seu nome completo e marque a confirmação para continuar.</p>
          )}
        </div>
      )}

    </section>
  );
}


type SnapItem = CommercialProposalSnapshot["items"][number];

const TERM_HELP: Array<[RegExp, string]> = [
  [/^Taxa de administração/, "Percentual das receitas das reservas que remunera a gestão da STAYO."],
  [/^Manutenção/, "Pequenos reparos até esse valor podem ser feitos sem consultar você. Não é uma cobrança."],
  [/^Repasse — Airbnb/, "Quando o valor das reservas do Airbnb chega até você."],
  [/^Repasse — Booking/, "Quando o valor das reservas pelo Booking e diretas chega até você."],
  [/^Repasse/, "Quando e como o valor das reservas chega até você."],
  [/^Exclusividade/, "Indica se a STAYO será a única responsável pelas locações por temporada deste imóvel durante o acordo."],
  [/^Vigência/, "Por quanto tempo o acordo vale."],
  [/^Aviso prévio/, "Com quanta antecedência qualquer uma das partes avisa para encerrar."],
  [/^Limpeza inicial/, "Como o imóvel fica pronto para a primeira hospedagem."],
  [/^Limpeza entre/, "Quem faz a limpeza a cada troca de hóspede e quem paga por ela."],
];

function helpFor(label: string) {
  return TERM_HELP.find(([re]) => re.test(label))?.[1] ?? null;
}

function TermRow({ label, value }: { label: string; value: string }) {
  const help = helpFor(label);
  return (
    <div className="pj-term">
      <dt>{label.replace(/^Repasse — /, "Repasse · ")}</dt>
      <dd className="pj-term-value">{value}</dd>
      {help && <dd className="pj-term-help">{help}</dd>}
    </div>
  );
}

function serviceIcon(description: string) {
  if (/foto/i.test(description)) return <Camera aria-hidden="true" />;
  if (/enxoval|lavagem/i.test(description)) return <Shirt aria-hidden="true" />;
  if (/limpeza/i.test(description)) return <Sparkles aria-hidden="true" />;
  return <Wrench aria-hidden="true" />;
}

function ItemRow({ item, badge }: { item: SnapItem; badge: ItemPricing }) {
  const hasDetails = Boolean(item.details || (item.scope && item.scope.length > 0));
  const value =
    badge === "tbd"
      ? "Valor a definir"
      : badge === "conditional"
        ? Number(item.total) > 0
          ? `a partir de ${money.format(item.total)}`
          : "Valor a definir após avaliação"
        : money.format(item.total);
  const status = badge === "fixed" ? "Incluído" : badge === "conditional" ? "Sujeito a orçamento" : "A definir";
  const head = (
    <>
      <span className="pj-item-icon">{serviceIcon(item.description)}</span>
      <span className="pj-item-copy">
        <span className="pj-item-name">
          {item.quantity > 1 ? `${item.quantity}× ` : ""}{item.description}
        </span>
        <em className={`pj-badge is-${badge}`}>{status}</em>
      </span>
      <span className={`pj-item-value${badge === "fixed" ? "" : " is-soft"}`}>{value}</span>
      {hasDetails && <ChevronDown className="pj-chevron" aria-hidden="true" />}
    </>
  );
  if (!hasDetails) return <li className="pj-item"><div className="pj-item-head">{head}</div></li>;
  return (
    <li className="pj-item">
      <details>
        <summary className="pj-item-head">
          {head}
        </summary>
        <div className="pj-item-body">
          {item.details && <p>{item.details}</p>}
          {item.scope && item.scope.length > 0 && (
            <ul>
              {item.scope.map((s, j) => (
                <li key={j}>{s}</li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </li>
  );
}

type DecisionState = "defined" | "tbd" | "quote";
const DECISION_STATE_LABEL: Record<DecisionState, string> = {
  defined: "Definido",
  tbd: "A definir",
  quote: "Depende de orçamento",
};

function decisionState(it: ConditionItem, explicit?: DecisionState): DecisionState {
  if (explicit) return explicit;
  if (it.tbd) return "tbd";
  if (/valor a definir|depende de orçamento|conforme orçamento/i.test(it.help ?? "")) return "quote";
  return "defined";
}

function publicBlocks(snapshot: CommercialProposalSnapshot) {
  const c = snapshot.contractConditions ?? {};
  const sections = conditionSections(c);
  const terms = [...(snapshot.commercialTerms ?? [])]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map<ConditionItem>((t) => ({
      label: t.label,
      value: formatSnapshotTerm(t),
      ...(t.notes && t.chargeType !== "informational" ? { help: t.notes } : {}),
    }));
  const get = (k: string) => sections.find((s) => s.key === k);
  const management = [...(get("management")?.items ?? []), ...terms];
  const cleaning = get("cleaning")?.items ?? [];
  const use = get("owner_use")?.items ?? [];
  const cut = use.findIndex((i) => i.label === "Cessão de uso");
  const ownerUse = cut < 0 ? use : use.slice(0, cut);
  const assignment = cut < 0 ? [] : use.slice(cut);
  const rule = get("owner_use")?.note;
  return [
    {
      key: "management",
      title: "Gestão comercial",
      lead: management.some((item) => /^Repasse/.test(item.label))
        ? "Taxa, repasses, vigência e exclusividade."
        : "Taxa, vigência e exclusividade.",
      items: management,
    },
    { key: "cleaning", title: "Limpeza e operação", lead: "Valor da limpeza, quem faz e como é cobrada.", items: cleaning },
    { key: "owner_use", title: "Uso do imóvel pelo proprietário", lead: "Como reservar datas para você usar o imóvel.", items: ownerUse, note: rule },
    { key: "assignment", title: "Cessão para familiares ou convidados", lead: "Quando outra pessoa usa o imóvel com sua autorização.", items: assignment, note: assignment.length > 0 ? rule : undefined },
  ].filter((b) => b.items.length > 0);
}

function proposalFacts(snapshot: CommercialProposalSnapshot) {
  const c = snapshot.contractConditions ?? {};
  const presentation = publishedProposalPresentation(snapshot);
  const groups = presentation.groups;
  const decisions = implementationDecisionItems(c).map((decision) => {
    if (decision.label !== "Limpeza de implantação" || !presentation.cleaningDecision) return decision;
    return {
      ...decision,
      value: presentation.cleaningDecision.value,
      help: presentation.cleaningDecision.help,
      tbd: presentation.cleaningDecision.state === "quote",
      presentationState: presentation.cleaningDecision.state as DecisionState,
      presentationPrice: presentation.cleaningDecision.price,
    };
  });
  const fee = commercialCleaningFee(c);
  const hasPending =
    groups.pending.length > 0 ||
    fee == null ||
    decisions.some((d) =>
      decisionState(d, "presentationState" in d ? d.presentationState : undefined) !== "defined",
    );
  return {
    admin: formatPercent(c.administrationFee),
    duration: c.durationMonths ? `${c.durationMonths} meses` : null,
    cleaning: fee != null ? money.format(fee) : null,
    implementation: groups.fixed.length > 0 ? money.format(groups.fixedTotal) : null,
    hasPending,
    groups,
    decisions,
  };
}

function ProposalSnapshotSummary({ snapshot }: { snapshot: CommercialProposalSnapshot }) {
  const blocks = publicBlocks(snapshot);
  const facts = proposalFacts(snapshot);
  const { groups } = facts;
  const { fixed, optional, pending, fixedTotal } = groups;
  const [openBlock, setOpenBlock] = useState<string | null>(null);
  const content = [...(snapshot.content ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
  const responsibilities = (snapshot.responsibilities ?? []).filter((r) => r?.trim());
  const signatories = snapshot.requiredSignatories ?? [];
  const blockSummary = (key: string) => {
    if (key === "management") return `${facts.admin ?? "A definir"} · ${facts.duration ?? "A definir"}`;
    if (key === "cleaning") return facts.cleaning ? `${facts.cleaning} por utilização` : "Valor a definir";
    if (key === "owner_use") return ownerUseSummary(snapshot.contractConditions ?? {}) ?? "A definir";
    return "Conforme condições da proposta";
  };
  const toggleBlock = (key: string, open: boolean) => {
    setOpenBlock(open ? key : null);
  };
  return (
    <div className="pj-blocks">
      {blocks.length > 0 && (
        <section aria-labelledby="pj-cond-title">
          <h2 id="pj-cond-title" className="pj-section-title">Condições comerciais e contratuais</h2>
          <div className="pj-accordion">
            {blocks.map((b) => (
              <details
                key={b.key}
                className="pj-acc"
                open={openBlock === b.key}
              >
                <summary onClick={(event) => { event.preventDefault(); toggleBlock(b.key, openBlock !== b.key); }}>
                  <span className="pj-acc-text">
                    <span className="pj-acc-title">{b.title}</span>
                    <span className="pj-acc-tag">{blockSummary(b.key)}</span>
                  </span>
                  <ChevronDown className="pj-chevron" aria-hidden="true" />
                </summary>
                <dl className="pj-acc-body">
                  {b.items.map((it, i) => (
                    <div key={`${it.label}${i}`} className="pj-fact">
                      <dt>{it.label}</dt>
                      <dd className="pj-fact-value" data-tbd={it.tbd ? "true" : undefined}>{it.value}</dd>
                      {it.help && <dd className="pj-fact-help">{it.help}</dd>}
                    </div>
                  ))}
                  {b.note && <p className="pj-rule"><ShieldCheck aria-hidden="true" /> {b.note}</p>}
                </dl>
              </details>
            ))}
          </div>
        </section>
      )}

      {fixed.length + optional.length + pending.length > 0 && (
        <section aria-labelledby="pj-prep-title">
          <h2 id="pj-prep-title" className="pj-section-title">Preparação do imóvel</h2>
          <p className="pj-section-lead">Serviços para deixar o imóvel pronto. Toque num serviço para ver o que inclui.</p>
          <ul className="pj-items">
            {fixed.map((item, i) => <ItemRow key={`f${i}`} item={item} badge="fixed" />)}
            {pending.map((item, i) => <ItemRow key={`p${i}`} item={item} badge={resolvePricing(item)} />)}
            {optional.map((item, i) => <ItemRow key={`o${i}`} item={item} badge="optional" />)}
          </ul>
          <div className="pj-totals">
            <div className="pj-total">
              <span>Valor definido da implantação</span>
              <strong>{fixed.length ? money.format(fixedTotal) : "A definir"}</strong>
            </div>
            {pending.length + optional.length > 0 && (
              <div className="pj-total is-soft">
                <strong>
                  {pending.length + optional.length} {pending.length + optional.length === 1 ? "item pendente de definição" : "itens pendentes de definição"}
                </strong>
                <small>Valores pendentes serão combinados antes de qualquer cobrança.</small>
              </div>
            )}
          </div>
        </section>
      )}

      {(snapshot.partnershipObject || responsibilities.length > 0 || content.length > 0 || signatories.length > 0) && (
        <details className="pj-acc">
          <summary>
            <span className="pj-acc-text">
              <span className="pj-acc-title">Objeto e demais condições</span>
              <span className="pj-acc-lead">Responsabilidades e quem assina o contrato.</span>
            </span>
            <ChevronDown className="pj-chevron" aria-hidden="true" />
          </summary>
          <div className="pj-more-body pj-acc-body">
            {snapshot.partnershipObject && (<div><h3>Objeto da parceria</h3><p>{snapshot.partnershipObject}</p></div>)}
            {responsibilities.length > 0 && (
              <div><h3>Responsabilidades</h3><ul>{responsibilities.map((r, i) => <li key={i}>{r}</li>)}</ul></div>
            )}
            {content.map((block, i) => (<div key={i}><h3>{block.title}</h3><p>{block.body}</p></div>))}
            {signatories.length > 0 && (
              <div><h3>Quem assina o contrato</h3><ul>{signatories.map((s, i) => <li key={i}>{s.label}</li>)}</ul></div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatSnapshotTerm(term: ProposalSnapshotCommercialTerm) {
  const value = Number(term.value);
  if (term.chargeType === "percentage")
    return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value)}%`;
  if (term.chargeType === "fixed_once") return `${money.format(value)} · uma vez`;
  if (term.chargeType === "per_reservation") return `${money.format(value)} · por reserva`;
  if (term.chargeType === "monthly") return `${money.format(value)} · por mês`;
  if (term.chargeType === "optional") return value ? `${money.format(value)} · opcional` : "Opcional";
  return term.notes || "Condição informativa";
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
        title="Seus dados para o contrato"
        text="Confirme a identificação e o contato dos participantes."
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
    <div className="owner-registration-person">
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
  token,
  form,
  implementationName,
  errors,
  finishing,
  onSet,
  onBack,
  onContinue,
}: {
  token: string;
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
      <div className="rounded-2xl border border-[var(--portal-border)] bg-white p-4 text-xs text-[var(--portal-muted)]">
        <strong className="flex items-center gap-2 text-sm text-[var(--portal-navy)]">
          <KeyRound className="size-4" /> Acesso e Wi-Fi ficam para depois
        </strong>
        <p className="mt-1">
          Senhas, códigos e Wi-Fi não são pedidos por este link. Você informa depois, já com seu
          login no Portal do Proprietário.
        </p>
      </div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
        <strong className="block">Importante</strong>
        <p className="mt-1">
          Dados enviados aqui alimentam a implantação administrativa. Nada é publicado
          automaticamente no Guia do Hóspede sem revisão da equipe STAYO.
        </p>
      </div>
      <OwnerSuppliersSection token={token} />
      <OwnerGuide token={token} guideType="utensilios" />
      <OwnerGuide token={token} guideType="enxoval" />
      <Actions
        onBack={onBack}
        onContinue={onContinue}
        label="Revisar antes de enviar"
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
  const raw =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message)
        : "";
  const message = raw.toLocaleLowerCase("pt-BR");
  if (message.includes("já enviado")) return "Seu cadastro já foi enviado para análise.";
  if (message.includes("confirme as condições"))
    return "Confirme as condições da proposta antes de continuar.";
  if (message.includes("acesso inválido")) return "Este link não está mais disponível.";
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
