import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CloudOff,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  MoreHorizontal,
  NotebookPen,
  Package,
  Sofa,
  Trash2,
  Wrench,
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
import { InventoryTab } from "./InventoryTab";
import { ProposalTab } from "./ProposalTab";
import { SupplySheet } from "./SupplySheet";
import { PropertySuppliersPanel } from "../suppliers/PropertySuppliersPanel";
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
  coreApi,
} from "../../lib/api/queries";
import { commercialProposalsApi } from "../../lib/api/commercial-proposals";
import {
  presentationInvitesApi,
  presentationUrl,
} from "../../lib/api/presentation-invites";
import {
  buildGuidedDraftInput,
  guidedOptionsFromVersion,
  guidedProposalIssue,
  optionFromTemplate,
  proposalServiceSummary,
} from "../../lib/guided-proposal";
import { formatBrazilianPhone } from "../../lib/owner-form-validation";
import {
  JOURNEY_STEPS,
  PROPOSAL_BLOCKS,
  proposalNumberChoice,
  reviewPropertySummary,
  validateContact,
  type JourneyStep,
} from "../../lib/opportunity-journey";
import type { ImplementationProject } from "../../types/core";
import type { AdminCondominium } from "../../types/admin";
import { PROPOSAL_ITEM_TEMPLATES } from "../../config/proposal-item-templates";
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
        <button type="button" className="underline" onClick={() => void formQ.refetch()}>
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
    setContact((c) => ({ ...c, [k]: k === "phone" ? formatBrazilianPhone(value) : value }));
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
      return (data ?? {}) as Cond;
    },
  });
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
            { implementation_id: id, ...patch, updated_at: new Date().toISOString() } as never,
            {
              onConflict: "implementation_id",
            },
          );
        if (error) throw error;
        setCondState(Object.keys(condPending.current).length ? "saving" : "saved");
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

  const proposalsQ = useQuery({
    queryKey: ["commercial-proposals", id],
    queryFn: () => commercialProposalsApi.list(id),
  });
  const versions = proposalsQ.data ?? [];
  const draftProposal = versions.find((version) => version.status === "draft") ?? null;
  const latestPublished = versions.find((version) => version.status !== "draft") ?? null;
  const proposalSource = draftProposal ?? latestPublished;
  const [proposalOptions, setProposalOptions] = useState<ProposalItemOption[]>([]);
  const [proposalLoadedKey, setProposalLoadedKey] = useState<string | null>(null);
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
    if (!proposalDirty.current || guidedProposalIssue(currentOptions)) return true;
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
        await queryClient.invalidateQueries({ queryKey: ["commercial-proposals", id] });
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

  useEffect(() => {
    void autosaveOpportunity(id, { draft_step: step }, {}).catch(() => undefined);
    window.scrollTo({ top: 0 });
  }, [id, step]);

  const saveState: SaveState = [auto.state, contactState, condState, proposalState].includes(
    "error",
  )
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
  const go = async (next: JourneyStep, proposalSub = 0) => {
    const ok = await flushAll();
    if (ok) {
      if (next === "proposta") setSub(proposalSub);
      onStepChange(next);
    }
  };
  const exit = async () => {
    const ok = await flushAll();
    if (ok) onExit();
  };

  const [sub, setSub] = useState(0);
  const [hub, setHub] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishedResult, setPublishedResult] = useState<{
    version: CommercialProposalVersion;
    link: string | null;
  } | null>(null);
  useEffect(() => {
    if (step !== "proposta") setSub(0);
    setHub(null);
    setPublishing(false);
  }, [step]);

  const proposalBlocks = proposalBlockSummaries(cond);
  const isLast = index === JOURNEY_STEPS.length - 1;
  const next = async () => {
    if (step === "proposta" && sub < proposalBlocks.length - 1) {
      const ok = await flushAll();
      if (ok) setSub((current) => current + 1);
      return;
    }
    if (!isLast) void go(JOURNEY_STEPS[index + 1]!.id);
  };
  const back = async () => {
    if (hub) return setHub(null);
    if (publishing) return setPublishing(false);
    if (step === "proposta" && sub > 0) {
      const ok = await flushAll();
      if (ok) setSub((current) => current - 1);
      return;
    }
    if (index > 0) void go(JOURNEY_STEPS[index - 1]!.id);
    else void exit();
  };

  const proposalBlock = step === "proposta" ? PROPOSAL_BLOCKS[sub] : undefined;
  const proposalBlockLabel =
    proposalBlock === "commercial"
      ? "Condições comerciais"
      : proposalBlock === "preparation"
        ? "Preparação do imóvel"
        : proposalBlock === "contract"
          ? "Condições do contrato"
          : null;

  const complete = useMutation({
    mutationFn: async () => {
      await flushAll();
      await completeOpportunityDraft(id);
    },
    onSuccess: () => {
      toast.success("Ficha criada", { description: "Nada foi enviado ao proprietário." });
      onExit();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível concluir."),
  });

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
        <Loader2 className="size-4 animate-spin" /> Carregando condições da proposta…
      </div>
    ) : (
      <ProposalBlocks
        cond={cond}
        setC={setC}
        sub={sub}
        proposalOptions={proposalOptions}
        onProposalOptionsChange={changeProposalOptions}
        proposalsPending={proposalsQ.isPending}
      />
    );
  } else if (step === "implantacao") {
    const hubs = [
      {
        id: "enxoval",
        label: "Enxoval",
        icon: Package,
        node: <SupplySheet implementationId={id} />,
      },
      {
        id: "inventario",
        label: "Inventário",
        icon: Sofa,
        node: <InventoryTab implementationId={id} />,
      },
      {
        id: "fornecedores",
        label: "Fornecedores",
        icon: Wrench,
        node: <PropertySuppliersPanel implementationId={id} />,
      },
      {
        id: "observacoes",
        label: "Observações",
        icon: NotebookPen,
        node: (
          <div className="flex flex-col gap-4">
            <TextArea
              label="Observações internas"
              value={v.notes}
              onChange={(x) => auto.set("notes", x)}
            />
            <TextArea
              label="Informações para o proprietário"
              value={v.owner_facing_notes}
              onChange={(x) => auto.set("owner_facing_notes", x)}
            />
          </div>
        ),
      },
    ];
    const open = hubs.find((h) => h.id === hub);
    content = open ? (
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => setHub(null)}
          className="flex min-h-11 items-center gap-1 text-sm font-medium"
          style={{ color: "var(--stayo-forest)" }}
        >
          <ArrowLeft className="size-4" /> Voltar para Implantação
        </button>
        <h3 className="text-lg font-semibold">{open.label}</h3>
        {open.node}
      </div>
    ) : (
      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold">O que você quer registrar agora?</h3>
        <p className="text-sm" style={muted}>
          Preencha um, vários ou nenhum.
        </p>
        {hubs.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => setHub(h.id)}
            className="flex min-h-14 items-center gap-3 rounded-[var(--radius-card)] border px-4 text-left transition hover:border-[var(--stayo-forest)]"
            style={inputStyle}
          >
            <h.icon className="size-5 shrink-0" style={{ color: "var(--stayo-forest)" }} />
            <span className="flex-1 font-medium">{h.label}</span>
            <ChevronRight className="size-4" style={muted} />
          </button>
        ))}
      </div>
    );
  } else if (publishing) {
    content = (
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => setPublishing(false)}
          className="flex min-h-11 items-center gap-1 text-sm font-medium"
          style={{ color: "var(--stayo-forest)" }}
        >
          <ArrowLeft className="size-4" /> Voltar para a revisão
        </button>
        <div>
          <p className="text-xs font-medium" style={muted}>
            Opção para casos complexos
          </p>
          <h3 className="text-lg font-semibold">Editar proposta avançada</h3>
        </div>
        <ProposalTab implementationId={id} />
      </div>
    );
  } else {
    const serviceSummary = proposalServiceSummary(proposalOptions);
    const proposalIssue = guidedProposalIssue(proposalOptions);
    const publishGuided = async () => {
      if (proposalIssue) return;
      const ok = await flushAll();
      if (!ok) return;
      try {
        const currentVersions = await commercialProposalsApi.list(id);
        const currentDraft = currentVersions.find((version) => version.status === "draft") ?? null;
        const currentPublished =
          currentVersions.find((version) => version.status !== "draft") ?? null;
        const saved =
          currentDraft ??
          (await commercialProposalsApi.saveDraft(
            buildGuidedDraftInput({
              implementationId: id,
              version: currentPublished,
              options: proposalOptionsRef.current,
              commandId: crypto.randomUUID(),
            }),
          ));
        const published = await commercialProposalsApi.publish({
          proposalId: saved.id,
          expectedRevision: saved.draftRevision,
          commandId: crypto.randomUUID(),
        });
        let link: string | null = null;
        try {
          const issued = await presentationInvitesApi.issue({
            implementationId: id,
            proposalId: published.id,
            validDays: 15,
          });
          link = presentationUrl(issued.token);
        } catch {
          // A versão permanece publicada; o link pode ser gerado novamente na tela de sucesso.
        }
        setPublishedResult({ version: published, link });
        await queryClient.invalidateQueries({ queryKey: ["commercial-proposals", id] });
        toast.success("Proposta publicada", {
          description: link
            ? "O link está pronto para copiar."
            : "A versão foi publicada; gere o link novamente.",
        });
      } catch (error) {
        toast.error("Não foi possível publicar a proposta", {
          description:
            error instanceof Error ? error.message : "Revise os dados e tente novamente.",
        });
      }
    };
    const propertySummary = reviewPropertySummary(v);
    const conditionCount = proposalBlocks.filter((block) => block.value).length;
    content = (
      <div className="flex flex-col gap-3">
        <ReviewCard title="Contato" onEdit={() => void go("contato")}>
          <p className="text-sm">{contact.name || "Nome a completar"}</p>
          <p className="mt-1 text-sm" style={muted}>
            {contact.phone || "Telefone a completar"}
          </p>
        </ReviewCard>
        <ReviewCard title="Imóvel" onEdit={() => void go("imovel")}>
          <p className="text-sm">{propertySummary.identification}</p>
          {propertySummary.missing > 0 && (
            <p className="mt-1 text-xs" style={muted}>
              {propertySummary.missing}{" "}
              {propertySummary.missing === 1
                ? "dado pode ser completado depois"
                : "dados podem ser completados depois"}
            </p>
          )}
        </ReviewCard>
        <ReviewCard title="Proposta" onEdit={() => void go("proposta")}>
          <p className="text-sm" style={muted}>
            {cond.administration_fee == null
              ? "Administração a definir"
              : `${cond.administration_fee}% administração`}
            {cond.turnover_cleaning_fee == null
              ? " · Limpeza a definir"
              : ` · R$ ${Number(cond.turnover_cleaning_fee).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} limpeza`}
          </p>
          <p className="mt-1 text-sm" style={muted}>
            {cond.duration_months == null ? "Vigência a definir" : `${cond.duration_months} meses`}
            {cond.notice_period_days == null
              ? " · Aviso a definir"
              : ` · ${cond.notice_period_days} dias de aviso`}
          </p>
          <p className="mt-1 text-xs" style={muted}>
            {conditionCount} de 3 grupos de condições · {serviceSummary.count}{" "}
            {serviceSummary.count === 1 ? "serviço" : "serviços"}
          </p>
        </ReviewCard>
        <ReviewCard title="Implantação" onEdit={() => void go("implantacao")}>
          <p className="text-sm" style={muted}>
            Enxoval, inventário, fornecedores e observações.
          </p>
        </ReviewCard>
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
              onClick={() => void go("proposta", 1)}
            >
              Resolver
            </Button>
          </div>
        )}
        {publishedResult ? (
          <PublishedProposalSuccess
            result={publishedResult}
            implementationId={id}
            onBack={onExit}
            onLinkGenerated={(link) =>
              setPublishedResult((current) => (current ? { ...current, link } : current))
            }
          />
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            <Button
              type="button"
              disabled={Boolean(proposalIssue)}
              onClick={() => void publishGuided()}
              className="min-h-12 bg-[var(--stayo-forest)] text-[var(--primary-foreground)] hover:bg-[var(--stayo-forest)]/90"
            >
              Publicar proposta e gerar link
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-12"
              onClick={() => setPublishing(true)}
            >
              Editar proposta avançada
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-12"
              disabled={complete.isPending}
              onClick={() => complete.mutate()}
            >
              {complete.isPending && <Loader2 className="size-4 animate-spin" />} Criar ficha sem
              enviar
            </Button>
          </div>
        )}
      </div>
    );
  }

  const propertyStep = step === "imovel";

  return (
    <div
      ref={topRef}
      className={`mx-auto flex w-full flex-col pb-28 sm:pb-6 ${
        propertyStep ? "max-w-5xl gap-6" : "max-w-2xl gap-5"
      }`}
    >
      {propertyStep ? (
        <PropertyJourneyHeader
          implementation={implementation}
          saveState={saveState}
          onRetry={retry}
          onExit={exit}
        />
      ) : (
        <header className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              aria-label="Voltar para implantações"
              onClick={() => void exit()}
              className="flex min-h-11 items-center gap-1.5 text-sm font-medium"
              style={{ color: "var(--stayo-forest)" }}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Implantação
            </button>
            <JourneyActions implementation={implementation} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-semibold">
              {implementation.code}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <SaveStatus state={saveState} onRetry={retry} compact />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-11 px-2 sm:px-3"
                onClick={() => void exit()}
              >
                Salvar e sair
              </Button>
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold">
              {JOURNEY_STEPS[index]!.label} · Etapa {index + 1} de{" "}
              {JOURNEY_STEPS.length}
            </h2>
            {proposalBlockLabel && (
              <p className="mt-0.5 text-xs" style={muted}>
                {proposalBlockLabel} · {sub + 1} de {PROPOSAL_BLOCKS.length}
              </p>
            )}
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

      {!(step === "revisao") && !hub && (
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
            {step === "proposta" && sub > 0
              ? "Voltar ao bloco anterior"
              : "Voltar etapa"}
          </Button>
          <Button
            type="button"
            onClick={() => void next()}
            className="min-h-12 flex-1 bg-[var(--stayo-forest)] text-[var(--primary-foreground)] hover:bg-[var(--stayo-forest)]/90 sm:ml-auto sm:flex-none sm:px-8"
          >
            Continuar
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
          {saveState === "idle" ? (
            <p className="flex items-center gap-1 text-xs whitespace-nowrap" style={muted}>
              <Check className="size-3.5" /> Salvo agora
            </p>
          ) : (
            <SaveStatus
              state={saveState}
              onRetry={onRetry}
              compact
              savedLabel="Salvo agora"
            />
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-10 px-3"
            onClick={() => void onExit()}
          >
            Salvar e sair
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

function JourneyActions({ implementation }: { implementation: ImplementationProject }) {
  const locked =
    implementation.status === "ativo" ||
    Boolean((implementation as { corePropertyId?: string | null }).corePropertyId);
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
  savedLabel = "Salvo",
}: {
  state: SaveState;
  onRetry: () => void;
  compact?: boolean;
  savedLabel?: string;
}) {
  if (state === "idle") return null;
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
      {state === "saving" ? "Salvando…" : savedLabel}
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
        <span className="mt-1 block text-xs" style={{ color: "var(--stayo-danger)" }}>
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
              borderColor: active ? "var(--stayo-forest)" : "var(--stayo-border)",
              backgroundColor: active ? "var(--stayo-forest)" : "var(--stayo-surface)",
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

function ReviewCard({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-card)] border p-4" style={inputStyle}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">{title}</h3>
          <div className="mt-1">{children}</div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          Editar
        </Button>
      </div>
    </section>
  );
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
        toast.error("Condomínio vinculado, mas o endereço ainda não sincronizou.");
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

function proposalBlockSummaries(c: Cond) {
  return [
    {
      label: "Condições comerciais",
      value: c.administration_fee != null || c.turnover_cleaning_fee != null ? "ok" : "",
    },
    {
      label: "Preparação do imóvel",
      value: c.initial_cleaning_option || c.linen_mode || c.advisory_mode ? "ok" : "",
    },
    {
      label: "Condições do contrato",
      value:
        c.exclusivity != null ||
        c.duration_months != null ||
        c.notice_period_days != null ||
        c.owner_use_limit_mode ||
        c.assignment_mode
          ? "ok"
          : "",
    },
  ];
}

function ProposalBlocks({
  cond,
  setC,
  sub,
  proposalOptions,
  onProposalOptionsChange,
  proposalsPending,
}: {
  cond: Cond;
  setC: (patch: Cond) => void;
  sub: number;
  proposalOptions: ProposalItemOption[];
  onProposalOptionsChange: (options: ProposalItemOption[]) => void;
  proposalsPending: boolean;
}) {
  const num = (value: unknown) =>
    value === null || value === undefined || value === "" ? "" : String(value);
  const boolChoice = cond.exclusivity === true ? "sim" : cond.exclusivity === false ? "nao" : null;
  const duration = proposalNumberChoice(cond.duration_months, [12, 24]);
  const notice = proposalNumberChoice(cond.notice_period_days, [30, 60]);

  const blocks: Record<(typeof PROPOSAL_BLOCKS)[number], ReactNode> = {
    commercial: (
      <section
        key="commercial"
        className="rounded-[var(--radius-card)] border p-4 sm:p-5"
        style={inputStyle}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Taxa de administração</span>
            <div className="flex items-center gap-2">
              <input
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
                className={inputClass}
                style={inputStyle}
              />
              <span className="text-base">%</span>
            </div>
          </label>
          <div>
            <span className="mb-1.5 block text-sm font-medium">Limpeza comercial</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">R$</span>
              <input
                key={num(cond.turnover_cleaning_fee)}
                inputMode="decimal"
                defaultValue={num(cond.turnover_cleaning_fee)}
                onBlur={(event) => {
                  const value = Number(event.target.value.replace(/\./g, "").replace(",", "."));
                  setC({
                    turnover_cleaning_fee:
                      event.target.value.trim() === "" || Number.isNaN(value)
                        ? null
                        : Math.max(0, value),
                  });
                }}
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div className="mt-2">
              <Chips
                label="Definição da limpeza comercial"
                value={cond.turnover_cleaning_fee == null ? TBD : null}
                onChange={() => setC({ turnover_cleaning_fee: null })}
                options={[{ value: TBD, label: "A definir" }]}
              />
            </div>
          </div>
        </div>
      </section>
    ),
    preparation: (
      <section
        key="preparation"
        className="rounded-[var(--radius-card)] border p-4 sm:p-5"
        style={inputStyle}
      >
        <div className="flex flex-col gap-5">
          <Question title="Limpeza antes da operação">
            <Chips
              label="Limpeza antes da operação"
              value={cond.initial_cleaning_option as string}
              onChange={(value) => setC({ initial_cleaning_option: value })}
              options={[
                { value: "owner_delivers", label: "Proprietário entrega limpo" },
                { value: "stayo_initial", label: "Limpeza de implantação STAYO" },
                { value: "stayo_post_construction", label: "Pós-obra" },
                { value: TBD, label: "A decidir" },
              ]}
            />
          </Question>
          <Question title="Enxoval">
            <Chips
              label="Enxoval"
              value={cond.linen_mode as string}
              onChange={(value) => setC({ linen_mode: value })}
              options={[
                { value: "complete", label: "Já possui completo" },
                { value: "partial", label: "Possui parcialmente" },
                { value: "stayo_supplier", label: "Fornecedor indicado pela STAYO" },
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
                { value: "implementation_only", label: "Somente implantação" },
                { value: "full", label: "Completa" },
                { value: TBD, label: "A decidir" },
              ]}
            />
          </Question>
          <GuidedServices
            options={proposalOptions}
            onChange={onProposalOptionsChange}
            pending={proposalsPending}
          />
        </div>
      </section>
    ),
    contract: (
      <section
        key="contract"
        className="rounded-[var(--radius-card)] border p-4 sm:p-5"
        style={inputStyle}
      >
        <div className="flex flex-col gap-5">
          <Question title="Exclusividade">
            <Chips
              label="Exclusividade"
              value={
                boolChoice ?? (cond.exclusivity === null && "exclusivity" in cond ? TBD : null)
              }
              onChange={(value) =>
                setC({ exclusivity: value === "sim" ? true : value === "nao" ? false : null })
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
              presets={["12", "24"]}
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
                  <span className="mb-1.5 block text-sm font-medium">Quantidade de dias</span>
                  <div className="flex items-center gap-2">
                    <input
                      key={num(cond.owner_use_limit_days)}
                      inputMode="numeric"
                      defaultValue={num(cond.owner_use_limit_days)}
                      onBlur={(event) => {
                        const value = Number.parseInt(event.target.value, 10);
                        setC({
                          owner_use_limit_days: Number.isNaN(value) ? null : Math.max(0, value),
                        });
                      }}
                      className={inputClass}
                      style={inputStyle}
                    />
                    <span className="text-sm">dias</span>
                  </div>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Período</span>
                  <input
                    key={num(cond.owner_use_limit_period)}
                    defaultValue={num(cond.owner_use_limit_period)}
                    onBlur={(event) =>
                      setC({ owner_use_limit_period: event.target.value.trim() || null })
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
        </div>
      </section>
    ),
  };

  const block = PROPOSAL_BLOCKS[sub];
  return block ? blocks[block] : null;
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
  const byTemplate = new Map(options.map((option) => [option.templateKey, option]));
  const custom = options.filter((option) => !option.templateKey);
  const toggleTemplate = (key: string, checked: boolean) => {
    const existing = byTemplate.get(key);
    if (existing) {
      onChange(
        options.map((option) => (option === existing ? { ...option, included: checked } : option)),
      );
      return;
    }
    const template = PROPOSAL_ITEM_TEMPLATES.find((item) => item.key === key);
    if (template && checked) onChange([...options, optionFromTemplate(template)]);
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
                  onCheckedChange={(checked) => toggleTemplate(template.key, checked === true)}
                />
                <span className="min-w-0 flex-1 text-sm font-medium">{template.description}</span>
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
                      item === option ? { ...item, included: checked === true } : item,
                    ),
                  )
                }
              />
              <span className="min-w-0 flex-1 text-sm font-medium">{option.description}</span>
              <span className="shrink-0 text-sm tabular-nums">
                {option.unitValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
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
          <TextField label="Nome do serviço" value={otherName} onChange={setOtherName} />
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
          <p className="text-sm">A proposta foi publicada, mas o link ainda não foi gerado.</p>
          <Button
            type="button"
            className="mt-3"
            disabled={generating}
            onClick={() => void generateLink()}
          >
            <Link2 className="size-4" /> {generating ? "Gerando…" : "Gerar link"}
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
          ...presets.map((preset) => ({ value: preset, label: preset + " " + unit })),
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
