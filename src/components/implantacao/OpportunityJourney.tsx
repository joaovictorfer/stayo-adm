import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  ChevronRight,
  CircleUserRound,
  ClipboardCheck,
  CloudOff,
  Copy,
  ExternalLink,
  FileText,
  House,
  Info,
  Link2,
  Loader2,
  MoreHorizontal,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import {
  CondominiumForm,
  emptyCondominiumForm,
  inputFromForm,
  type CondominiumFormValues,
} from "../condominios/CondominiumForm";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { DeleteImplementationButton } from "./DeleteImplementationButton";
import { PropertySuppliersPanel } from "../suppliers/PropertySuppliersPanel";
import { GuidePanel } from "./guide/GuidePanel";
import { GuidedInventoryPanel } from "./guide/GuidedInventoryPanel";
import { supabase } from "@/integrations/supabase/client";
import {
  useOpportunityAutosave,
  type SaveState,
} from "../../hooks/use-opportunity-autosave";
import {
  autosaveOpportunity,
  loadOpportunityForm,
  type FormField,
  type FormValues,
} from "../../lib/api/opportunity-form";
import {
  completeOpportunityDraft,
  saveOpportunityContact,
} from "../../lib/api/opportunities";
import {
  adminApi,
  adminCondominiumsListQuery,
  commercialTermDefaultsQuery,
  coreApi,
} from "../../lib/api/queries";
import { commercialProposalsApi } from "../../lib/api/commercial-proposals";
import { opportunityPreparationSummaryQuery } from "../../lib/api/opportunity-review";
import {
  presentationInvitesApi,
  presentationUrl,
} from "../../lib/api/presentation-invites";
import {
  buildGuidedDraftInput,
  guidedOptionsFromVersion,
  guidedProposalIssue,
  optionFromTemplate,
} from "../../lib/guided-proposal";
import { formatBrazilianPhone } from "../../lib/owner-form-validation";
import {
  JOURNEY_STEPS,
  proposalNumberChoice,
  validateContact,
  type JourneyStep,
} from "../../lib/opportunity-journey";
import type { ImplementationProject } from "../../types/core";
import type { AdminCondominium } from "../../types/admin";
import { PROPOSAL_ITEM_TEMPLATES } from "../../config/proposal-item-templates";
import { resolveQuickCommercialConfirmationDefaults } from "../../config/commercial-defaults";
import type {
  CommercialProposalVersion,
  ProposalItemOption,
} from "../../types/commercial-proposal";

const inputClass =
  "w-full min-h-12 rounded-[var(--radius-control)] border px-3 py-3 text-base outline-none transition focus:ring-2 focus:ring-[var(--stayo-forest)]/25";
const inputStyle = {
  backgroundColor: "var(--stayo-surface)",
  borderColor: "var(--stayo-border)",
  color: "var(--stayo-ink)",
};
const muted = { color: "var(--stayo-ink-muted)" };

type Cond = Partial<
  Record<
    | "administration_fee"
    | "turnover_cleaning_fee"
    | "initial_cleaning_option"
    | "initial_cleaning_other"
    | "linen_mode"
    | "advisory_mode"
    | "exclusivity"
    | "duration_months"
    | "notice_period_days"
    | "owner_use_limit_mode"
    | "owner_use_limit_days"
    | "owner_use_limit_period"
    | "assignment_mode",
    unknown
  >
>;

export function OpportunityJourney(props: {
  implementation: ImplementationProject;
  step: JourneyStep;
  onStepChange: (step: JourneyStep) => void;
  onExit: () => void;
}) {
  const formQ = useQuery({
    queryKey: ["opportunity", "form", props.implementation.id],
    queryFn: () => loadOpportunityForm(props.implementation.id),
    staleTime: Infinity,
  });
  if (formQ.isPending)
    return (
      <p className="flex items-center gap-2 py-10 text-sm" style={muted}>
        <Loader2 className="size-4 animate-spin" /> Abrindo o cadastro…
      </p>
    );
  if (formQ.isError || !formQ.data)
    return (
      <div role="alert" className="py-10 text-sm">
        Não conseguimos abrir o cadastro.{" "}
        <button
          type="button"
          className="underline"
          onClick={() => void formQ.refetch()}
        >
          Tentar novamente
        </button>
      </div>
    );
  return <JourneyBody {...props} initial={formQ.data.values} />;
}

function JourneyBody({
  implementation,
  step,
  onStepChange,
  onExit,
  initial,
}: {
  implementation: ImplementationProject;
  step: JourneyStep;
  onStepChange: (step: JourneyStep) => void;
  onExit: () => void;
  initial: FormValues;
}) {
  const id = implementation.id;
  const queryClient = useQueryClient();
  const auto = useOpportunityAutosave(id, initial);
  const v = auto.values ?? initial;
  const index = JOURNEY_STEPS.findIndex((s) => s.id === step);
  const topRef = useRef<HTMLDivElement>(null);

  // Contato (nome/telefone) salvo à parte, com o mesmo padrão de debounce.
  const [contact, setContact] = useState({
    name: implementation.ownerName ?? "",
    phone: implementation.ownerPhone
      ? formatBrazilianPhone(implementation.ownerPhone.replace(/^55/, ""))
      : "",
  });
  const [contactState, setContactState] = useState<SaveState>("idle");
  const contactTimer = useRef<number | null>(null);
  const contactDirty = useRef(false);
  const saveContact = async (): Promise<boolean> => {
    if (!contactDirty.current) return true;
    const errs = validateContact({ title: v.nickname || "xxx", ...contact });
    if (errs.name || errs.phone) {
      setContactState("error");
      return false;
    }
    setContactState("saving");
    try {
      await saveOpportunityContact(id, {
        contactName: contact.name,
        phone: contact.phone,
        title: "",
        existingOwnerId: null,
      });
      contactDirty.current = false;
      setContactState("saved");
      void queryClient.invalidateQueries({ queryKey: ["implementations"] });
      return true;
    } catch {
      setContactState("error");
      return false;
    }
  };
  const changeContact = (k: "name" | "phone", value: string) => {
    setContact((c) => ({
      ...c,
      [k]: k === "phone" ? formatBrazilianPhone(value) : value,
    }));
    contactDirty.current = true;
    setContactState("saving");
    if (contactTimer.current) window.clearTimeout(contactTimer.current);
    contactTimer.current = window.setTimeout(() => void saveContact(), 900);
  };

  // Condições da proposta: gravação por coluna em implementation_contract_conditions.
  const condQ = useQuery({
    queryKey: ["implementation-contract-conditions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implementation_contract_conditions")
        .select("*")
        .eq("implementation_id", id)
        .maybeSingle();
      if (error) throw error;
      return data as Cond | null;
    },
  });
  const commercialDefaultsQ = useQuery(commercialTermDefaultsQuery());
  const [cond, setCond] = useState<Cond>({});
  useEffect(() => {
    if (condQ.data) setCond(condQ.data);
  }, [condQ.data]);
  const [condState, setCondState] = useState<SaveState>("idle");
  const condPending = useRef<Cond>({});
  const condRunning = useRef<Promise<boolean> | null>(null);
  const runCondSave = useCallback(async (): Promise<boolean> => {
    if (condRunning.current) await condRunning.current;
    const patch = condPending.current;
    if (!Object.keys(patch).length) return true;
    condPending.current = {};
    setCondState("saving");
    const request = (async () => {
      try {
        const { error } = await supabase
          .from("implementation_contract_conditions")
          .upsert(
            {
              implementation_id: id,
              ...patch,
              updated_at: new Date().toISOString(),
            } as never,
            {
              onConflict: "implementation_id",
            },
          );
        if (error) throw error;
        setCondState(
          Object.keys(condPending.current).length ? "saving" : "saved",
        );
        return true;
      } catch {
        condPending.current = { ...patch, ...condPending.current };
        setCondState("error");
        return false;
      }
    })();
    condRunning.current = request;
    const ok = await request;
    condRunning.current = null;
    if (ok && Object.keys(condPending.current).length) return runCondSave();
    return ok;
  }, [id]);
  const setC = (patch: Cond) => {
    setCond((c) => ({ ...c, ...patch }));
    condPending.current = { ...condPending.current, ...patch };
    setCondState("saving");
    void runCondSave();
  };

  // Uma implantação sem linha de condições recebe o padrão vigente uma única
  // vez. Depois disso, a própria linha é o snapshot editável da implantação.
  const defaultsInitialized = useRef(false);
  useEffect(() => {
    if (
      step !== "proposta" ||
      condQ.isPending ||
      commercialDefaultsQ.isPending ||
      condQ.data !== null ||
      defaultsInitialized.current
    )
      return;
    defaultsInitialized.current = true;
    const defaults = resolveQuickCommercialConfirmationDefaults(
      commercialDefaultsQ.data ?? [],
    );
    const initial: Cond = {
      administration_fee: defaults.administrationFee,
      turnover_cleaning_fee: defaults.turnoverCleaningFee,
      exclusivity: defaults.exclusivity,
      duration_months: defaults.durationMonths,
      notice_period_days: defaults.noticePeriodDays,
    };
    // Só exibe o padrão; grava junto com a primeira edição ou ao avançar.
    setCond(initial);
    condPending.current = { ...condPending.current, ...initial };
  }, [
    commercialDefaultsQ.data,
    commercialDefaultsQ.isPending,
    condQ.data,
    condQ.isPending,
    runCondSave,
    step,
  ]);

  const proposalsQ = useQuery({
    queryKey: ["commercial-proposals", id],
    queryFn: () => commercialProposalsApi.list(id),
  });
  const preparationReviewQ = useQuery({
    ...opportunityPreparationSummaryQuery(id),
    enabled: step === "revisao",
  });
  const versions = proposalsQ.data ?? [];
  const draftProposal =
    versions.find((version) => version.status === "draft") ?? null;
  const latestPublished =
    versions.find((version) => version.status !== "draft") ?? null;
  const proposalSource = draftProposal ?? latestPublished;
  const [proposalOptions, setProposalOptions] = useState<ProposalItemOption[]>(
    [],
  );
  const [proposalLoadedKey, setProposalLoadedKey] = useState<string | null>(
    null,
  );
  const [proposalState, setProposalState] = useState<SaveState>("idle");
  const proposalDirty = useRef(false);
  const proposalOptionsRef = useRef<ProposalItemOption[]>([]);
  const proposalRunning = useRef<Promise<boolean> | null>(null);
  const proposalTimer = useRef<number | null>(null);
  useEffect(() => {
    const key = proposalSource
      ? `${proposalSource.id}:${proposalSource.status}:${proposalSource.draftRevision}:${proposalSource.updatedAt}`
      : "empty";
    if (proposalDirty.current || key === proposalLoadedKey) return;
    const restored = guidedOptionsFromVersion(proposalSource ?? null);
    proposalOptionsRef.current = restored;
    setProposalOptions(restored);
    setProposalLoadedKey(key);
  }, [proposalLoadedKey, proposalSource]);

  const saveProposal = useCallback(async (): Promise<boolean> => {
    if (proposalRunning.current) await proposalRunning.current;
    const currentOptions = proposalOptionsRef.current;
    if (!proposalDirty.current || guidedProposalIssue(currentOptions))
      return true;
    setProposalState("saving");
    const request = (async () => {
      try {
        const saved = await commercialProposalsApi.saveDraft(
          buildGuidedDraftInput({
            implementationId: id,
            version: draftProposal ?? latestPublished,
            options: currentOptions,
            commandId: crypto.randomUUID(),
          }),
        );
        proposalDirty.current = false;
        setProposalLoadedKey(
          `${saved.id}:${saved.status}:${saved.draftRevision}:${saved.updatedAt}`,
        );
        setProposalState("saved");
        await queryClient.invalidateQueries({
          queryKey: ["commercial-proposals", id],
        });
        return true;
      } catch {
        setProposalState("error");
        return false;
      }
    })();
    proposalRunning.current = request;
    const ok = await request;
    proposalRunning.current = null;
    return ok;
  }, [draftProposal, id, latestPublished, queryClient]);

  const changeProposalOptions = (next: ProposalItemOption[]) => {
    proposalOptionsRef.current = next;
    setProposalOptions(next);
    proposalDirty.current = true;
    setProposalState("saving");
    if (proposalTimer.current) window.clearTimeout(proposalTimer.current);
    proposalTimer.current = window.setTimeout(() => void saveProposal(), 900);
  };

  // Navegar entre etapas não grava. A etapa só é registrada depois de uma
  // edição real do usuário (estado salvo diferente do idle).
  const lastSavedStep = useRef<string | null>(null);
  const userEdited = [auto.state, contactState, condState, proposalState].some(
    (s) => s !== "idle",
  );
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [id, step]);
  useEffect(() => {
    if (!userEdited || lastSavedStep.current === step) return;
    lastSavedStep.current = step;
    void autosaveOpportunity(id, { draft_step: step }, {}).catch(
      () => undefined,
    );
  }, [id, step, userEdited]);

  const saveState: SaveState = [
    auto.state,
    contactState,
    condState,
    proposalState,
  ].includes("error")
    ? "error"
    : [auto.state, contactState, condState, proposalState].includes("saving")
      ? "saving"
      : [auto.state, contactState, condState, proposalState].includes("saved")
        ? "saved"
        : "idle";
  const retry = () => {
    void auto.retry();
    void saveContact();
    if (condState === "error") void runCondSave();
    if (proposalState === "error") void saveProposal();
  };

  const flushAll = async () => {
    if (contactTimer.current) window.clearTimeout(contactTimer.current);
    if (proposalTimer.current) window.clearTimeout(proposalTimer.current);
    const [a, b, c, d] = await Promise.all([
      auto.flush(),
      saveContact(),
      runCondSave(),
      saveProposal(),
    ]);
    if (!a || !b || !c || !d)
      toast.error("Não foi possível salvar agora", {
        description: "O que você digitou continua aqui.",
      });
    return a && b && c && d;
  };
  const [editingFromReview, setEditingFromReview] = useState(false);
  const go = async (next: JourneyStep) => {
    const ok = await flushAll();
    if (ok) {
      onStepChange(next);
    }
    return ok;
  };
  const editFromReview = async (next: JourneyStep) => {
    const ok = await go(next);
    if (ok) setEditingFromReview(true);
  };
  const returnToReview = async () => {
    const ok = await flushAll();
    if (!ok) return;
    setEditingFromReview(false);
    onStepChange("revisao");
  };
  const exit = async () => {
    const ok = await flushAll();
    if (ok) onExit();
  };

  const [publishedResult, setPublishedResult] = useState<{
    version: CommercialProposalVersion;
    link: string | null;
  } | null>(null);
  const finalSubmission = useRef<"complete" | "publish" | null>(null);

  const isLast = index === JOURNEY_STEPS.length - 1;
  const next = async () => {
    if (editingFromReview) return void returnToReview();
    if (!isLast) void go(JOURNEY_STEPS[index + 1]!.id);
  };
  const back = async () => {
    if (editingFromReview) return void returnToReview();
    if (index > 0) void go(JOURNEY_STEPS[index - 1]!.id);
    else void exit();
  };

  const complete = useMutation({
    mutationFn: async () => {
      const ok = await flushAll();
      if (!ok) throw new Error("Salve os dados antes de criar a ficha.");
      await completeOpportunityDraft(id);
    },
    onSuccess: () => {
      toast.success("Ficha criada", {
        description: "Nada foi enviado ao proprietário.",
      });
      onExit();
    },
    onError: (e) =>
      toast.error(
        e instanceof Error ? e.message : "Não foi possível concluir.",
      ),
  });

  const proposalIssue = guidedProposalIssue(proposalOptions);
  const publish = useMutation({
    mutationFn: async () => {
      if (proposalIssue) throw new Error(proposalIssue);
      const ok = await flushAll();
      if (!ok) throw new Error("Salve os dados antes de publicar a proposta.");

      // Criar a ficha continua sendo uma ação separada da publicação no banco.
      // Nesta ação composta, concluímos o rascunho primeiro; o comando é idempotente.
      await completeOpportunityDraft(id);

      const currentVersions = await commercialProposalsApi.list(id);
      const currentDraft =
        currentVersions.find((version) => version.status === "draft") ?? null;
      const currentPublished =
        currentVersions.find((version) => version.status === "published") ??
        currentVersions.find((version) => version.status === "accepted") ??
        currentVersions.find((version) => version.status !== "draft") ??
        null;

      // Sem draft novo, uma versão já publicada é reutilizada. Isso evita criar
      // proposta idêntica apenas porque o usuário voltou à revisão e clicou de novo.
      let published = currentPublished;
      if (currentDraft) {
        published = await commercialProposalsApi.publish({
          proposalId: currentDraft.id,
          expectedRevision: currentDraft.draftRevision,
          commandId: crypto.randomUUID(),
        });
      } else if (!published) {
        const saved = await commercialProposalsApi.saveDraft(
          buildGuidedDraftInput({
            implementationId: id,
            version: null,
            options: proposalOptionsRef.current,
            commandId: crypto.randomUUID(),
          }),
        );
        published = await commercialProposalsApi.publish({
          proposalId: saved.id,
          expectedRevision: saved.draftRevision,
          commandId: crypto.randomUUID(),
        });
      }

      if (!published)
        throw new Error("Não foi possível localizar a proposta publicada.");
      return published;
    },
    onSuccess: async (published) => {
      // Publicar não gera/revoga token automaticamente. O link seguro existente
      // continua disponível como ação explícita na confirmação de publicação.
      setPublishedResult({ version: published, link: null });
      await queryClient.invalidateQueries({
        queryKey: ["commercial-proposals", id],
      });
      toast.success("Ficha criada e proposta publicada", {
        description: "Nenhuma mensagem foi enviada ao proprietário.",
      });
    },
    onError: (error) =>
      toast.error("Não foi possível criar e publicar", {
        description:
          error instanceof Error
            ? error.message
            : "Revise os dados e tente novamente.",
      }),
  });
  const submitComplete = () => {
    if (finalSubmission.current) return;
    finalSubmission.current = "complete";
    complete.mutate(undefined, {
      onSettled: () => {
        finalSubmission.current = null;
      },
    });
  };
  const submitPublish = () => {
    if (finalSubmission.current) return;
    finalSubmission.current = "publish";
    publish.mutate(undefined, {
      onSettled: () => {
        finalSubmission.current = null;
      },
    });
  };

  let content: ReactNode = null;
  if (step === "contato") {
    content = (
      <div className="flex flex-col gap-4">
        <TextField
          label="Título da implantação"
          value={v.nickname}
          onChange={(x) => auto.set("nickname", x)}
        />
        <TextField
          label="Nome do proprietário"
          value={contact.name}
          onChange={(x) => changeContact("name", x)}
        />
        <TextField
          label="Telefone / WhatsApp"
          value={contact.phone}
          inputMode="tel"
          onChange={(x) => changeContact("phone", x)}
          error={
            contactState === "error"
              ? validateContact({ title: "xxx", ...contact }).phone
              : undefined
          }
        />
      </div>
    );
  } else if (step === "imovel") {
    content = (
      <PropertyQuestions
        implementationId={id}
        initialCondominiumId={implementation.condominiumId ?? null}
        v={v}
        set={auto.set}
        flush={auto.flush}
      />
    );
  } else if (step === "proposta") {
    content = condQ.isPending ? (
      <div className="flex items-center gap-2 py-10 text-sm" style={muted}>
        <Loader2 className="size-4 animate-spin" /> Carregando condições da
        proposta…
      </div>
    ) : (
      <ProposalBlocks
        cond={cond}
        setC={setC}
        proposalOptions={proposalOptions}
        onProposalOptionsChange={changeProposalOptions}
        proposalsPending={proposalsQ.isPending}
      />
    );
  } else if (step === "implantacao") {
    content = (
      <PreparationWorkspace
        implementationId={id}
        notes={v.notes}
        ownerNotes={v.owner_facing_notes}
        onNotesChange={(value) => auto.set("notes", value)}
        onOwnerNotesChange={(value) => auto.set("owner_facing_notes", value)}
      />
    );
  } else {
    const propertyIdentification =
      [v.condominium_name, v.tower, v.unit]
        .map((value) => value.trim())
        .filter(Boolean)
        .join(" · ") ||
      [v.address, v.city]
        .map((value) => value.trim())
        .filter(Boolean)
        .join(" · ") ||
      "Identificação a completar";
    const propertyFacts = [
      reviewPropertyType(v.property_type),
      reviewBedrooms(v.bedrooms),
      v.capacity ? `até ${v.capacity} hóspedes` : "Capacidade a definir",
    ]
      .filter(Boolean)
      .join(" · ");
    const commercialPrimary = [
      cond.administration_fee == null
        ? "Administração a definir"
        : `${cond.administration_fee}% administração`,
      cond.turnover_cleaning_fee == null
        ? "Limpeza a definir"
        : `${formatReviewMoney(cond.turnover_cleaning_fee)} limpeza`,
    ].join(" · ");
    const commercialSecondary = [
      reviewPreparationLabel(cond),
      cond.exclusivity === true
        ? "Exclusividade"
        : cond.exclusivity === false
          ? "Sem exclusividade"
          : "Exclusividade a definir",
      cond.duration_months == null
        ? "Vigência a definir"
        : `${cond.duration_months} meses`,
      cond.notice_period_days == null
        ? "Aviso a definir"
        : `${cond.notice_period_days} dias`,
    ].join(" · ");
    const preparationPrimary = preparationReviewQ.isPending
      ? "Carregando resumo…"
      : preparationReviewQ.isError
        ? "Resumo indisponível"
        : `${preparationReviewQ.data?.checked ?? 0} itens conferidos · ${preparationReviewQ.data?.missing ?? 0} ${preparationReviewQ.data?.missing === 1 ? "faltante" : "faltantes"}`;

    content = publishedResult ? (
      <PublishedProposalSuccess
        result={publishedResult}
        implementationId={id}
        onBack={onExit}
        onLinkGenerated={(link) =>
          setPublishedResult((current) =>
            current ? { ...current, link } : current,
          )
        }
      />
    ) : (
      <div className="flex flex-col gap-4">
        <section
          className="overflow-hidden rounded-[var(--radius-card)] border"
          style={{
            backgroundColor: "var(--stayo-surface)",
            borderColor: "var(--stayo-border)",
          }}
        >
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Tudo certo para criar
            </h2>
            <p className="mt-1 text-sm" style={muted}>
              Você pode completar os demais detalhes depois.
            </p>
          </div>
          <div
            className="border-t px-4 sm:px-6"
            style={{ borderColor: "var(--stayo-border)" }}
          >
            <ReviewSummaryRow
              icon={CircleUserRound}
              title="Contato"
              primary={contact.name || "Proprietário a completar"}
              secondary={contact.phone || "Telefone a completar"}
              onEdit={() => void editFromReview("contato")}
            />
            <ReviewSummaryRow
              icon={House}
              title="Imóvel"
              primary={propertyIdentification}
              secondary={propertyFacts}
              onEdit={() => void editFromReview("imovel")}
            />
            <ReviewSummaryRow
              icon={FileText}
              title="Comercial"
              primary={commercialPrimary}
              secondary={commercialSecondary}
              onEdit={() => void editFromReview("proposta")}
            />
            <ReviewSummaryRow
              icon={ClipboardCheck}
              title="Preparação"
              primary={preparationPrimary}
              secondary={
                preparationReviewQ.isError
                  ? "Edite a preparação para conferir os itens."
                  : "Os demais itens podem ser conferidos depois."
              }
              onEdit={() => void editFromReview("implantacao")}
            />
            <div
              className="my-4 flex items-start gap-2 rounded-[var(--radius-control)] px-3 py-3 text-xs sm:text-sm"
              style={{
                backgroundColor: "var(--stayo-surface-muted)",
                color: "var(--stayo-ink-muted)",
              }}
            >
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>
                Fornecedores e observações não bloqueiam a criação da ficha.
              </p>
            </div>
          </div>
        </section>

        {proposalIssue && (
          <div
            role="alert"
            className="rounded-[var(--radius-card)] border border-[var(--stayo-warning)] bg-[var(--stayo-gold-soft)] p-4"
          >
            <p className="text-sm font-semibold">{proposalIssue}</p>
            <Button
              type="button"
              variant="outline"
              className="mt-3 min-h-11"
              onClick={() => void go("proposta")}
            >
              Resolver
            </Button>
          </div>
        )}

        <p className="text-right text-xs" style={muted}>
          A proposta será publicada somente ao confirmar.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            className="min-h-12 sm:min-w-28"
            disabled={complete.isPending || publish.isPending}
            onClick={() => void back()}
          >
            Voltar
          </Button>
          <div className="hidden sm:block sm:flex-1" />
          <Button
            type="button"
            variant="outline"
            className="min-h-12 sm:min-w-36"
            disabled={complete.isPending || publish.isPending}
            onClick={submitComplete}
          >
            {complete.isPending && <Loader2 className="size-4 animate-spin" />}
            Criar ficha
          </Button>
          <Button
            type="button"
            className="min-h-12 bg-[var(--stayo-forest)] text-[var(--primary-foreground)] hover:bg-[var(--stayo-forest)]/90 sm:min-w-56"
            disabled={
              Boolean(proposalIssue) || complete.isPending || publish.isPending
            }
            onClick={submitPublish}
          >
            {publish.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowRight className="size-4" />
            )}
            Criar e publicar proposta
          </Button>
        </div>
      </div>
    );
  }

  const propertyStep = step === "imovel";
  const commercialStep = step === "proposta";
  const preparationStep = step === "implantacao";
  const reviewStep = step === "revisao";

  return (
    <div
      ref={topRef}
      className={`mx-auto flex w-full flex-col pb-28 sm:pb-6 ${
        propertyStep || commercialStep || preparationStep || reviewStep
          ? "max-w-5xl gap-6"
          : "max-w-2xl gap-5"
      }`}
    >
      {propertyStep ? (
        <PropertyJourneyHeader
          implementation={implementation}
          saveState={saveState}
          onRetry={retry}
          onExit={exit}
        />
      ) : commercialStep ? (
        <CommercialJourneyHeader
          implementation={implementation}
          saveState={saveState}
          onRetry={retry}
          onExit={exit}
        />
      ) : preparationStep ? (
        <PreparationJourneyHeader
          implementation={implementation}
          saveState={saveState}
          onRetry={retry}
          onExit={exit}
        />
      ) : reviewStep ? (
        <ReviewJourneyHeader
          implementation={implementation}
          saveState={saveState}
          onRetry={retry}
          onExit={exit}
        />
      ) : (
        <header className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              aria-label="Voltar para ficha"
              onClick={() => void exit()}
              className="flex min-h-11 items-center gap-1.5 text-sm font-medium"
              style={{ color: "var(--stayo-forest)" }}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Voltar para ficha
            </Button>
            <JourneyActions implementation={implementation} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-semibold">
              {implementation.code}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <SaveStatus state={saveState} onRetry={retry} compact />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold">
              {JOURNEY_STEPS[index]!.label} · Etapa {index + 1} de{" "}
              {JOURNEY_STEPS.length}
            </h2>
          </div>
          <div
            className="flex gap-1"
            role="progressbar"
            aria-valuenow={index + 1}
            aria-valuemin={1}
            aria-valuemax={JOURNEY_STEPS.length}
          >
            {JOURNEY_STEPS.map((s, i) => (
              <span
                key={s.id}
                className="h-1 flex-1 rounded-full"
                style={{
                  backgroundColor:
                    i <= index ? "var(--stayo-forest)" : "var(--stayo-border)",
                }}
              />
            ))}
          </div>
        </header>
      )}

      <div>{content}</div>

      {step !== "revisao" && (
        <footer
          className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:static sm:border-0 sm:p-0"
          style={{
            backgroundColor: "var(--stayo-surface)",
            borderColor: "var(--stayo-border)",
          }}
        >
          <Button
            type="button"
            variant="outline"
            className="min-h-12"
            onClick={back}
          >
            {editingFromReview ? "Voltar para revisão" : "Voltar etapa"}
          </Button>
          <Button
            type="button"
            onClick={() => void next()}
            className="min-h-12 flex-1 bg-[var(--stayo-forest)] text-[var(--primary-foreground)] hover:bg-[var(--stayo-forest)]/90 sm:ml-auto sm:flex-none sm:px-8"
          >
            {editingFromReview ? "Salvar e voltar" : "Continuar"}
          </Button>
        </footer>
      )}
    </div>
  );
}

const PROPERTY_PROGRESS = [
  "Contato",
  "Imóvel",
  "Comercial",
  "Preparação",
  "Revisão",
] as const;

type PreparationTab = "inventario" | "enxoval" | "fornecedores" | "observacoes";

const PREPARATION_TABS: Array<{ id: PreparationTab; label: string }> = [
  { id: "inventario", label: "Inventário" },
  { id: "enxoval", label: "Enxoval" },
  { id: "fornecedores", label: "Fornecedores" },
  { id: "observacoes", label: "Observações" },
];

function PreparationWorkspace({
  implementationId,
  notes,
  ownerNotes,
  onNotesChange,
  onOwnerNotesChange,
}: {
  implementationId: string;
  notes: string;
  ownerNotes: string;
  onNotesChange: (value: string) => void;
  onOwnerNotesChange: (value: string) => void;
}) {
  const [tab, setTab] = useState<PreparationTab>("inventario");
  return (
    <section
      className="overflow-hidden rounded-[var(--radius-card)] border"
      style={{
        backgroundColor: "var(--stayo-surface)",
        borderColor: "var(--stayo-border)",
      }}
    >
      <nav
        className="flex overflow-x-auto border-b px-2 pt-2 sm:px-4"
        style={{ borderColor: "var(--stayo-border)" }}
        role="tablist"
        aria-label="Preparação do imóvel"
      >
        {PREPARATION_TABS.map((entry) => {
          const active = tab === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(entry.id)}
              className="relative min-h-11 shrink-0 px-3 text-sm font-medium sm:px-4"
              style={{
                color: active
                  ? "var(--stayo-forest)"
                  : "var(--stayo-ink-muted)",
              }}
            >
              {entry.label}
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-2 bottom-0 h-0.5 rounded-full"
                  style={{ backgroundColor: "var(--stayo-forest)" }}
                />
              )}
            </button>
          );
        })}
      </nav>
      <div className="p-3 sm:p-5">
        {tab === "inventario" ? (
          <GuidedInventoryPanel implementationId={implementationId} />
        ) : tab === "enxoval" ? (
          <GuidePanel implementationId={implementationId} guideType="enxoval" />
        ) : tab === "fornecedores" ? (
          <PropertySuppliersPanel implementationId={implementationId} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextArea
              label="Observações internas"
              value={notes}
              onChange={onNotesChange}
            />
            <TextArea
              label="Informações para o proprietário"
              value={ownerNotes}
              onChange={onOwnerNotesChange}
            />
          </div>
        )}
      </div>
    </section>
  );
}

function PreparationJourneyHeader({
  implementation,
  saveState,
  onRetry,
  onExit,
}: {
  implementation: ImplementationProject;
  saveState: SaveState;
  onRetry: () => void;
  onExit: () => Promise<void>;
}) {
  const activeIndex = 3;
  return (
    <header className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold">
            {implementation.code}
          </span>
          <span
            className="rounded-full px-2 py-1 text-[11px] font-semibold"
            style={{
              backgroundColor: "var(--stayo-gold-soft)",
              color: "var(--stayo-ink)",
            }}
          >
            Rascunho
          </span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <SaveStatus
              state={saveState}
              onRetry={onRetry}
              compact
            />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-10 px-3"
            onClick={() => void onExit()}
          >
            Voltar para ficha
          </Button>
          <JourneyActions implementation={implementation} />
        </div>
      </div>
      <div>
        <p
          className="text-xs font-semibold uppercase tracking-[0.12em]"
          style={muted}
        >
          Implantação · Etapa 4 de 5
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Preparação do imóvel
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm" style={muted}>
          Confira inventário e enxoval com poucos cliques. Fornecedores e
          observações continuam opcionais.
        </p>
      </div>
      <ol className="grid grid-cols-5" aria-label="Etapas da implantação">
        {PROPERTY_PROGRESS.map((label, i) => {
          const complete = i < activeIndex;
          const active = i === activeIndex;
          return (
            <li
              key={label}
              className="relative flex min-w-0 flex-col items-center gap-1.5"
            >
              {i < PROPERTY_PROGRESS.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute left-1/2 right-[-50%] top-4 h-px"
                  style={{
                    backgroundColor: complete
                      ? "var(--stayo-forest)"
                      : "var(--stayo-border)",
                  }}
                />
              )}
              <span
                aria-hidden="true"
                className="relative z-10 grid size-8 place-items-center rounded-full border text-xs font-semibold"
                style={{
                  borderColor:
                    complete || active
                      ? "var(--stayo-forest)"
                      : "var(--stayo-border)",
                  backgroundColor: complete
                    ? "var(--stayo-forest)"
                    : "var(--stayo-surface)",
                  color: complete
                    ? "var(--primary-foreground)"
                    : "var(--stayo-ink)",
                }}
              >
                {complete ? <Check className="size-4" /> : i + 1}
              </span>
              <span
                className="max-w-full text-center text-[10px] font-medium leading-tight sm:text-xs"
                style={{
                  color: active ? "var(--stayo-ink)" : "var(--stayo-ink-muted)",
                }}
                aria-current={active ? "step" : undefined}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </header>
  );
}

function ReviewJourneyHeader({
  implementation,
  saveState,
  onRetry,
  onExit,
}: {
  implementation: ImplementationProject;
  saveState: SaveState;
  onRetry: () => void;
  onExit: () => Promise<void>;
}) {
  const activeIndex = 4;
  return (
    <header className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold">
            {implementation.code}
          </span>
          <span
            className="rounded-full px-2 py-1 text-[11px] font-semibold"
            style={{
              backgroundColor: "var(--stayo-gold-soft)",
              color: "var(--stayo-ink)",
            }}
          >
            Rascunho
          </span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <SaveStatus
              state={saveState}
              onRetry={onRetry}
              compact
            />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-10 px-3"
            onClick={() => void onExit()}
          >
            Voltar para ficha
          </Button>
          <JourneyActions implementation={implementation} />
        </div>
      </div>

      <div>
        <p
          className="text-sm font-semibold"
          style={{ color: "var(--stayo-ink)" }}
        >
          Implantação · Etapa 5 de 5
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Revisão
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm" style={muted}>
          Confira o essencial antes de criar a ficha.
        </p>
      </div>

      <ol className="grid grid-cols-5" aria-label="Etapas da implantação">
        {PROPERTY_PROGRESS.map((label, i) => {
          const complete = i < activeIndex;
          const active = i === activeIndex;
          return (
            <li
              key={label}
              className="relative flex min-w-0 flex-col items-center gap-1.5"
            >
              {i < PROPERTY_PROGRESS.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute left-1/2 right-[-50%] top-4 h-px"
                  style={{
                    backgroundColor: complete
                      ? "var(--stayo-forest)"
                      : "var(--stayo-border)",
                  }}
                />
              )}
              <span
                aria-hidden="true"
                className="relative z-10 grid size-8 place-items-center rounded-full border text-xs font-semibold"
                style={{
                  borderColor: "var(--stayo-forest)",
                  backgroundColor:
                    complete || active
                      ? "var(--stayo-forest)"
                      : "var(--stayo-surface)",
                  color:
                    complete || active
                      ? "var(--primary-foreground)"
                      : "var(--stayo-ink)",
                }}
              >
                {complete ? <Check className="size-4" /> : i + 1}
              </span>
              <span
                className="max-w-full text-center text-[10px] font-medium leading-tight sm:text-xs"
                style={{
                  color: active ? "var(--stayo-ink)" : "var(--stayo-ink-muted)",
                }}
                aria-current={active ? "step" : undefined}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </header>
  );
}

function PropertyJourneyHeader({
  implementation,
  saveState,
  onRetry,
  onExit,
}: {
  implementation: ImplementationProject;
  saveState: SaveState;
  onRetry: () => void;
  onExit: () => Promise<void>;
}) {
  const activeIndex = 1;
  return (
    <header className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold">
            {implementation.code}
          </span>
          <span
            className="rounded-full px-2 py-1 text-[11px] font-semibold"
            style={{
              backgroundColor: "var(--stayo-gold-soft)",
              color: "var(--stayo-ink)",
            }}
          >
            Rascunho
          </span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <SaveStatus
              state={saveState}
              onRetry={onRetry}
              compact
            />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-10 px-3"
            onClick={() => void onExit()}
          >
            Voltar para ficha
          </Button>
          <JourneyActions implementation={implementation} />
        </div>
      </div>

      <div>
        <p
          className="text-xs font-semibold uppercase tracking-[0.12em]"
          style={muted}
        >
          Implantação · Etapa 2 de 5
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Dados do imóvel
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm" style={muted}>
          Identifique o imóvel e registre apenas as informações que já são
          conhecidas.
        </p>
      </div>

      <ol className="grid grid-cols-5" aria-label="Etapas da implantação">
        {PROPERTY_PROGRESS.map((label, i) => {
          const complete = i < activeIndex;
          const active = i === activeIndex;
          return (
            <li
              key={label}
              className="relative flex min-w-0 flex-col items-center gap-1.5"
            >
              {i < PROPERTY_PROGRESS.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute left-1/2 right-[-50%] top-4 h-px"
                  style={{
                    backgroundColor: complete
                      ? "var(--stayo-forest)"
                      : "var(--stayo-border)",
                  }}
                />
              )}
              <span
                aria-hidden="true"
                className="relative z-10 grid size-8 place-items-center rounded-full border text-xs font-semibold"
                style={{
                  borderColor:
                    complete || active
                      ? "var(--stayo-forest)"
                      : "var(--stayo-border)",
                  backgroundColor: complete
                    ? "var(--stayo-forest)"
                    : active
                      ? "var(--stayo-surface)"
                      : "var(--stayo-surface)",
                  color: complete
                    ? "var(--primary-foreground)"
                    : "var(--stayo-ink)",
                }}
              >
                {complete ? <Check className="size-4" /> : i + 1}
              </span>
              <span
                className="max-w-full text-center text-[10px] font-medium leading-tight sm:text-xs"
                style={{
                  color: active ? "var(--stayo-ink)" : "var(--stayo-ink-muted)",
                }}
                aria-current={active ? "step" : undefined}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </header>
  );
}

function CommercialJourneyHeader({
  implementation,
  saveState,
  onRetry,
  onExit,
}: {
  implementation: ImplementationProject;
  saveState: SaveState;
  onRetry: () => void;
  onExit: () => Promise<void>;
}) {
  const activeIndex = 2;
  return (
    <header className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold">
            {implementation.code}
          </span>
          <span
            className="rounded-full px-2 py-1 text-[11px] font-semibold"
            style={{
              backgroundColor: "var(--stayo-gold-soft)",
              color: "var(--stayo-ink)",
            }}
          >
            Rascunho
          </span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <SaveStatus
              state={saveState}
              onRetry={onRetry}
              compact
            />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-10 px-3"
            onClick={() => void onExit()}
          >
            Voltar para ficha
          </Button>
          <JourneyActions implementation={implementation} />
        </div>
      </div>

      <div>
        <p
          className="text-xs font-semibold uppercase tracking-[0.12em]"
          style={muted}
        >
          Implantação · Etapa 3 de 5
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Condições comerciais
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm" style={muted}>
          O padrão STAYO já está preenchido. Confirme ou ajuste somente o que
          for necessário.
        </p>
      </div>

      <ol className="grid grid-cols-5" aria-label="Etapas da implantação">
        {PROPERTY_PROGRESS.map((label, i) => {
          const complete = i < activeIndex;
          const active = i === activeIndex;
          return (
            <li
              key={label}
              className="relative flex min-w-0 flex-col items-center gap-1.5"
            >
              {i < PROPERTY_PROGRESS.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute left-1/2 right-[-50%] top-4 h-px"
                  style={{
                    backgroundColor: complete
                      ? "var(--stayo-forest)"
                      : "var(--stayo-border)",
                  }}
                />
              )}
              <span
                aria-hidden="true"
                className="relative z-10 grid size-8 place-items-center rounded-full border text-xs font-semibold"
                style={{
                  borderColor:
                    complete || active
                      ? "var(--stayo-forest)"
                      : "var(--stayo-border)",
                  backgroundColor: complete
                    ? "var(--stayo-forest)"
                    : "var(--stayo-surface)",
                  color: complete
                    ? "var(--primary-foreground)"
                    : "var(--stayo-ink)",
                }}
              >
                {complete ? <Check className="size-4" /> : i + 1}
              </span>
              <span
                className="max-w-full text-center text-[10px] font-medium leading-tight sm:text-xs"
                style={{
                  color: active ? "var(--stayo-ink)" : "var(--stayo-ink-muted)",
                }}
                aria-current={active ? "step" : undefined}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </header>
  );
}

function JourneyActions({
  implementation,
}: {
  implementation: ImplementationProject;
}) {
  const locked =
    implementation.status === "ativo" ||
    Boolean(
      (implementation as { corePropertyId?: string | null }).corePropertyId,
    );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label="Mais ações"
        >
          <MoreHorizontal className="size-5" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DeleteImplementationButton
          id={implementation.id}
          code={implementation.code}
          locked={locked}
          trigger={
            <DropdownMenuItem
              onSelect={(event) => event.preventDefault()}
              className="cursor-pointer text-[var(--stayo-danger)] focus:text-[var(--stayo-danger)]"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Excluir oportunidade
            </DropdownMenuItem>
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SaveStatus({
  state,
  onRetry,
  compact = false,
}: {
  state: SaveState;
  onRetry: () => void;
  compact?: boolean;
}) {
  if (state === "idle" || state === "saved") return null;
  if (state === "error")
    return (
      <p
        role="status"
        className={
          compact
            ? "flex items-center gap-1 text-xs whitespace-nowrap"
            : "flex items-center gap-1.5 text-xs"
        }
        style={{ color: "var(--stayo-danger)" }}
      >
        <CloudOff className="size-3.5" /> Não foi possível salvar ·{" "}
        <button type="button" className="underline" onClick={onRetry}>
          tentar novamente
        </button>
      </p>
    );
  return (
    <p
      role="status"
      className={
        compact
          ? "flex items-center gap-1 text-xs whitespace-nowrap"
          : "flex items-center gap-1.5 text-xs"
      }
      style={muted}
    >
      {state === "saving" ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Check className="size-3.5" />
      )}
      Salvando…
    </p>
  );
}

function TextField({
  label,
  value,
  onChange,
  inputMode,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: "tel" | "numeric" | "decimal";
  error?: string | undefined;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input
        value={value}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
        style={inputStyle}
      />
      {error && (
        <span
          className="mt-1 block text-xs"
          style={{ color: "var(--stayo-danger)" }}
        >
          {error}
        </span>
      )}
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <textarea
        value={value}
        rows={4}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
        style={inputStyle}
      />
    </label>
  );
}

function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: string }>;
  value: T | null | undefined;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className="min-h-11 rounded-full border px-4 text-sm font-medium transition"
            style={{
              borderColor: active
                ? "var(--stayo-forest)"
                : "var(--stayo-border)",
              backgroundColor: active
                ? "var(--stayo-forest)"
                : "var(--stayo-surface)",
              color: active ? "var(--primary-foreground)" : "var(--stayo-ink)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Question({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-base font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function ReviewSummaryRow({
  icon: Icon,
  title,
  primary,
  secondary,
  onEdit,
}: {
  icon: LucideIcon;
  title: string;
  primary: string;
  secondary: string;
  onEdit: () => void;
}) {
  return (
    <div
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 border-b py-4 last:border-b-0 sm:grid-cols-[13rem_minmax(0,1fr)_auto] sm:items-center sm:py-5"
      style={{ borderColor: "var(--stayo-border)" }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-full"
          style={{
            backgroundColor: "var(--stayo-surface-muted)",
            color: "var(--stayo-ink)",
          }}
        >
          <Icon className="size-4.5" aria-hidden="true" />
        </span>
        <h3 className="truncate text-sm font-semibold sm:text-base">{title}</h3>
      </div>
      <div className="col-start-2 min-w-0 sm:col-start-auto">
        <p className="text-sm font-medium sm:text-base">{primary}</p>
        <p className="mt-0.5 text-xs sm:text-sm" style={muted}>
          {secondary}
        </p>
      </div>
      <div className="row-start-1 col-start-3 sm:row-start-auto sm:col-start-auto">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-10 px-2 text-[var(--stayo-forest)]"
          onClick={onEdit}
        >
          Editar
        </Button>
      </div>
    </div>
  );
}

function formatReviewMoney(value: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Limpeza a definir";
  return amount.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function reviewPropertyType(value: string): string {
  if (!value.trim()) return "Tipo a definir";
  return value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1);
}

function reviewBedrooms(value: string): string {
  if (!value.trim()) return "Quartos a definir";
  const count = Number(value);
  if (count === 0) return "Studio";
  if (count === 1) return "1 quarto";
  return `${value} quartos`;
}

function reviewPreparationLabel(cond: Cond): string {
  const option = String(cond.initial_cleaning_option ?? "");
  if (option === "owner_delivers") return "Proprietário entrega limpo";
  if (option === "stayo_initial") return "Limpeza de implantação STAYO";
  if (option === "stayo_post_construction") return "Limpeza pós-obra";
  if (
    option === "other" &&
    String(cond.initial_cleaning_other ?? "")
      .trim()
      .toLocaleLowerCase("pt-BR") === "limpeza comercial"
  ) {
    return "Limpeza comercial";
  }
  if (option === TBD) return "Preparação a definir";
  if (option === "other" && String(cond.initial_cleaning_other ?? "").trim()) {
    return String(cond.initial_cleaning_other).trim();
  }
  return "Preparação a definir";
}

function PropertyQuestions({
  implementationId,
  initialCondominiumId,
  v,
  set,
  flush,
}: {
  implementationId: string;
  initialCondominiumId: string | null;
  v: FormValues;
  set: (f: FormField, x: string) => void;
  flush: () => Promise<boolean>;
}) {
  const queryClient = useQueryClient();
  const condominiumsQ = useQuery(adminCondominiumsListQuery());
  const condominiums = condominiumsQ.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(
    initialCondominiumId,
  );
  const [mode, setMode] = useState<"search" | "condo" | "standalone">(
    initialCondominiumId
      ? "condo"
      : v.address && !v.condominium_name
        ? "standalone"
        : "search",
  );
  const [search, setSearch] = useState(
    initialCondominiumId ? "" : v.condominium_name,
  );
  const [creating, setCreating] = useState(false);
  const [newCondo, setNewCondo] = useState<CondominiumFormValues>(() => ({
    ...emptyCondominiumForm,
  }));
  const [newCondoError, setNewCondoError] = useState<string | null>(null);
  const [savingCondo, setSavingCondo] = useState(false);

  const selected = condominiums.find((item) => item.id === selectedId) ?? null;
  const normalize = (value: string | null | undefined) =>
    (value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleLowerCase("pt-BR");
  const filtered = condominiums
    .filter((item) => {
      const term = normalize(search);
      return (
        !term || normalize(`${item.name} ${item.city ?? ""}`).includes(term)
      );
    })
    .slice(0, 6);

  const selectCondominium = async (condominium: AdminCondominium) => {
    setSavingCondo(true);
    try {
      await coreApi.implementations.update(implementationId, {
        condominiumId: condominium.id,
      });
      setSelectedId(condominium.id);
      setMode("condo");
      setSearch("");
      set("condominium_name", condominium.name);
      set("address", condominium.address ?? "");
      set("city", condominium.city ?? "");
      set("postal_code", condominium.postalCode ?? "");
      if (!(await flush())) {
        toast.error(
          "Condomínio vinculado, mas o endereço ainda não sincronizou.",
        );
      }
      void queryClient.invalidateQueries({ queryKey: ["implementations"] });
    } catch (error) {
      toast.error("Não foi possível vincular o condomínio", {
        description:
          error instanceof Error ? error.message : "Tente novamente.",
      });
    } finally {
      setSavingCondo(false);
    }
  };

  const chooseStandalone = async () => {
    setSavingCondo(true);
    try {
      await coreApi.implementations.update(implementationId, {
        condominiumId: null,
      });
      setSelectedId(null);
      setMode("standalone");
      set("condominium_name", "");
      await flush();
      void queryClient.invalidateQueries({ queryKey: ["implementations"] });
    } catch (error) {
      toast.error("Não foi possível atualizar o imóvel", {
        description:
          error instanceof Error ? error.message : "Tente novamente.",
      });
    } finally {
      setSavingCondo(false);
    }
  };

  const createCondominium = async () => {
    const name = newCondo.name.trim();
    if (!name) {
      setNewCondoError("Informe o nome do condomínio.");
      return;
    }
    const duplicate = condominiums.find(
      (item) =>
        normalize(item.name) === normalize(name) &&
        normalize(item.city) === normalize(newCondo.city),
    );
    if (duplicate) {
      setCreating(false);
      setNewCondoError(null);
      toast.info("Este condomínio já estava cadastrado. Ele foi selecionado.");
      await selectCondominium(duplicate);
      return;
    }

    setSavingCondo(true);
    setNewCondoError(null);
    try {
      const created = await adminApi.condominiums.create(
        inputFromForm(newCondo),
      );
      queryClient.setQueryData<AdminCondominium[]>(
        ["admin", "condominiums", "list"],
        (current = []) =>
          [...current.filter((item) => item.id !== created.id), created].sort(
            (a, b) => a.name.localeCompare(b.name, "pt-BR"),
          ),
      );
      setCreating(false);
      setNewCondo({ ...emptyCondominiumForm });
      await selectCondominium(created);
      toast.success("Condomínio cadastrado");
    } catch (error) {
      setNewCondoError(
        error instanceof Error
          ? error.message
          : "Não foi possível cadastrar o condomínio.",
      );
    } finally {
      setSavingCondo(false);
    }
  };

  const bedroomsValue =
    v.property_type === "studio"
      ? "studio"
      : v.bedrooms
        ? Number(v.bedrooms) >= 4
          ? "4"
          : v.bedrooms
        : "";
  const capacityValue = v.capacity
    ? Number(v.capacity) >= 8
      ? "8"
      : v.capacity
    : "";
  return (
    <div className="flex flex-col gap-4">
      <section
        className="rounded-[var(--radius-card)] border p-4 sm:p-5"
        style={{ ...inputStyle, backgroundColor: "var(--stayo-surface)" }}
      >
        <div className="mb-4">
          <h2 className="text-base font-semibold">Condomínio e localização</h2>
          <p className="mt-1 text-xs sm:text-sm" style={muted}>
            Use o cadastro mestre para reaproveitar o endereço e evitar
            informações duplicadas.
          </p>
        </div>

        {mode === "condo" && selected ? (
          <div
            className="rounded-xl border p-3.5"
            style={{ borderColor: "var(--stayo-border)" }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{selected.name}</p>
                <p
                  className="mt-1 flex items-center gap-1.5 text-xs font-medium"
                  style={{
                    color: selected.address
                      ? "var(--stayo-forest)"
                      : "var(--stayo-ink-muted)",
                  }}
                >
                  {selected.address && <Check className="size-3.5" />}
                  {selected.address
                    ? "Endereço já cadastrado"
                    : "Endereço pendente no cadastro do condomínio"}
                </p>
                {(selected.address || selected.city) && (
                  <p className="mt-1.5 text-sm" style={muted}>
                    {[selected.address, selected.city, selected.state]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-10"
                onClick={() => setMode("search")}
              >
                Trocar
              </Button>
            </div>
          </div>
        ) : mode === "standalone" ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Imóvel sem condomínio</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMode("search")}
              >
                Buscar condomínio
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_140px]">
              <TextField
                label="Endereço"
                value={v.address}
                onChange={(x) => set("address", x)}
              />
              <TextField
                label="Cidade"
                value={v.city}
                onChange={(x) => set("city", x)}
              />
              <TextField
                label="CEP"
                inputMode="numeric"
                value={v.postal_code}
                onChange={(x) => set("postal_code", x)}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <label className="block">
              <span className="sr-only">Buscar condomínio cadastrado</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar condomínio cadastrado..."
                className={inputClass}
                style={inputStyle}
                autoComplete="off"
              />
            </label>
            {condominiumsQ.isPending ? (
              <p className="flex items-center gap-2 py-2 text-sm" style={muted}>
                <Loader2 className="size-4 animate-spin" /> Buscando
                condomínios…
              </p>
            ) : condominiumsQ.isError ? (
              <p className="text-sm" style={{ color: "var(--stayo-danger)" }}>
                Não foi possível carregar os condomínios.
              </p>
            ) : filtered.length ? (
              <div
                className="divide-y overflow-hidden rounded-xl border"
                style={{ borderColor: "var(--stayo-border)" }}
              >
                {filtered.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={savingCondo}
                    onClick={() => void selectCondominium(item)}
                    className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-black/[0.025] disabled:opacity-60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {item.name}
                      </span>
                      <span className="block truncate text-xs" style={muted}>
                        {[item.address, item.city]
                          .filter(Boolean)
                          .join(" · ") || "Endereço a completar"}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0" style={muted} />
                  </button>
                ))}
              </div>
            ) : (
              <p className="py-1 text-sm" style={muted}>
                Nenhum condomínio encontrado.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <button
                type="button"
                className="min-h-10 text-sm font-semibold"
                style={{ color: "var(--stayo-forest)" }}
                onClick={() => setCreating((current) => !current)}
              >
                + Cadastrar novo condomínio
              </button>
              <button
                type="button"
                disabled={savingCondo}
                className="min-h-10 text-sm underline-offset-4 hover:underline disabled:opacity-60"
                style={muted}
                onClick={() => void chooseStandalone()}
              >
                Imóvel sem condomínio
              </button>
            </div>

            {creating && (
              <div
                className="mt-1 rounded-xl border p-4"
                style={{
                  backgroundColor:
                    "color-mix(in srgb, var(--stayo-surface) 96%, var(--stayo-forest))",
                  borderColor: "var(--stayo-border)",
                }}
              >
                <div className="mb-3">
                  <p className="font-semibold">Novo condomínio</p>
                  <p className="mt-0.5 text-xs" style={muted}>
                    O cadastro ficará disponível para as próximas implantações.
                  </p>
                </div>
                <CondominiumForm
                  values={newCondo}
                  onChange={setNewCondo}
                  nameError={newCondoError}
                />
                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setCreating(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    disabled={savingCondo}
                    className="bg-[var(--stayo-forest)] text-[var(--primary-foreground)] hover:bg-[var(--stayo-forest)]/90"
                    onClick={() => void createCondominium()}
                  >
                    {savingCondo && <Loader2 className="size-4 animate-spin" />}
                    Cadastrar e selecionar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {(mode === "condo" || mode === "standalone") && (
        <section
          className="rounded-[var(--radius-card)] border p-4 sm:p-5"
          style={{ ...inputStyle, backgroundColor: "var(--stayo-surface)" }}
        >
          <h2 className="mb-4 text-base font-semibold">Identificação</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {mode === "condo" && (
              <>
                <TextField
                  label="Torre / bloco"
                  value={v.tower}
                  onChange={(x) => set("tower", x)}
                />
                <TextField
                  label="Unidade"
                  value={v.unit}
                  onChange={(x) => set("unit", x)}
                />
              </>
            )}
            <div className={mode === "standalone" ? "sm:col-span-3" : ""}>
              <TextField
                label="Nome / apelido"
                value={v.nickname}
                onChange={(x) => set("nickname", x)}
              />
            </div>
          </div>
        </section>
      )}

      <section
        className="rounded-[var(--radius-card)] border p-4 sm:p-5"
        style={{ ...inputStyle, backgroundColor: "var(--stayo-surface)" }}
      >
        <h2 className="mb-4 text-base font-semibold">Características</h2>
        <div className="grid gap-5 lg:grid-cols-3">
          <Question title="Tipo">
            <Chips
              label="Tipo"
              value={v.property_type || null}
              onChange={(x) => set("property_type", x === "nsei" ? "" : x)}
              options={[
                { value: "apartamento", label: "Apartamento" },
                { value: "casa", label: "Casa" },
                { value: "studio", label: "Studio" },
                { value: "outro", label: "Outro" },
                { value: "nsei", label: "Não sei" },
              ]}
            />
          </Question>
          <Question title="Quartos">
            <Chips
              label="Quartos"
              value={bedroomsValue || null}
              onChange={(x) => {
                if (x === "studio") {
                  set("property_type", "studio");
                  set("bedrooms", "0");
                } else set("bedrooms", x === "nsei" ? "" : x);
              }}
              options={[
                { value: "studio", label: "Studio" },
                { value: "1", label: "1" },
                { value: "2", label: "2" },
                { value: "3", label: "3" },
                { value: "4", label: "4+" },
                { value: "nsei", label: "Não sei" },
              ]}
            />
          </Question>
          <Question title="Capacidade de hóspedes">
            <Chips
              label="Capacidade"
              value={capacityValue || null}
              onChange={(x) => set("capacity", x === "nsei" ? "" : x)}
              options={[
                { value: "2", label: "2" },
                { value: "4", label: "4" },
                { value: "6", label: "6" },
                { value: "8", label: "8+" },
                { value: "nsei", label: "Não sei" },
              ]}
            />
          </Question>
        </div>
      </section>
    </div>
  );
}

const TBD = "tbd";

function ProposalBlocks({
  cond,
  setC,
  proposalOptions,
  onProposalOptionsChange,
  proposalsPending,
}: {
  cond: Cond;
  setC: (patch: Cond) => void;
  proposalOptions: ProposalItemOption[];
  onProposalOptionsChange: (options: ProposalItemOption[]) => void;
  proposalsPending: boolean;
}) {
  const num = (value: unknown) =>
    value === null || value === undefined || value === "" ? "" : String(value);
  const money = (value: unknown) =>
    value === null || value === undefined || value === ""
      ? ""
      : Number(value).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  const boolChoice =
    cond.exclusivity === true
      ? "sim"
      : cond.exclusivity === false
        ? "nao"
        : null;
  const duration = proposalNumberChoice(cond.duration_months, [6, 12]);
  const notice = proposalNumberChoice(cond.notice_period_days, [30, 60]);
  const preparationValue =
    cond.initial_cleaning_option === "other" &&
    String(cond.initial_cleaning_other ?? "")
      .trim()
      .toLocaleLowerCase("pt-BR") === "limpeza comercial"
      ? "commercial_cleaning"
      : (cond.initial_cleaning_option as string | undefined);
  const cleaningLabel =
    cond.turnover_cleaning_fee == null
      ? "Limpeza comercial · a definir"
      : `Limpeza comercial · R$ ${money(cond.turnover_cleaning_fee)}`;

  const setPreparation = (value: string) => {
    if (value === "commercial_cleaning") {
      setC({
        initial_cleaning_option: "other",
        initial_cleaning_other: "Limpeza comercial",
      });
      return;
    }
    setC({ initial_cleaning_option: value, initial_cleaning_other: null });
  };

  return (
    <section
      className="rounded-[var(--radius-card)] border p-4 sm:p-6"
      style={{ ...inputStyle, backgroundColor: "var(--stayo-surface)" }}
    >
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-semibold">Padrão STAYO</h2>
          <p className="mt-1 text-sm" style={muted}>
            Estes valores já vêm confirmados para uma nova implantação e podem
            ser ajustados aqui.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">
              Taxa de administração
            </span>
            <div className="relative">
              <input
                aria-label="Taxa de administração"
                key={num(cond.administration_fee)}
                inputMode="decimal"
                defaultValue={num(cond.administration_fee)}
                onBlur={(event) => {
                  const value = Number(event.target.value.replace(",", "."));
                  setC({
                    administration_fee:
                      event.target.value.trim() === "" || Number.isNaN(value)
                        ? null
                        : Math.min(100, Math.max(0, value)),
                  });
                }}
                className={`${inputClass} pr-10`}
                style={inputStyle}
              />
              <span
                className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium"
                style={muted}
              >
                %
              </span>
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">
              Limpeza comercial
            </span>
            <div className="relative">
              <span
                className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium"
                style={muted}
              >
                R$
              </span>
              <input
                aria-label="Limpeza comercial"
                key={money(cond.turnover_cleaning_fee)}
                inputMode="decimal"
                defaultValue={money(cond.turnover_cleaning_fee)}
                onBlur={(event) => {
                  const value = Number(
                    event.target.value.replace(/\./g, "").replace(",", "."),
                  );
                  setC({
                    turnover_cleaning_fee:
                      event.target.value.trim() === "" || Number.isNaN(value)
                        ? null
                        : Math.max(0, value),
                  });
                }}
                className={`${inputClass} pl-10`}
                style={inputStyle}
              />
            </div>
          </label>
        </div>

        <div
          className="border-t pt-5"
          style={{ borderColor: "var(--stayo-border)" }}
        >
          <Question title="Preparação para operação">
            <p className="text-sm" style={muted}>
              Como o imóvel será entregue para iniciar a operação?
            </p>
            <Chips
              label="Preparação para operação"
              value={preparationValue}
              onChange={setPreparation}
              options={[
                {
                  value: "owner_delivers",
                  label: "Proprietário entrega limpo",
                },
                {
                  value: "stayo_initial",
                  label: "Limpeza de implantação STAYO",
                },
                { value: "commercial_cleaning", label: cleaningLabel },
                { value: "stayo_post_construction", label: "Limpeza pós-obra" },
                { value: TBD, label: "A definir" },
              ]}
            />
            {preparationValue === "commercial_cleaning" && (
              <p className="text-xs" style={muted}>
                Usa o mesmo valor de Limpeza comercial acima; não há um segundo
                valor para preencher.
              </p>
            )}
          </Question>
        </div>

        <div
          className="border-t pt-5"
          style={{ borderColor: "var(--stayo-border)" }}
        >
          <h2 className="mb-4 text-lg font-semibold">Contrato</h2>
          <div className="grid gap-5 lg:grid-cols-3">
            <Question title="Exclusividade">
              <Chips
                label="Exclusividade"
                value={
                  boolChoice ??
                  (cond.exclusivity === null && "exclusivity" in cond
                    ? TBD
                    : null)
                }
                onChange={(value) =>
                  setC({
                    exclusivity:
                      value === "sim" ? true : value === "nao" ? false : null,
                  })
                }
                options={[
                  { value: "sim", label: "Sim" },
                  { value: "nao", label: "Não" },
                  { value: TBD, label: "A definir" },
                ]}
              />
            </Question>
            <Question title="Vigência">
              <NumberChoice
                value={duration}
                current={num(cond.duration_months)}
                unit="meses"
                presets={["6", "12"]}
                onChange={(value) => setC({ duration_months: value })}
              />
            </Question>
            <Question title="Aviso prévio">
              <NumberChoice
                value={notice}
                current={num(cond.notice_period_days)}
                unit="dias"
                presets={["30", "60"]}
                onChange={(value) => setC({ notice_period_days: value })}
              />
            </Question>
          </div>
        </div>

        <details
          className="border-t pt-5"
          style={{ borderColor: "var(--stayo-border)" }}
        >
          <summary className="cursor-pointer text-sm font-semibold">
            Condições e serviços adicionais
            <span className="ml-2 font-normal" style={muted}>
              ({proposalOptions.filter((item) => item.included).length} serviços
              selecionados)
            </span>
          </summary>
          <p className="mt-1 text-xs" style={muted}>
            Itens menos frequentes continuam disponíveis aqui e na edição
            avançada.
          </p>
          <div className="mt-5 flex flex-col gap-5">
            <Question title="Enxoval">
              <Chips
                label="Enxoval"
                value={cond.linen_mode as string}
                onChange={(value) => setC({ linen_mode: value })}
                options={[
                  { value: "complete", label: "Já possui completo" },
                  { value: "partial", label: "Possui parcialmente" },
                  {
                    value: "stayo_supplier",
                    label: "Fornecedor indicado pela STAYO",
                  },
                  { value: TBD, label: "A decidir" },
                ]}
              />
            </Question>
            <Question title="Assessoria">
              <Chips
                label="Assessoria"
                value={cond.advisory_mode as string}
                onChange={(value) => setC({ advisory_mode: value })}
                options={[
                  {
                    value: "implementation_only",
                    label: "Somente implantação",
                  },
                  { value: "full", label: "Completa" },
                  { value: TBD, label: "A decidir" },
                ]}
              />
            </Question>
            <Question title="Uso próprio pelo proprietário">
              <Chips
                label="Uso próprio pelo proprietário"
                value={cond.owner_use_limit_mode as string}
                onChange={(value) => setC({ owner_use_limit_mode: value })}
                options={[
                  { value: "unlimited", label: "Sem limite" },
                  { value: "limited", label: "Com limite" },
                  { value: TBD, label: "A definir" },
                ]}
              />
              {cond.owner_use_limit_mode === "limited" && (
                <div className="grid gap-3 pt-1 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium">
                      Quantidade de dias
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        key={num(cond.owner_use_limit_days)}
                        inputMode="numeric"
                        defaultValue={num(cond.owner_use_limit_days)}
                        onBlur={(event) => {
                          const value = Number.parseInt(event.target.value, 10);
                          setC({
                            owner_use_limit_days: Number.isNaN(value)
                              ? null
                              : Math.max(0, value),
                          });
                        }}
                        className={inputClass}
                        style={inputStyle}
                      />
                      <span className="text-sm">dias</span>
                    </div>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium">
                      Período
                    </span>
                    <input
                      key={num(cond.owner_use_limit_period)}
                      defaultValue={num(cond.owner_use_limit_period)}
                      onBlur={(event) =>
                        setC({
                          owner_use_limit_period:
                            event.target.value.trim() || null,
                        })
                      }
                      placeholder="Ex.: por ano"
                      className={inputClass}
                      style={inputStyle}
                    />
                  </label>
                </div>
              )}
            </Question>
            <Question title="Cessão do imóvel a terceiros">
              <Chips
                label="Cessão do imóvel a terceiros"
                value={cond.assignment_mode as string}
                onChange={(value) => setC({ assignment_mode: value })}
                options={[
                  { value: "allowed", label: "Permitida" },
                  { value: "not_allowed", label: "Não permitida" },
                  { value: TBD, label: "A definir" },
                ]}
              />
            </Question>
            <GuidedServices
              options={proposalOptions}
              onChange={onProposalOptionsChange}
              pending={proposalsPending}
            />
          </div>
        </details>
      </div>
    </section>
  );
}

function GuidedServices({
  options,
  onChange,
  pending,
}: {
  options: ProposalItemOption[];
  onChange: (options: ProposalItemOption[]) => void;
  pending: boolean;
}) {
  const [addingOther, setAddingOther] = useState(false);
  const [otherName, setOtherName] = useState("");
  const [otherValue, setOtherValue] = useState("");
  const byTemplate = new Map(
    options.map((option) => [option.templateKey, option]),
  );
  const custom = options.filter((option) => !option.templateKey);
  const toggleTemplate = (key: string, checked: boolean) => {
    const existing = byTemplate.get(key);
    if (existing) {
      onChange(
        options.map((option) =>
          option === existing ? { ...option, included: checked } : option,
        ),
      );
      return;
    }
    const template = PROPOSAL_ITEM_TEMPLATES.find((item) => item.key === key);
    if (template && checked)
      onChange([...options, optionFromTemplate(template)]);
  };
  const addOther = () => {
    const value = Number(otherValue.replace(".", "").replace(",", "."));
    if (!otherName.trim() || Number.isNaN(value) || value < 0) return;
    onChange([
      ...options,
      {
        description: otherName.trim(),
        quantity: 1,
        unitValue: value,
        discount: 0,
        included: true,
        optional: false,
        templateKey: null,
        details: "",
        scope: [],
        pricing: "fixed",
      },
    ]);
    setOtherName("");
    setOtherValue("");
    setAddingOther(false);
  };
  return (
    <Question title="Serviços desta proposta">
      <p className="text-sm" style={muted}>
        Selecione apenas o que fará parte desta versão.
      </p>
      {pending ? (
        <p className="text-sm" style={muted}>
          Carregando serviços…
        </p>
      ) : (
        <div className="space-y-2">
          {PROPOSAL_ITEM_TEMPLATES.map((template) => {
            const option = byTemplate.get(template.key);
            return (
              <label
                key={template.key}
                className="flex min-h-14 items-center gap-3 rounded-[var(--radius-control)] border p-3"
                style={inputStyle}
              >
                <Checkbox
                  className="size-5"
                  checked={Boolean(option?.included)}
                  onCheckedChange={(checked) =>
                    toggleTemplate(template.key, checked === true)
                  }
                />
                <span className="min-w-0 flex-1 text-sm font-medium">
                  {template.description}
                </span>
                <span className="shrink-0 text-sm tabular-nums">
                  {template.unitValue.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </span>
              </label>
            );
          })}
          {custom.map((option, index) => (
            <label
              key={`${option.description}-${index}`}
              className="flex min-h-14 items-center gap-3 rounded-[var(--radius-control)] border p-3"
              style={inputStyle}
            >
              <Checkbox
                className="size-5"
                checked={option.included}
                onCheckedChange={(checked) =>
                  onChange(
                    options.map((item) =>
                      item === option
                        ? { ...item, included: checked === true }
                        : item,
                    ),
                  )
                }
              />
              <span className="min-w-0 flex-1 text-sm font-medium">
                {option.description}
              </span>
              <span className="shrink-0 text-sm tabular-nums">
                {option.unitValue.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </span>
            </label>
          ))}
        </div>
      )}
      {addingOther ? (
        <div
          className="grid gap-3 rounded-[var(--radius-control)] border p-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end"
          style={inputStyle}
        >
          <TextField
            label="Nome do serviço"
            value={otherName}
            onChange={setOtherName}
          />
          <TextField
            label="Valor (R$)"
            value={otherValue}
            inputMode="decimal"
            onChange={setOtherValue}
          />
          <Button
            type="button"
            className="min-h-12"
            disabled={!otherName.trim() || !otherValue.trim()}
            onClick={addOther}
          >
            Adicionar
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 self-start"
          onClick={() => setAddingOther(true)}
        >
          Outro serviço
        </Button>
      )}
    </Question>
  );
}

function PublishedProposalSuccess({
  result,
  implementationId,
  onBack,
  onLinkGenerated,
}: {
  result: { version: CommercialProposalVersion; link: string | null };
  implementationId: string;
  onBack: () => void;
  onLinkGenerated: (link: string) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const generateLink = async () => {
    setGenerating(true);
    try {
      const issued = await presentationInvitesApi.issue({
        implementationId,
        proposalId: result.version.id,
        validDays: 15,
      });
      onLinkGenerated(presentationUrl(issued.token));
      toast.success("Link gerado");
    } catch (error) {
      toast.error("Não foi possível gerar o link", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setGenerating(false);
    }
  };
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--stayo-success)] bg-[var(--stayo-forest-soft)] p-4 sm:p-5">
      <div className="flex items-center gap-2 text-[var(--stayo-success)]">
        <Check className="size-5" />
        <h3 className="font-semibold">Proposta publicada</h3>
      </div>
      <p className="mt-1 text-sm">Versão {result.version.version}</p>
      {result.link ? (
        <>
          <label className="mt-4 block text-xs font-medium" style={muted}>
            Link do proprietário
          </label>
          <input
            readOnly
            value={result.link}
            onFocus={(event) => event.target.select()}
            className={`${inputClass} mt-1`}
            style={inputStyle}
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Button
              type="button"
              onClick={() =>
                void navigator.clipboard
                  .writeText(result.link ?? "")
                  .then(() => toast.success("Link copiado"))
              }
            >
              <Copy className="size-4" /> Copiar link
            </Button>
            <Button asChild type="button" variant="outline">
              <a href={result.link} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" /> Abrir como proprietário
              </a>
            </Button>
            <Button type="button" variant="outline" onClick={onBack}>
              Voltar para implantação
            </Button>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-[var(--radius-control)] border border-[var(--stayo-warning)] bg-[var(--stayo-gold-soft)] p-3">
          <p className="text-sm">
            A proposta foi publicada, mas o link ainda não foi gerado.
          </p>
          <Button
            type="button"
            className="mt-3"
            disabled={generating}
            onClick={() => void generateLink()}
          >
            <Link2 className="size-4" />{" "}
            {generating ? "Gerando…" : "Gerar link"}
          </Button>
        </div>
      )}
    </section>
  );
}

function NumberChoice({
  value,
  current,
  unit,
  presets,
  onChange,
}: {
  value: string | null;
  current: string;
  unit: string;
  presets: string[];
  onChange: (value: number | null) => void;
}) {
  const [other, setOther] = useState(value === "outro");
  useEffect(() => setOther(value === "outro"), [value]);
  return (
    <div className="flex flex-col gap-3">
      <Chips
        label={unit}
        value={other ? "outro" : (value ?? null)}
        onChange={(choice) => {
          if (choice === "outro") {
            setOther(true);
            return;
          }
          setOther(false);
          onChange(choice === TBD ? null : Number(choice));
        }}
        options={[
          ...presets.map((preset) => ({
            value: preset,
            label: preset + " " + unit,
          })),
          { value: "outro", label: "Outro" },
          { value: TBD, label: "A definir" },
        ]}
      />
      {other && (
        <label className="flex max-w-52 items-center gap-2">
          <span className="sr-only">Outro período em {unit}</span>
          <input
            key={current}
            inputMode="numeric"
            defaultValue={current}
            onBlur={(event) => {
              const parsed = Number.parseInt(event.target.value, 10);
              onChange(Number.isNaN(parsed) ? null : Math.max(0, parsed));
            }}
            className={inputClass}
            style={inputStyle}
          />
          <span className="text-sm">{unit}</span>
        </label>
      )}
    </div>
  );
}
