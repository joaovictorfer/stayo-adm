import { journeyLabel, proposalStage, contractStageLabel, currentContractStage } from "../lib/journey-states";
import { FichaProprietario } from "../components/implantacao/ficha/FichaProprietario";
import { FichaImovel } from "@/components/implantacao/ficha/FichaImovel";
import { FichaImplantacao } from "../components/implantacao/ficha/FichaImplantacao";
import { FichaCommercial } from "@/components/implantacao/ficha/FichaCommercial";
import { FichaContrato } from "@/components/implantacao/ficha/FichaContrato";
import { DeleteImplementationButton } from "@/components/implantacao/DeleteImplementationButton";
import { PropertySuppliersPanel } from "@/components/suppliers/PropertySuppliersPanel";
import { countsInDefinedTotal } from "../lib/proposal-pricing";
import { commercialProposalsApi } from "../lib/api/commercial-proposals";
import type { CommercialProposalVersion } from "../types/commercial-proposal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  ListChecks,
  LockKeyhole,
  Pencil,
  Send,
  Share2,
  CalendarPlus,
  Megaphone,
} from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/ui/accordion";
import { Progress } from "../components/ui/progress";
import { Button } from "../components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { toast } from "sonner";

import {
  DetailSkeleton,
  ErrorRows,
  Field,
  NotFoundPanel,
  Panel,
} from "../components/data/ListStates";
import { ProposalTab } from "../components/implantacao/ProposalTab";
import { ContractConditionsPanel } from "../components/implantacao/ContractConditionsPanel";
import { MeetingSummary } from "../components/implantacao/MeetingSummary";
import { commercialMeetingsApi } from "../lib/api/commercial-meetings";
import { formatCommercialDateTime } from "../lib/commercial-meeting-state";
import { InventoryTab } from "../components/implantacao/InventoryTab";
import { OwnerInviteSection } from "../components/implantacao/OwnerInviteSection";
import { CoverPicker, useAdminCoverUrl } from "../components/implantacao/CoverPicker";
import { OwnerIntakeReview } from "../components/implantacao/OwnerIntakeReview";
import { OwnerVisibilityPanel } from "../components/implantacao/OwnerVisibilityPanel";
import { SupplySheet } from "../components/implantacao/SupplySheet";
import {
  Collapsible,
  DomainHub,
  FichaNav,
  OverviewCard,
} from "../components/implantacao/ficha/FichaParts";
import {
  FICHA_SECTIONS,
  nextAction,
  proposalStatusLabel,
  toFichaSection,
  type FichaSection,
} from "../lib/ficha-next-action";
import {
  JourneyCard,
  NextStepCard,
  LastActivityCard,
  ResponsibleCard,
  SheetOverviewCard,
  type PendingEntry,
  type SheetRow,
} from "../components/implantacao/ficha/FichaSummary";
import { GuidePanel, GuideSummary } from "../components/implantacao/guide/GuidePanel";
import { GuidedInventoryPanel, GuidedInventorySummary } from "../components/implantacao/guide/GuidedInventoryPanel";
import { AmenitiesPanel, AmenitiesSummary } from "../components/implantacao/AmenitiesPanel";
import { getOpportunityDraftState } from "../lib/api/opportunities";
import { loadOpportunityForm } from "../lib/api/opportunity-form";
import { listActiveReleases } from "../lib/api/portal-visibility";
import { OpportunityJourney } from "../components/implantacao/OpportunityJourney";
import { toJourneyStep, type JourneyStep } from "../lib/opportunity-journey";
import { LinkedField } from "../components/patterns/LinkedField";
import { Timeline, type TimelineEntry } from "../components/patterns/Timeline";
import {
  adminApi,
  commercialTermsQuery,
  coreApi,
  implementationItemsQuery,
  implementationQuery,
  initialChargesQuery,
  ownerOnboardingLinkQuery,
  ownerOnboardingSubmissionQuery,
  ownerQuery,
} from "../lib/api/queries";
import { coreConversionService, isCoreConversionEnabled } from "../lib/core-conversion";
import { formatMoney } from "../lib/format";
import {
  alternateStatuses,
  computeProgress,
  computeReadiness,
  itemStatusColor,
  itemStatusLabels,
  mainStatusFlow,
  readinessColors,
  readinessLabels,
  statusLabels,
} from "../lib/implementation-status";
import { initialChargeStatusLabels } from "../lib/initial-charge-status";
import {
  createInspection,
  createTimelineUpdate,
  getPropertyDetails,
  listPortalInspections,
  listPortalTimeline,
  savePropertyDetails,
  type PropertyDetailsInput,
} from "../lib/api/owner-portal-data";
import {
  formatBrazilianPhone,
  maskDocument,
  maskPixKey,
  normalizeDocument,
  normalizeEmail,
  normalizeName,
  normalizePhone,
} from "../lib/owner-form-validation";
import type { ChargeType, InitialChargeStatus } from "../types/admin";
import type {
  EntityId,
  ImplementationItem,
  ImplementationProject,
  ImplementationStatus,
} from "../types/core";
import {
  type OwnerOnboardingLinkStatus,
  computeOwnerRegistration,
  ownerOnboardingLinkStatus,
} from "../types/owner-onboarding";

export const Route = createFileRoute("/implantacao/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe da implantação — Stayo Admin" },
      { name: "description", content: "Etapas e checklist de uma implantação Stayo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Detalhe da implantação — Stayo Admin" },
      {
        property: "og:description",
        content: "Etapas e checklist de uma implantação Stayo.",
      },
    ],
  }),
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    etapa?: JourneyStep | undefined;
    acao?: string | undefined;
    secao?: FichaSection | undefined;
  } => ({
    etapa: toJourneyStep(search["etapa"]),
    secao: toFichaSection(search["secao"]),
    acao: typeof search["acao"] === "string" ? search["acao"] : undefined,
  }),
  component: ImplementationDetailPage,
});

const surface = {
  backgroundColor: "var(--stayo-surface)",
  borderColor: "var(--stayo-border)",
};

function ImplementationDetailPage() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const wizardStep = search.etapa;
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<
    "resumo" | "proprietario" | "imovel" | "enxoval" | "itens_faltantes" | "checklist" | "proposta"
  >("resumo");
  const query = useQuery(implementationQuery(id));
  const itemsQuery = useQuery(implementationItemsQuery(id));
  const implementation = query.data;
  const draftQuery = useQuery({
    queryKey: ["opportunity-draft-state", id],
    queryFn: () => getOpportunityDraftState(id),
  });
  const releasesQuery = useQuery({
    queryKey: ["portal-visibility", id],
    queryFn: () => listActiveReleases(id),
  });
  const [resuming, setResuming] = useState(false);
  const resumeRegistration = async () => {
    if (resuming) return;
    setResuming(true);
    try {
      const form = await loadOpportunityForm(id);
      await navigate({ search: { etapa: toJourneyStep(form.draftStep) ?? "contato" } });
    } catch {
      toast.error("Não foi possível retomar o cadastro. Tente novamente.");
    } finally {
      setResuming(false);
    }
  };
  const adminCover = useAdminCoverUrl(implementation?.id);
  const nextItem = (itemsQuery.data ?? []).find((item) => item.status !== "concluido");
  const items = itemsQuery.data ?? [];
  const progress = computeProgress(items);
  const readiness = computeReadiness(items);
  const pendingItems = items.filter((item) => item.status !== "concluido");
  const propertyName = implementation?.nickname || implementation?.condominiumName || "Novo imóvel";
  const missingPropertyFields = implementation
    ? [
        implementation.nickname,
        implementation.condominiumName,
        implementation.unit,
        implementation.address,
        implementation.city,
        implementation.propertyType,
        implementation.bedrooms,
        implementation.capacity,
      ].filter((value) => value === null || value === undefined || value === "").length
    : 0;

  const commercialQuery = useQuery({
    queryKey: ["commercial", "overview"],
    queryFn: () => commercialMeetingsApi.listOverview(),
    retry: 1,
  });
  const assigneesQuery = useQuery({
    queryKey: ["commercial", "assignees"],
    queryFn: () => commercialMeetingsApi.listAssignees(),
    retry: 1,
  });
  const commercial = (commercialQuery.data ?? []).find((row) => row.implementationId === id);
  const responsibleName = !implementation?.responsibleUserId
    ? "a definir"
    : ((assigneesQuery.data ?? []).find((a) => a.id === implementation.responsibleUserId)
        ?.fullName ?? (assigneesQuery.isPending ? "…" : "definido"));
  const nextActionLabel = commercial?.nextActionTitle
    ? commercial.nextActionTitle
    : nextItem
      ? nextItem.title
      : itemsQuery.isPending || commercialQuery.isPending
        ? "—"
        : "Nenhuma definida";
  const nextActionDetail =
    commercial?.nextActionTitle && commercial.nextActionDueAt && commercial.nextActionTimeZone
      ? formatCommercialDateTime(commercial.nextActionDueAt, commercial.nextActionTimeZone)
      : !commercial?.nextActionTitle && nextItem
        ? "Item do checklist"
        : null;

  const section: FichaSection = search.secao ?? "visao";
  const goSection = (secao: FichaSection) => {
    setProposalEditing(false);
    void navigate({ search: { secao: secao === "visao" ? undefined : secao }, resetScroll: false });
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };
  const [proposalEditing, setProposalEditing] = useState(false);
  const proposalsQuery = useQuery({
    queryKey: ["commercial-proposals", id],
    queryFn: () => commercialProposalsApi.list(id),
    retry: 1,
  });
  const latestProposal = [...(proposalsQuery.data ?? [])]
    .filter((p) => p.status !== "superseded")
    .sort((a, b) => b.version - a.version)[0];
  const submissionQuery = useQuery(ownerOnboardingSubmissionQuery(id));
  const intakeSubmitted = Boolean(submissionQuery.data?.submittedAt);
  const conditionsQuery = useQuery({
    queryKey: ["implementation-contract-conditions", id, "summary"],
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase
        .from("implementation_contract_conditions")
        .select("administration_fee, turnover_cleaning_fee")
        .eq("implementation_id", id)
        .maybeSingle();
      return data;
    },
  });
  const conditions = conditionsQuery.data;
  const action = nextAction({
    hasOwnerName: Boolean(implementation?.ownerName),
    hasOwnerPhone: Boolean(implementation?.ownerPhone),
    missingPropertyFields,
    proposalStatus: latestProposal?.status ?? null,
    intakeSubmitted,
    pendingItems: pendingItems.length,
    pendingBlockers: readiness.pendingBlockers,
    commercialAction: commercial?.nextActionTitle ?? null,
  });
  const history: TimelineEntry[] = [
    ...(implementation
      ? [
          {
            id: "created",
            label: "Oportunidade criada",
            timestamp: implementation.createdAt,
            actor: null,
          },
          ...(implementation.updatedAt !== implementation.createdAt ? [{
            id: "updated",
            label: "Ficha atualizada",
            timestamp: implementation.updatedAt,
            actor: null,
          }] : []),
        ]
      : []),
    ...(proposalsQuery.data ?? []).flatMap((p) => [
      {
        id: `p-${p.id}`,
        label: `Proposta v${p.version} criada`,
        timestamp: p.createdAt,
        actor: null,
      },
      ...(p.publishedAt
        ? [
            {
              id: `pp-${p.id}`,
              label: `Proposta v${p.version} publicada`,
              timestamp: p.publishedAt,
              actor: null,
            },
          ]
        : []),
      ...(p.acceptedAt
        ? [
            {
              id: `pa-${p.id}`,
              label: `Proposta v${p.version} aceita por ${p.acceptedName ?? "proprietário"}`,
              timestamp: p.acceptedAt,
              actor: null,
            },
          ]
        : []),
    ]),
    ...(submissionQuery.data?.submittedAt
      ? [
          {
            id: "intake",
            label: "Cadastro do proprietário enviado",
            timestamp: submissionQuery.data.submittedAt,
            actor: null,
          },
        ]
      : []),
    ...recentActivity(items),
  ].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

  const shareWorkspace = async () => {
    if (typeof window === "undefined") return;
    if (navigator.share) {
      await navigator.share({ title: propertyName, url: window.location.href });
      return;
    }
    await navigator.clipboard.writeText(window.location.href);
  };

  const changeStatus = useMutation({
    mutationFn: async (status: ImplementationStatus) => {
      const from = implementation?.status ?? null;
      const updated = await coreApi.implementations.update(id, { status });
      await adminApi.audit.log({
        actorId: null,
        event: "implementation.status_changed",
        entityType: "implementation",
        entityId: id,
        metadata: { from, to: status },
      });
      return updated;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["implementations"] });
    },
  });

  const buildPending = (): PendingEntry[] => {
    if (!implementation) return [];
                  const pend: PendingEntry[] = [];
                  if (!implementation.ownerName || !implementation.ownerPhone)
                    pend.push({ id: "owner", section: "proprietario", icon: "owner", title: "Proprietário", detail: "Completar dados de contato", chip: "Pendente" });
                  else if (latestProposal?.status === "accepted" && !intakeSubmitted)
                    pend.push({ id: "owner", section: "portal", icon: "owner", title: "Proprietário", detail: "Cadastro ainda não enviado", chip: "Aguardando" });
                  if (!latestProposal || latestProposal.status === "draft")
                    pend.push({ id: "prop", section: "proposta", icon: "doc", title: "Comercial", detail: latestProposal ? "Publicar proposta" : "Montar a proposta", chip: "Pendente" });
                  else if (latestProposal.status === "published")
                    pend.push({ id: "prop", section: "portal", icon: "doc", title: "Comercial", detail: "Aguardando aceite da proposta", chip: "Aguardando" });
                  if (missingPropertyFields)
                    pend.push({ id: "imovel", section: "imovel", icon: "home", title: "Imóvel", detail: `${missingPropertyFields} informação(ões) em aberto`, chip: "Pendente" });
                  if (pendingItems.length)
                    pend.push({ id: "impl", section: "implantacao", icon: "list", title: "Implantação", detail: `${pendingItems.length} item(ns) em aberto${readiness.pendingBlockers ? ` · ${readiness.pendingBlockers} bloqueador(es)` : ""}`, chip: "Pendente" });
    return pend;
  };

  return (
    <div className="implementation-workspace">
      {!wizardStep && (
        <header className="implementation-mobile-heading">
          <Link
            to="/implantacao"
            className="implementation-back-button"
            aria-label="Voltar para implantações"
          >
            <ArrowLeft aria-hidden="true" />
          </Link>
          <div>
            <span>Implantação</span>
            <strong>{implementation?.code ?? "Carregando"}</strong>
          </div>
          <div className="flex items-center gap-1">
            {implementation && (
              <DeleteImplementationButton
                id={implementation.id}
                code={implementation.code}
                locked={
                  implementation.status === "ativo" ||
                  Boolean((implementation as { corePropertyId?: string | null }).corePropertyId)
                }
              />
            )}
            <Link to="/implantacao" className="implementation-back-link">
              Ver todas
            </Link>
          </div>
        </header>
      )}

      {query.isPending ? (
        <DetailSkeleton />
      ) : query.isError ? (
        <ErrorRows onRetry={() => void query.refetch()} />
      ) : !implementation ? (
        <NotFoundPanel message="Implantação não encontrada" />
      ) : wizardStep ? (
        <OpportunityJourney
          implementation={implementation}
          step={wizardStep}
          onStepChange={(etapa) =>
            void navigate({ search: { etapa, acao: undefined }, replace: true, resetScroll: false })
          }
          onExit={() => {
            void queryClient.invalidateQueries({ queryKey: ["implementations"] });
            void queryClient.invalidateQueries({ queryKey: ["opportunity-draft-state", id] });
            void queryClient.invalidateQueries({ queryKey: ["commercial-proposals", id] });
            void navigate({ search: { secao: "visao" }, replace: true });
          }}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <header className="flex flex-wrap items-start justify-between gap-3" aria-label="Resumo da implantação">
            <div className="min-w-0">

              <h1
                className="truncate text-2xl font-semibold sm:text-3xl"
                style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
              >
                {propertyName}
              </h1>
              <p className="truncate text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                {implementation.ownerName || "Proprietário não informado"} · {journeyLabel({ status: implementation.status, isDraft: Boolean(draftQuery.data?.isDraft), proposal: proposalStage(proposalsQuery.data ?? []) })}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="min-h-10"
                disabled={resuming}
                onClick={() => void resumeRegistration()}
              >
                <Pencil /> {resuming ? "Abrindo…" : draftQuery.data?.isDraft ? "Continuar cadastro" : "Editar cadastro"}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-9"
                onClick={() => void shareWorkspace()}
                aria-label="Compartilhar ficha com a equipe"
              >
                <Share2 />
              </Button>
            </div>
          </header>

          <FichaNav
            current={section}
            onChange={goSection}
            badges={{ implantacao: pendingItems.length ? String(pendingItems.length) : "" }}
          />
          <div>
            <main
              className="min-w-0"
              aria-label={FICHA_SECTIONS.find((s) => s.id === section)?.label}
            >
              {section === "visao" ? (
                (() => {
                  const done = items.length - pendingItems.length;
                  const rows: SheetRow[] = [
                    { section: "proposta", label: "Comercial", status: latestProposal ? `Proposta v${latestProposal.version} ${proposalStatusLabel[latestProposal.status].toLowerCase()}` : "Proposta não criada", tone: !latestProposal ? "muted" : latestProposal.status === "draft" ? "warn" : "ok" },
                    { section: "contrato", label: "Contrato", status: contractStageLabel[currentContractStage()], tone: "muted" },
                    { section: "imovel", label: "Imóvel", status: missingPropertyFields ? `${missingPropertyFields} informação(ões) em aberto` : "Dados principais completos", tone: missingPropertyFields ? "warn" : "ok" },
                    { section: "implantacao", label: "Implantação", status: itemsQuery.isPending ? "—" : items.length ? `${done} de ${items.length} itens concluídos` : "Sem itens", tone: !items.length ? "muted" : readiness.pendingBlockers ? "danger" : done === items.length ? "ok" : "progress" },
                    { section: "proprietario", label: "Proprietário", status: !implementation.ownerName ? "Não informado" : intakeSubmitted ? "Cadastro recebido" : "Cadastro aguardando", tone: !implementation.ownerName ? "warn" : intakeSubmitted ? "ok" : "warn" },
                    { section: "portal", label: "Portal", status: releasesQuery.isPending ? "Verificando liberação…" : releasesQuery.isError ? "Liberação não verificada" : releasesQuery.data?.length ? "Conteúdo liberado" : "Não liberado", tone: releasesQuery.data?.length ? "ok" : "muted" },
                  ];
                  return (
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
                      <div className="flex flex-col gap-4">
                        <div className="hidden lg:block">
                          <h2 className="text-3xl font-semibold" style={{ fontFamily: "Outfit, var(--stayo-font-ui), sans-serif", letterSpacing: "0", color: "var(--stayo-navy)" }}>Resumo</h2>
                          <p className="text-base" style={{ color: "var(--stayo-ink-muted)" }}>Acompanhe o que está pronto e o que precisa de atenção.</p>
                        </div>
                        <NextStepCard action={action} onGo={goSection} />
                        <JourneyCard status={implementation.status} />
                        <SheetOverviewCard rows={rows} onGo={goSection} />
                        <Collapsible title="Reuniões" summary="Agenda comercial desta oportunidade">
                          <MeetingSummary implementationId={implementation.id} />
                        </Collapsible>
                        <Collapsible title="Alterar etapa da implantação" summary="Etapas administrativas">
                          <StatusStepper
                            status={implementation.status}
                            onChange={(status) => changeStatus.mutate(status)}
                            pending={changeStatus.isPending}
                          />
                        </Collapsible>

                      </div>
                      <aside className="flex flex-col gap-4">
                        <ResponsibleCard name={responsibleName} />
                        <LastActivityCard entry={history[0]} onHistory={() => goSection("historico")} />
                      </aside>
                    </div>
                  );
                })()
              ) : section === "contrato" ? (
                <FichaContrato
                  implementationId={implementation.id}
                  implementationCode={implementation.code}
                  ownerName={implementation.ownerName}
                  proposal={latestProposal ?? null}
                  onGoOwner={() => goSection("proprietario")}
                  onEditProposal={() => { goSection("proposta"); setProposalEditing(true); }}
                  onHistory={() => goSection("historico")}
                />
              ) : section === "proposta" ? (
                proposalEditing ? (
                  <div className="flex flex-col gap-4">
                    <button
                      type="button"
                      onClick={() => setProposalEditing(false)}
                      className="flex min-h-11 items-center gap-1 self-start text-sm font-medium"
                      style={{ color: "var(--stayo-forest)" }}
                    >
                      <ArrowLeft className="size-4" /> Voltar ao resumo
                    </button>
                    <ProposalTab implementationId={implementation.id} />
                  </div>
                ) : (
                  <FichaCommercial
                    nextSteps={buildPending()}
                    onGoSection={goSection}
                    implementationId={implementation.id}
                    proposal={latestProposal ? { version: latestProposal.version, statusLabel: proposalStatusLabel[latestProposal.status], snapshot: latestProposal.status === "draft" ? null : latestProposal.snapshot ?? null, total: latestProposal.total ?? null } : null}
                    onNewVersion={() => setProposalEditing(true)}
                    onHistory={() => setProposalEditing(true)}
                    extras={
                      <>
                        <Collapsible title="Termos comerciais" summary="Cobranças e percentuais">
                          <CommercialTermsPanel implementationId={implementation.id} />
                        </Collapsible>
                        <Collapsible title="Cobranças iniciais" summary="Geradas após o aceite">
                          <InitialChargesPanel implementationId={implementation.id} />
                        </Collapsible>
                      </>
                    }
                  />
                )
              ) : section === "imovel" ? (
                <FichaImovel implementation={implementation} onGoOwner={() => goSection("proprietario")} onGoPortal={() => goSection("portal")} />
              ) : section === "implantacao" ? (
                <FichaImplantacao
                  implementationId={implementation.id}
                  checklistPending={pendingItems.length}
                  onOpenPortal={() => goSection("portal")}
                  checklist={
                    <Checklist
                      implementationId={implementation.id}
                      items={itemsQuery.data ?? []}
                      loading={itemsQuery.isPending}
                      error={itemsQuery.isError}
                      onRetry={() => void itemsQuery.refetch()}
                    />
                  }
                  more={
                    <DomainHub
                      rows={[
                    {
                      id: "comodidades",
                      label: "Comodidades e itens do imóvel",
                      summary: <AmenitiesSummary implementationId={implementation.id} />,
                      content: (
                        <AmenitiesPanel implementationId={implementation.id} bedrooms={implementation.bedrooms} />
                      ),
                    },
                    {
                      id: "inventario-guiado",
                      label: "Inventário guiado",
                      summary: <GuidedInventorySummary implementationId={implementation.id} />,
                      content: (
                        <GuidedInventoryPanel implementationId={implementation.id} title={`${implementation.code}${implementation.nickname ? ` · ${implementation.nickname}` : ""}`} />
                      ),
                    },
                    {
                      id: "guia",
                      label: "Guia de utensílios",
                      summary: (
                        <GuideSummary implementationId={implementation.id} guideType="utensilios" />
                      ),
                      content: (
                        <GuidePanel implementationId={implementation.id} guideType="utensilios" />
                      ),
                    },
                    {
                      id: "enxoval",
                      label: "Enxoval (compras)",
                      summary: "Peças por ambiente, compra e entrega",
                      content: <SupplySheet implementationId={implementation.id} />,
                    },
                    {
                      id: "inventario",
                      label: "Inventário",
                      summary: "Necessário, existente, faltas e bloqueadores",
                      content: <InventoryTab implementationId={implementation.id} />,
                    },
                    {
                      id: "fornecedores",
                      label: "Fornecedores e instalações",
                      summary: "Quem forneceu, instalou ou atende o imóvel",
                      content: <PropertySuppliersPanel implementationId={implementation.id} />,
                    },
                      ]}
                    />
                  }
                />
              ) : section === "proprietario" ? (
                <FichaProprietario
                  implementation={implementation}
                  portal={<OwnerPortalPanel implementationId={implementation.id} ownerId={implementation.ownerId} ownerName={implementation.ownerName} compact />}
                  review={<OwnerIntakeReview implementationId={implementation.id} ownerName={implementation.ownerName} />}
                  pending={buildPending()}
                  proposal={latestProposal ?? null}
                  hasConditions={Boolean(conditions)}
                  onGo={goSection}
                />
              ) : section === "portal" ? (
                <OwnerTab implementation={implementation} part="portal" />
              ) : (
                <div className="flex flex-col gap-4">
                  <section
                    className="rounded-[var(--radius-card)] border bg-white p-5"
                    style={{ borderColor: "var(--stayo-border)" }}
                  >
                    <h2 className="mb-3 text-lg font-semibold">Histórico</h2>
                    <Timeline entries={history} />
                  </section>
                  <Collapsible
                    title="Detalhes técnicos e integração"
                    summary="IDs, origem e conversão para o Core"
                  >
                    <div className="grid gap-3 text-xs sm:grid-cols-2">
                      <Field label="ID da Implantação" value={implementation.id} />
                      <Field label="Código" value={implementation.code} />
                      {implementation.origin && (
                        <Field label="Origem" value={implementation.origin} />
                      )}
                      {implementation.corePropertyId && (
                        <Field label="Imóvel no Core" value={implementation.corePropertyId} />
                      )}
                      {implementation.coreOwnerId && (
                        <Field label="Proprietário no Core" value={implementation.coreOwnerId} />
                      )}
                      <Field label="Criada em" value={implementation.createdAt} />
                      <Field label="Atualizada em" value={implementation.updatedAt} />
                    </div>
                    <div className="mt-4">
                      <CoreConversionPanel implementation={implementation} />
                    </div>
                  </Collapsible>
                </div>
              )}
            </main>
          </div>
        </div>
      )}
    </div>
  );
}

/** Deriva a linha do tempo só de itens de checklist já concluídos — nenhum dado inventado. */
function recentActivity(items: ImplementationItem[]): TimelineEntry[] {
  return items
    .filter(
      (item): item is ImplementationItem & { completedAt: string } => item.completedAt !== null,
    )
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))
    .map((item) => ({
      id: item.id,
      label: `Concluído: ${item.title}`,
      timestamp: item.completedAt,
      actor: item.completedBy,
    }));
}

function SummaryHeading({ children }: { children: string }) {
  return (
    <h2
      className="mb-5 border-b pb-2 text-[11px] font-semibold uppercase tracking-[0.16em]"
      style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink-muted)" }}
    >
      {children}
    </h2>
  );
}

function SummaryRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-3 text-sm">
      <dt style={{ color: "var(--stayo-ink-muted)" }}>{label}</dt>
      <dd className="text-right font-semibold" style={{ color: "var(--stayo-forest)" }}>
        {value}
      </dd>
    </div>
  );
}

const chargeTypeLabels: Record<ChargeType, string> = {
  percentage: "Percentual",
  fixed_once: "Valor fixo (uma vez)",
  per_reservation: "Por reserva",
  monthly: "Mensal",
  optional: "Opcional",
  informational: "Informativo",
};

/** Snapshot das condições comerciais desta implantação — copiado dos defaults na criação. */
function ProposalGate({
  implementationId,
  pending,
  error,
  published,
  hasDraftChanges,
}: {
  implementationId: EntityId;
  pending: boolean;
  error: boolean;
  published: CommercialProposalVersion | null;
  hasDraftChanges: boolean;
}) {
  const navigate = Route.useNavigate();
  const goToConditions = () => void navigate({ search: { etapa: "proposta" } });
  void implementationId;
  const box = "rounded-[var(--radius-control)] border p-3 text-sm";
  if (pending)
    return (
      <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        Conferindo a proposta publicada…
      </p>
    );
  if (error)
    return (
      <p role="alert" className={box} style={{ borderColor: "var(--stayo-danger)" }}>
        Não foi possível conferir a proposta publicada. O envio fica bloqueado até confirmar.
      </p>
    );
  if (!published)
    return (
      <div
        role="status"
        className={box}
        style={{ borderColor: "var(--stayo-warning)", backgroundColor: "var(--stayo-gold-soft)" }}
      >
        <p className="font-medium" style={{ color: "var(--stayo-ink)" }}>
          Falta publicar as condições comerciais
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
          A oportunidade continua em rascunho. Para enviar o convite com proposta, revise e publique
          as condições; é a versão publicada que o proprietário verá no link.
        </p>
        <Button size="sm" variant="outline" className="mt-2 min-h-10" onClick={goToConditions}>
          Revisar e publicar condições
        </Button>
      </div>
    );
  const fixedTotal = published.snapshot?.items
    ? published.snapshot.items.reduce(
        (sum, i) => sum + (countsInDefinedTotal(i) ? Number(i.total) || 0 : 0),
        0,
      )
    : published.total;
  return (
    <div className={box} style={{ borderColor: "var(--stayo-border)" }}>
      <p className="font-medium" style={{ color: "var(--stayo-ink)" }}>
        O proprietário verá a proposta versão {published.version}
        {published.status === "accepted" ? " (já confirmada)" : ""}
      </p>
      <p className="mt-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        Publicada em{" "}
        {published.publishedAt
          ? new Date(published.publishedAt).toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            })
          : "—"}{" "}
        · {(published.snapshot?.items ?? published.items).length} serviço(s) · valor definido{" "}
        {fixedTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
      </p>
      {hasDraftChanges && (
        <p className="mt-1 text-xs" style={{ color: "var(--stayo-warning)" }}>
          Há alterações em rascunho que ainda não aparecem no link. Publique uma nova versão para
          mostrá-las.
        </p>
      )}
      <button type="button" className="mt-1 text-xs font-medium underline" onClick={goToConditions}>
        Ver ou revisar condições
      </button>
    </div>
  );
}

function CommercialTermsPanel({ implementationId }: { implementationId: EntityId }) {
  const queryClient = useQueryClient();
  const query = useQuery(commercialTermsQuery(implementationId));
  const terms = query.data ?? [];

  const clone = useMutation({
    mutationFn: () => adminApi.commercialTerms.cloneDefaults(implementationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["commercial-terms", implementationId] });
    },
  });

  const updateValue = useMutation({
    mutationFn: (input: { id: string; value: number }) =>
      adminApi.commercialTerms.update(input.id, { value: input.value }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["commercial-terms", implementationId] });
    },
  });

  return (
    <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2
          className="text-sm"
          style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
        >
          Condições comerciais
        </h2>
        {terms.length === 0 && !query.isPending && (
          <button
            type="button"
            onClick={() => clone.mutate()}
            disabled={clone.isPending}
            className="text-xs underline disabled:opacity-60"
            style={{ color: "var(--stayo-forest)" }}
          >
            {clone.isPending ? "Copiando..." : "Copiar dos padrões"}
          </button>
        )}
      </div>

      {query.isPending ? (
        <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          Carregando...
        </p>
      ) : terms.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          Nenhuma condição comercial nesta implantação ainda. Cadastre os padrões em Configurações →
          Condições comerciais e copie aqui.
        </p>
      ) : (
        <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
          {terms.map((term) => (
            <li key={term.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <span style={{ color: "var(--stayo-ink)" }}>{term.label}</span>
              <span
                className="rounded-full px-2 py-0.5 text-[11px]"
                style={{
                  backgroundColor: "var(--stayo-forest-soft)",
                  color: "var(--stayo-forest)",
                }}
              >
                {chargeTypeLabels[term.chargeType]}
              </span>
              {term.optional && (
                <span
                  className="rounded-full px-2 py-0.5 text-[11px]"
                  style={{
                    backgroundColor: "var(--stayo-gold-soft)",
                    color: "var(--stayo-warning)",
                  }}
                >
                  Opcional
                </span>
              )}
              <input
                type="number"
                step="0.01"
                min={0}
                defaultValue={term.value}
                onBlur={(e) => {
                  const value = Number(e.target.value) || 0;
                  if (value !== term.value) updateValue.mutate({ id: term.id, value });
                }}
                className="ml-auto w-28 rounded-[var(--radius-control)] border px-2 py-1 text-right text-sm outline-none"
                style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink)" }}
              />
              <span className="w-6 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                {term.chargeType === "percentage" ? "%" : "R$"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OwnerTab({
  implementation,
  part,
}: {
  implementation: ImplementationProject;
  part: "owner" | "portal";
}) {
  const owner = useQuery({
    ...ownerQuery(implementation.ownerId ?? ""),
    enabled: Boolean(implementation.ownerId),
  });
  const submission = useQuery(ownerOnboardingSubmissionQuery(implementation.id));
  const ownerData = owner.data;
  const submitted = submission.data;

  const confirmations = submitted
    ? [
        {
          label: "Nome",
          current: ownerData?.name ?? implementation.ownerName,
          received: submitted.fullName,
          normalize: normalizeName,
        },
        {
          label: "Telefone",
          current: ownerData?.phone ?? implementation.ownerPhone,
          received: submitted.phone,
          normalize: normalizePhone,
        },
        {
          label: "E-mail",
          current: ownerData?.email,
          received: submitted.email,
          normalize: normalizeEmail,
        },
        {
          label: "CPF/CNPJ",
          current: ownerData?.document,
          received: submitted.document,
          normalize: normalizeDocument,
        },
      ].filter(
        ({ current, received, normalize }) =>
          received && normalize(current) !== normalize(received),
      )
    : [];
  const registration = computeOwnerRegistration({
    submission: submitted ?? null,
    hasDivergences: confirmations.length > 0,
  });

  if (part === "portal")
    return (
      <div className="space-y-4">
        <div id="portal-owner-panel">
          <OwnerPortalPanel
            implementationId={implementation.id}
            ownerId={implementation.ownerId}
            ownerName={ownerData?.name ?? implementation.ownerName ?? null}
          />
        </div>
        <Collapsible title="Convite da proposta" summary="Link de apresentação e aceite">
          <OwnerInviteSection
            implementationId={implementation.id}
            ownerName={ownerData?.name ?? implementation.ownerName ?? null}
          />
        </Collapsible>
        <Collapsible title="Visibilidade no portal" summary="O que o proprietário pode ver">
          <OwnerVisibilityPanel
            implementationId={implementation.id}
            defaultMessage="Estamos organizando a implantação do seu imóvel. Você acompanhará cada etapa por aqui."
          />
        </Collapsible>
        <Collapsible title="Capa do link" summary="Foto exibida ao proprietário">
          <CoverPicker
            implementationId={implementation.id}
            propertyName={
              implementation.nickname || implementation.condominiumName || implementation.code
            }
          />
        </Collapsible>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        <div className="space-y-4">
          <OwnerIntakeReview
            implementationId={implementation.id}
            ownerName={ownerData?.name ?? implementation.ownerName ?? null}
          />
        </div>
        <div className="space-y-4">
          <section
            className="rounded-[var(--radius-card)] border bg-white p-5 shadow-sm sm:p-6"
            style={{ borderColor: "var(--stayo-border)" }}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <SummaryHeading>Proprietário vinculado</SummaryHeading>
                {implementation.ownerId ? (
                  <LinkedField
                    to="/proprietarios/$id"
                    id={implementation.ownerId}
                    label={ownerData?.name ?? implementation.ownerName}
                  />
                ) : (
                  <p className="font-semibold" style={{ color: "var(--stayo-ink)" }}>
                    {implementation.ownerName || "Proprietário ainda não vinculado"}
                  </p>
                )}
              </div>
              {implementation.ownerId && <Tag label="Principal" tone="neutral" />}
            </div>
            <dl
              className="mt-4 grid gap-x-8 border-t sm:grid-cols-2"
              style={{ borderColor: "var(--stayo-border)" }}
            >
              <SummaryRow
                label="Telefone"
                value={formatBrazilianPhone(ownerData?.phone ?? implementation.ownerPhone ?? "")}
              />
              <SummaryRow label="E-mail" value={ownerData?.email} />
              <SummaryRow label="Participação" value="Proprietário principal" />
            </dl>
          </section>

          <section
            className="rounded-[var(--radius-card)] border bg-white p-5 shadow-sm sm:p-6"
            style={{ borderColor: "var(--stayo-border)" }}
          >
            <div className="flex items-center justify-between gap-4">
              <SummaryHeading>Status do cadastro</SummaryHeading>
              <div className="flex items-center gap-2">
                {submitted && !submitted.submittedAt && (
                  <Tag label="Cadastro em andamento" tone="gold" />
                )}
                <span className="text-xs font-semibold" style={{ color: "var(--stayo-ink-muted)" }}>
                  {registration.percentage}%
                </span>
              </div>
            </div>
            <Progress value={registration.percentage} className="mb-5 h-1.5" />
            <ul className="grid gap-2 sm:grid-cols-2">
              {registration.groups.map((item) => (
                <li key={item.label} className="flex items-center gap-2 py-1 text-sm">
                  {item.state === "complete" ? (
                    <CheckCircle2 className="size-4 text-[var(--stayo-success)]" />
                  ) : (
                    <span
                      className="size-4 rounded-full border"
                      style={{ borderColor: "var(--stayo-border-strong)" }}
                    />
                  )}
                  <span
                    style={{
                      color:
                        item.state === "complete" ? "var(--stayo-ink)" : "var(--stayo-ink-muted)",
                    }}
                  >
                    {item.label}
                  </span>
                  <span
                    className="ml-auto text-xs"
                    style={{
                      color:
                        item.state === "complete"
                          ? "var(--stayo-success)"
                          : "var(--stayo-ink-muted)",
                    }}
                  >
                    {item.state === "complete"
                      ? "Completo"
                      : item.state === "review"
                        ? "Aguardando revisão"
                        : "Incompleto"}
                  </span>
                </li>
              ))}
            </ul>
            {registration.nextAction && implementation.ownerId && (
              <Button asChild className="mt-4" size="sm">
                <Link to="/proprietarios/$id" params={{ id: implementation.ownerId }}>
                  Resolver agora
                </Link>
              </Button>
            )}
          </section>

          <section
            className="rounded-[var(--radius-card)] border bg-white p-5 shadow-sm sm:p-6"
            style={{ borderColor: "var(--stayo-border)" }}
          >
            <SummaryHeading>Precisamos confirmar</SummaryHeading>
            {submission.isPending ? (
              <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                Verificando dados enviados...
              </p>
            ) : confirmations.length === 0 ? (
              <div
                className="flex items-center gap-2 text-sm"
                style={{ color: "var(--stayo-ink-muted)" }}
              >
                <CheckCircle2 className="size-4 text-[var(--stayo-success)]" />
                Nenhum dado enviado pelo proprietário aguarda revisão.
              </div>
            ) : (
              <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
                {confirmations.map((item) => (
                  <li
                    key={item.label}
                    className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center"
                  >
                    <AlertCircle className="size-4 shrink-0 text-[var(--stayo-warning)]" />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-medium" style={{ color: "var(--stayo-ink)" }}>
                        {item.label} alterado pelo proprietário
                      </p>
                      <p className="truncate" style={{ color: "var(--stayo-ink-muted)" }}>
                        Recebido: {item.received}
                      </p>
                    </div>
                    {implementation.ownerId && (
                      <Button asChild variant="outline" size="sm">
                        <Link to="/proprietarios/$id" params={{ id: implementation.ownerId }}>
                          Revisar cadastro
                        </Link>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

const invitationStatusLabels: Record<OwnerOnboardingLinkStatus, string> = {
  ativo: "Ativo",
  expirado: "Expirado",
  revogado: "Revogado",
  usado: "Usado",
};

const invitationStatusTone: Record<OwnerOnboardingLinkStatus, "neutral" | "danger" | "gold"> = {
  ativo: "neutral",
  expirado: "gold",
  revogado: "danger",
  usado: "neutral",
};

/**
 * Link de implantação do proprietário — único bloco com as três ações
 * (copiar link, copiar convite, acessar painel). A URL é sempre a externa
 * definitiva (/portal/implantacao/<token> ou, após criar a conta,
 * /portal/login); nunca a prévia interna e nunca só o ID da implantação.
 * O token é lido de uma tabela separada que só a equipe acessa e que é
 * apagada ao revogar/usar o convite.
 */
function OwnerPortalPanel({
  implementationId,
  ownerId,
  ownerName,
  compact = false,
}: {
  compact?: boolean;
  implementationId: EntityId;
  ownerId: EntityId | null;
  ownerName: string | null;
}) {
  const queryClient = useQueryClient();
  const linkQuery = useQuery(ownerOnboardingLinkQuery(implementationId));
  const submissionQuery = useQuery(ownerOnboardingSubmissionQuery(implementationId));
  const link = linkQuery.data;
  const status = link ? ownerOnboardingLinkStatus(link) : null;
  const tokenQuery = useQuery({
    queryKey: ["owner-onboarding", "link-token", link?.id],
    queryFn: () => link ? adminApi.ownerOnboarding.getLinkToken(link.id) : Promise.resolve(null),
    enabled: Boolean(link && status === "ativo"),
    staleTime: 60_000,
  });

  const invalidateLink = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["owner-onboarding", "link", implementationId],
    });
    await queryClient.invalidateQueries({ queryKey: ["owner-onboarding", "link-token"] });
  };

  const createLink = useMutation({
    mutationFn: () => adminApi.ownerOnboarding.createLink(implementationId, ownerId),
    onSuccess: async ({ link: created, token }) => {
      queryClient.setQueryData(["owner-onboarding", "link-token", created.id], token);
      await queryClient.invalidateQueries({
        queryKey: ["owner-onboarding", "link", implementationId],
      });
      toast.success("Link gerado", { description: "Qualquer link anterior foi desativado." });
    },
    onError: () => toast.error("Não foi possível gerar o link"),
  });

  const revokeLink = useMutation({
    mutationFn: (id: EntityId) => adminApi.ownerOnboarding.revoke(id),
    onSuccess: async () => {
      await invalidateLink();
      toast.success("Link revogado");
    },
    onError: () => toast.error("Não foi possível revogar o link"),
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const token = status === "ativo" ? (tokenQuery.data ?? null) : null;
  const ownerUrl =
    status === "usado"
      ? `${origin}/portal/login`
      : token
        ? `${origin}/portal/implantacao/${token}`
        : null;
  const needsNewLink =
    !link ||
    status === "expirado" ||
    status === "revogado" ||
    (status === "ativo" && tokenQuery.isSuccess && !token);

  const rawFirstName = (ownerName ?? "").trim().split(/\s+/)[0] ?? "";
  const firstName = rawFirstName
    ? rawFirstName.charAt(0).toLocaleUpperCase("pt-BR") + rawFirstName.slice(1)
    : "";
  const defaultMessage = ownerUrl
    ? `${firstName ? `Oi, ${firstName}!` : "Oi!"} Confira sua proposta STAYO e, após confirmar as condições, preencha seus dados e os demais participantes para prepararmos o contrato. Você pode parar e continuar pelo mesmo link: ${ownerUrl}`
    : "";
  const [message, setMessage] = useState(defaultMessage);
  const [editingMessage, setEditingMessage] = useState(false);
  useEffect(() => {
    setMessage(defaultMessage);
  }, [defaultMessage]);

  const copy = async (text: string, success: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(success);
    } catch {
      toast.error("Não foi possível copiar", { description: "Selecione e copie manualmente." });
    }
  };

  const proposalsQuery = useQuery({
    queryKey: ["commercial-proposals", implementationId],
    queryFn: () => commercialProposalsApi.list(implementationId),
  });
  const versions = proposalsQuery.data ?? [];
  const published = versions
    .filter((v) => v.status === "published" || v.status === "accepted")
    .sort((a, b) => b.version - a.version)[0];
  const hasDraftChanges = versions.some(
    (v) => v.status === "draft" && (!published || v.updatedAt > (published.publishedAt ?? "")),
  );
  const canSend = Boolean(published);

  const submission = submissionQuery.data;
  const fmt = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : null;

  const steps: { label: string; done: boolean; detail: string }[] = [
    {
      label: "Link gerado",
      done: Boolean(link),
      detail: link ? (fmt(link.createdAt) ?? "") : "Ainda não gerado",
    },
    {
      label: "Acessado",
      done: Boolean(link?.lastAccessAt),
      detail: fmt(link?.lastAccessAt) ?? "Ainda não acessado",
    },
    {
      label: "Cadastro recebido",
      done: Boolean(submission?.submittedAt),
      detail: submission?.submittedAt
        ? (fmt(submission.submittedAt) ?? "")
        : submission
          ? "Em andamento"
          : "Aguardando",
    },
    {
      label: "Conta criada",
      done: status === "usado",
      detail: status === "usado" ? (fmt(link?.usedAt) ?? "") : "Aguardando",
    },
  ];

  const statusDetail = !link
    ? "Nenhum link gerado"
    : status === "ativo"
      ? `Válido até ${fmt(link.expiresAt)}`
      : status === "revogado"
        ? `Revogado em ${fmt(link.revokedAt)}`
        : status === "expirado"
          ? `Venceu em ${fmt(link.expiresAt)}`
          : `Conta criada em ${fmt(link.usedAt)} · acesso pelo login`;

  return (
    <section
      aria-labelledby="owner-link-title"
      className={compact ? "min-w-0 rounded-lg border border-[var(--stayo-border)] bg-[var(--stayo-surface)] p-4 text-[var(--stayo-navy)]" : "rounded-[var(--radius-card)] border-2 bg-white p-4 shadow-sm sm:p-5"}
      style={compact ? undefined : { borderColor: "var(--stayo-forest)" }}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h2
            id="owner-link-title"
            className="text-base font-semibold"
            style={{ fontFamily: compact ? "Outfit, sans-serif" : "var(--stayo-font-display)", color: "var(--stayo-navy)" }}
          >
             {status === "usado" ? "Portal do proprietário" : "Proposta e cadastro para contrato"}
          </h2>
          <p className="mt-0.5 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
            {linkQuery.isPending ? "Verificando link…" : statusDetail}
          </p>
        </div>
        {status && (
          <Tag label={invitationStatusLabels[status]} tone={invitationStatusTone[status]} />
        )}
      </div>

      <div className="mt-4">
        {linkQuery.isError ? (
          <p className="text-sm text-[var(--stayo-danger)]">
            Não foi possível verificar o link agora.{" "}
            <button type="button" className="underline" onClick={() => void linkQuery.refetch()}>
              Tentar de novo
            </button>
          </p>
        ) : linkQuery.isPending || (status === "ativo" && tokenQuery.isPending) ? (
          <div className="h-11 animate-pulse rounded-[var(--radius-control)] bg-[var(--stayo-surface-muted,#f1efe9)]" />
        ) : needsNewLink ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
              {status === "ativo"
                ? "Este link foi criado antes de a equipe poder copiá-lo de novo. Gere um novo para continuar."
                : "Ainda não há um link válido para o proprietário."}
            </p>
            <Button
              onClick={() => createLink.mutate()}
              disabled={createLink.isPending}
              className="min-h-11"
            >
               <Send /> {createLink.isPending ? "Gerando…" : "Gerar convite"}
            </Button>
          </div>
        ) : ownerUrl ? (
          <>
            <ProposalGate
              implementationId={implementationId}
              pending={proposalsQuery.isPending}
              error={proposalsQuery.isError}
              published={published ?? null}
              hasDraftChanges={hasDraftChanges}
            />
            <div className={compact ? "mt-3 flex flex-wrap gap-2" : "mt-3 grid gap-2 sm:grid-cols-3"}>
              <Button
                className="min-h-11"
                disabled={!canSend}
                onClick={() => void copy(ownerUrl, "Link copiado")}
              >
                <Copy /> Copiar link
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                disabled={!canSend}
                onClick={() => void copy(message, "Mensagem copiada")}
              >
                <Copy /> {compact ? "Copiar convite" : "Copiar mensagem"}
              </Button>
              <Button asChild variant="outline" className="min-h-11">
                <a
                  href={ownerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abre a jornada real deste proprietário em nova aba"
                >
                   <ExternalLink /> {status === "usado" ? "Abrir Portal" : "Abrir jornada"}
                </a>
              </Button>
            </div>
            <details open={compact ? undefined : true} className="mt-3">
            {compact && <summary className="cursor-pointer text-xs text-[var(--stayo-ink-muted)]">Mensagem do convite</summary>}
            <div
              className="mt-3 rounded-[var(--radius-control)] border p-3"
              style={{ borderColor: "var(--stayo-border)" }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium" style={{ color: "var(--stayo-ink-muted)" }}>
                  Mensagem do convite (WhatsApp)
                </span>
                <button
                  type="button"
                  className="text-xs font-medium underline"
                  onClick={() => setEditingMessage((v) => !v)}
                >
                  {editingMessage ? "Pronto" : "Editar"}
                </button>
              </div>
              {editingMessage ? (
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={4}
                  aria-label="Mensagem do convite"
                  className="mt-2 w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm"
                />
              ) : (
                <p className="mt-1 text-sm break-words" style={{ color: "var(--stayo-ink)" }}>
                  {message}
                </p>
              )}
              <p className="mt-2 text-[11px]" style={{ color: "var(--stayo-ink-muted)" }}>
                Copiar não envia nada. Cole a mensagem no WhatsApp do proprietário.
              </p>
            </div>
            </details>
          </>
        ) : null}
      </div>

      {!compact && <ol
        className="mt-4 grid grid-cols-2 gap-2 border-t pt-4 sm:grid-cols-4"
        style={{ borderColor: "var(--stayo-border)" }}
      >
        {steps.map((step) => (
          <li key={step.label} className="flex min-w-0 items-start gap-2">
            {step.done ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--stayo-success)]" />
            ) : (
              <span
                className="mt-0.5 size-4 shrink-0 rounded-full border"
                style={{ borderColor: "var(--stayo-border-strong)" }}
              />
            )}
            <span className="min-w-0">
              <span className="block text-xs font-medium" style={{ color: "var(--stayo-ink)" }}>
                {step.label}
              </span>
              <span
                className="block truncate text-[11px]"
                style={{ color: "var(--stayo-ink-muted)" }}
              >
                {step.detail}
              </span>
            </span>
          </li>
        ))}
      </ol>}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        {status === "ativo" && link && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                disabled={revokeLink.isPending}
                className="font-medium text-[var(--stayo-danger)] underline disabled:opacity-60"
              >
                Revogar link
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Revogar o link do proprietário?</AlertDialogTitle>
                <AlertDialogDescription>
                  O link deixa de funcionar na hora. Você pode gerar um novo depois.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => revokeLink.mutate(link.id)}>
                  Confirmar revogação
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        {status === "ativo" && !needsNewLink && (
          <button
            type="button"
            onClick={() => createLink.mutate()}
            disabled={createLink.isPending}
            className="underline disabled:opacity-60"
            style={{ color: "var(--stayo-ink-muted)" }}
          >
            Gerar novo link (desativa o atual)
          </button>
        )}
        <Link
          to="/portal/previa/$id"
          params={{ id: implementationId }}
          target="_blank"
          rel="noreferrer"
          className="ml-auto underline"
          style={{ color: "var(--stayo-ink-muted)" }}
        >
          Prévia interna (só equipe)
        </Link>
      </div>

      {submission && (
        <details
          open
          className="mt-3 rounded-[var(--radius-control)] border p-3"
          style={{ borderColor: "var(--stayo-border)" }}
        >
          <summary className="cursor-pointer text-xs font-medium">
            {submission.submittedAt
              ? "Dados enviados pelo proprietário — revisar"
              : "Preenchido pelo proprietário (em andamento) — revisar"}
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Nome completo" value={submission.fullName} />
            <Field label="Documento" value={maskDocument(submission.document)} />
            <Field label="E-mail" value={submission.email} />
            <Field label="Telefone" value={submission.phone} />
            <Field label="Chave Pix" value={maskPixKey(submission.pixKey)} />
            <Field label="Recebido em" value={submission.submittedAt} />
          </div>
        </details>
      )}
    </section>
  );
}

const initialChargeStatusOptions: InitialChargeStatus[] = [
  "pending",
  "issued",
  "paid",
  "overdue",
  "cancelled",
];

/**
 * Cobrança inicial (seção 25) — nasce automaticamente quando o proprietário
 * aceita a proposta (itens `fixed_once`). Aqui o time só acompanha e marca
 * como paga; nunca cria ou edita o valor manualmente.
 */
function InitialChargesPanel({ implementationId }: { implementationId: EntityId }) {
  const queryClient = useQueryClient();
  const query = useQuery(initialChargesQuery(implementationId));
  const charges = query.data ?? [];

  const updateStatus = useMutation({
    mutationFn: (input: { id: string; status: InitialChargeStatus }) =>
      adminApi.initialCharges.updateStatus(input.id, input.status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["initial-charges", implementationId] });
    },
  });

  if (query.isPending) return null;
  if (charges.length === 0) return null;

  return (
    <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
      <h2
        className="mb-3 text-sm"
        style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
      >
        Cobrança inicial
      </h2>
      <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
        {charges.map((charge) => (
          <li key={charge.id} className="flex flex-col gap-2 py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span style={{ color: "var(--stayo-ink-muted)" }}>{charge.code}</span>
              <span className="font-medium">{formatMoney(charge.amount)}</span>
            </div>
            <ul className="pl-3 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
              {charge.items.map((item, i) => (
                <li key={i}>
                  {item.label} — {formatMoney(item.amount)}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={charge.status}
                onChange={(e) =>
                  updateStatus.mutate({
                    id: charge.id,
                    status: e.target.value as InitialChargeStatus,
                  })
                }
                disabled={updateStatus.isPending}
                className="rounded-[var(--radius-control)] border px-2 py-1 text-xs"
                style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink)" }}
              >
                {initialChargeStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {initialChargeStatusLabels[status]}
                  </option>
                ))}
              </select>
              {charge.paidAt && (
                <span className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                  Pago em {new Date(charge.paidAt).toLocaleString("pt-BR")}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Fase 11 — preparação para converter esta implantação em Property/Owner
 * oficiais do Core. Sempre lê `corePropertyId`/`coreOwnerId` como fonte da
 * verdade (nunca fabrica um resultado): enquanto não há endpoint de escrita
 * real do Core, o botão só mostra por que a conversão ainda não é possível.
 */
function CoreConversionPanel({ implementation }: { implementation: ImplementationProject }) {
  const [error, setError] = useState<string | null>(null);
  const alreadyConverted = Boolean(implementation.corePropertyId && implementation.coreOwnerId);

  const convert = useMutation({
    mutationFn: () => coreConversionService.convertImplementation(implementation),
    onError: (err) => setError(err instanceof Error ? err.message : String(err)),
    onSuccess: () => setError(null),
  });

  return (
    <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
      <h2
        className="mb-3 text-sm"
        style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
      >
        Conversão para o Core
      </h2>
      {alreadyConverted ? (
        <p className="text-sm" style={{ color: "var(--stayo-success)" }}>
          Convertida — imóvel {implementation.corePropertyId} · proprietário{" "}
          {implementation.coreOwnerId}.
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
            {isCoreConversionEnabled()
              ? "A flag de conversão está ligada, mas o Core ainda não expõe um endpoint de escrita — a implantação não pode virar Property/Owner oficiais ainda."
              : "Conversão desligada por padrão (VITE_ENABLE_CORE_CONVERSION) — o Core ainda não expõe um endpoint de escrita para properties/owners."}
          </p>
          <button
            type="button"
            onClick={() => convert.mutate()}
            disabled={convert.isPending}
            className="rounded-[var(--radius-control)] border px-3 py-2 text-sm disabled:opacity-60"
            style={{ ...surface, color: "var(--stayo-ink-muted)" }}
          >
            {convert.isPending ? "Verificando..." : "Converter para o Core"}
          </button>
          {error && (
            <p className="mt-2 text-xs" style={{ color: "var(--stayo-danger)" }} role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function StatusStepper({
  status,
  onChange,
  pending,
}: {
  status: ImplementationStatus;
  onChange: (status: ImplementationStatus) => void;
  pending: boolean;
}) {
  const currentIndex = mainStatusFlow.indexOf(status);
  const isAlternate = alternateStatuses.includes(status);
  const visibleIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextStatus = mainStatusFlow[visibleIndex + 1];

  return (
    <section className="implementation-stepper">
      <div className="implementation-stepper-heading">
        <div>
          <p>Status da implantação</p>
          <span>
            Etapa {visibleIndex + 1} de {mainStatusFlow.length}
          </span>
        </div>
        <select
          value={status}
          onChange={(e) => onChange(e.target.value as ImplementationStatus)}
          disabled={pending}
          className="implementation-status-select"
          aria-label="Alterar status da implantação"
        >
          {[...mainStatusFlow, ...alternateStatuses].map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </select>
      </div>

      <ol className="implementation-step-segments" aria-label="Progresso das etapas">
        {mainStatusFlow.map((s, index) => {
          let state: "done" | "current" | "future" | "blocked" = "future";

          if (isAlternate) {
            state = "blocked";
          } else if (currentIndex !== -1) {
            if (index < currentIndex) state = "done";
            else if (index === currentIndex) state = "current";
          }

          return (
            <li
              key={s}
              className={`is-${state}`}
              aria-label={`${statusLabels[s]}: ${state === "current" ? "etapa atual" : state === "done" ? "concluída" : "futura"}`}
            >
              <span />
            </li>
          );
        })}
      </ol>
      <p className="implementation-current-stage">
        <strong>{statusLabels[status]}</strong>
        {nextStatus && !isAlternate && <span>Próxima: {statusLabels[nextStatus]}</span>}
      </p>

      {isAlternate && (
        <p
          className="mt-5 inline-block rounded-[var(--radius-control)] px-2 py-1 text-xs"
          style={{ backgroundColor: "var(--stayo-gold-soft)", color: "var(--stayo-warning)" }}
        >
          Fora da linha principal (bloqueado): {statusLabels[status]}
        </p>
      )}
    </section>
  );
}


function Checklist({
  implementationId,
  items,
  loading,
  error,
  onRetry,
}: {
  implementationId: EntityId;
  items: ImplementationItem[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const queryClient = useQueryClient();

  const generate = useMutation({
    mutationFn: () => coreApi.implementations.generateChecklist(implementationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["implementations", "items", implementationId],
      });
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ itemId, status }: { itemId: EntityId; status: ImplementationItem["status"] }) =>
      coreApi.implementations.updateChecklistItem(itemId, {
        status,
        completedAt: status === "concluido" ? new Date().toISOString() : null,
        completedBy: null,
        // Trocar de status sempre limpa um override anterior — prontidão
        // nunca deve herdar a justificativa de um estado diferente.
        readinessOverrideReason: null,
        readinessOverrideBy: null,
        readinessOverrideAt: null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["implementations", "items", implementationId],
      });
    },
  });

  const override = useMutation({
    mutationFn: async ({
      itemId,
      reason,
      by,
    }: {
      itemId: EntityId;
      reason: string;
      by: string;
    }) => {
      const updated = await coreApi.implementations.updateChecklistItem(itemId, {
        readinessOverrideReason: reason,
        readinessOverrideBy: by,
        readinessOverrideAt: new Date().toISOString(),
      });
      await adminApi.audit.log({
        actorId: null,
        event: "readiness.override",
        entityType: "implementation-item",
        entityId: itemId,
        metadata: { reason, by },
      });
      return updated;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["implementations", "items", implementationId],
      });
    },
  });

  const groups = useMemo(() => {
    const map = new Map<string, Map<string, ImplementationItem[]>>();
    for (const item of [...items].sort((a, b) => a.order - b.order)) {
      const byCategory = map.get(item.phase) ?? new Map<string, ImplementationItem[]>();
      byCategory.set(item.category, [...(byCategory.get(item.category) ?? []), item]);
      map.set(item.phase, byCategory);
    }
    return map;
  }, [items]);

  if (loading) {
    return (
      <Panel>
        <div className="space-y-3 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-5 w-full animate-pulse rounded"
              style={{ backgroundColor: "var(--stayo-border)" }}
            />
          ))}
        </div>
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel>
        <ErrorRows onRetry={onRetry} />
      </Panel>
    );
  }

  if (items.length === 0) {
    return (
      <Panel>
        <div className="flex flex-col items-center gap-3 px-4 py-16 text-center text-sm">
          <p style={{ color: "var(--stayo-ink-muted)" }}>
            Nenhum item de checklist nesta implantação ainda
          </p>
          <button
            type="button"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
            className="rounded-[var(--radius-control)] px-3 py-2 text-sm disabled:opacity-60"
            style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
          >
            {generate.isPending ? "Gerando..." : "Gerar checklist a partir do template"}
          </button>
          {generate.isError && (
            <span style={{ color: "var(--stayo-danger)" }} role="alert">
              Não foi possível gerar o checklist.
            </span>
          )}
        </div>
      </Panel>
    );
  }

  const totalItems = items.length;
  const completedItems = items.filter((i) => i.status === "concluido").length;
  const pendingItems = items.filter((i) => i.status !== "concluido");
  const blockersPending = pendingItems.filter((i) => i.blocker).length;
  const nextAction = [...pendingItems].sort(
    (a, b) => Number(b.blocker) - Number(a.blocker) || a.order - b.order,
  )[0];
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Painel de status geral */}
      <div
        className="overflow-hidden rounded-[var(--radius-card)] border bg-white shadow-sm"
        style={{ borderColor: "var(--stayo-border)" }}
      >
        <div
          className="grid divide-y sm:grid-cols-[1fr_auto_1.4fr] sm:divide-x sm:divide-y-0"
          style={{ borderColor: "var(--stayo-border)" }}
        >
          <div className="p-4">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: "var(--stayo-ink-muted)" }}
            >
              Progresso geral
            </p>
            <div className="mt-2 flex items-center gap-3">
              <strong className="text-xl" style={{ color: "var(--stayo-forest)" }}>
                {progressPercent}%
              </strong>
              <div className="min-w-0 flex-1">
                <Progress value={progressPercent} className="h-2" />
              </div>
              <span className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                {completedItems}/{totalItems}
              </span>
            </div>
          </div>
          <div className="min-w-36 p-4">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: "var(--stayo-ink-muted)" }}
            >
              Bloqueadores
            </p>
            <p
              className="mt-2 text-sm font-semibold"
              style={{ color: blockersPending > 0 ? "var(--stayo-danger)" : "var(--stayo-ink)" }}
            >
              {blockersPending} pendente{blockersPending === 1 ? "" : "s"}
            </p>
          </div>
          <div className="min-w-0 p-4">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: "var(--stayo-ink-muted)" }}
            >
              Próxima ação
            </p>
            <p
              className="mt-2 truncate text-sm font-semibold"
              style={{ color: "var(--stayo-ink)" }}
              title={nextAction?.title ?? "Tudo concluído"}
            >
              {nextAction?.title ?? "Tudo concluído"}
            </p>
            {nextAction && (
              <p className="mt-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                {nextAction.phase} ·{" "}
                {nextAction.blocker ? "Bloqueador" : itemStatusLabels[nextAction.status]}
              </p>
            )}
          </div>
        </div>
      </div>

      <Accordion type="single" collapsible className="w-full space-y-3">
        {[...groups.entries()].map(([phase, categories]) => {
          const phaseItems = Array.from(categories.values()).flat();
          const phaseTotal = phaseItems.length;
          const phaseCompleted = phaseItems.filter((i) => i.status === "concluido").length;

          return (
            <AccordionItem
              key={phase}
              value={phase}
              className="rounded-[var(--radius-card)] border bg-white overflow-hidden shadow-sm"
              style={{ borderColor: "var(--stayo-border)" }}
            >
              <AccordionTrigger
                className="px-4 py-3 hover:no-underline data-[state=open]:border-b data-[state=open]:bg-[var(--stayo-bg)]"
                style={{ borderColor: "var(--stayo-border)" }}
              >
                <div className="flex items-center justify-between w-full pr-4">
                  <span className="text-sm font-semibold" style={{ color: "var(--stayo-ink)" }}>
                    {phase}
                  </span>
                  <span
                    className="text-[11px] font-medium rounded-full bg-slate-200/60 px-2.5 py-0.5"
                    style={{ color: "var(--stayo-ink)" }}
                  >
                    {phaseCompleted}/{phaseTotal}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-0 bg-white pb-0">
                {[...categories.entries()].map(([category, list], idx, arr) => (
                  <div key={category}>
                    <p
                      className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider font-bold"
                      style={{ color: "var(--stayo-ink-muted)" }}
                    >
                      {category}
                    </p>
                    <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
                      {list.map((item) => (
                        <li key={item.id} className="flex flex-col gap-2 px-4 py-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <span
                                className="flex size-5 shrink-0 items-center justify-center rounded-full border"
                                style={{
                                  borderColor:
                                    item.status === "concluido"
                                      ? "var(--stayo-success)"
                                      : "var(--stayo-border)",
                                  backgroundColor:
                                    item.status === "concluido"
                                      ? "var(--stayo-success)"
                                      : "transparent",
                                  color: "var(--stayo-surface)",
                                }}
                              >
                                {item.status === "concluido" && <Check className="size-3" />}
                              </span>
                              <select
                                value={item.status}
                                onChange={(e) =>
                                  updateStatus.mutate({
                                    itemId: item.id,
                                    status: e.target.value as ImplementationItem["status"],
                                  })
                                }
                                disabled={updateStatus.isPending}
                                className="flex-shrink-0 w-36 rounded-[var(--radius-control)] border px-2 py-1 text-[11px] outline-none disabled:opacity-60 bg-transparent font-medium"
                                style={{
                                  borderColor: "var(--stayo-border)",
                                  color: itemStatusColor[item.status],
                                }}
                              >
                                {Object.entries(itemStatusLabels).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                              <span
                                className="text-sm font-medium leading-tight"
                                style={{ color: "var(--stayo-ink)" }}
                              >
                                {item.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                              {item.dueDate && (
                                <span
                                  className="rounded bg-[var(--stayo-bg)] px-2 py-1 text-[10px]"
                                  style={{ color: "var(--stayo-ink-muted)" }}
                                >
                                  Prazo:{" "}
                                  {new Date(item.dueDate).toLocaleDateString("pt-BR", {
                                    timeZone: "UTC",
                                  })}
                                </span>
                              )}
                              {item.responsibleUserId && (
                                <span
                                  className="max-w-[160px] truncate rounded bg-[var(--stayo-bg)] px-2 py-1 text-[10px]"
                                  style={{ color: "var(--stayo-ink-muted)" }}
                                  title={item.responsibleUserId}
                                >
                                  Responsável: {item.responsibleUserId}
                                </span>
                              )}
                              {item.mandatory && <Tag label="Obrigatório" />}
                              {item.blocker && <Tag label="Bloqueador" tone="danger" />}
                              {item.ownerVisible && <Tag label="Visível" tone="gold" />}
                            </div>
                          </div>
                          {item.status === "pulado" && (item.mandatory || item.blocker) && (
                            <div className="mt-2 text-xs">
                              <ReadinessOverrideRow item={item} onConfirm={override.mutate} />
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                    {idx < arr.length - 1 && (
                      <div className="border-b" style={{ borderColor: "var(--stayo-border)" }} />
                    )}
                  </div>
                ))}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

/**
 * Item pulado que é obrigatório/bloqueador continua contando como pendência
 * de prontidão (ver `computeReadiness`) até um override formal e
 * justificado — nunca vira "resolvido" só por trocar o status.
 */
function ReadinessOverrideRow({
  item,
  onConfirm,
}: {
  item: ImplementationItem;
  onConfirm: (input: { itemId: EntityId; reason: string; by: string }) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [reason, setReason] = useState("");
  const [by, setBy] = useState("");

  if (item.readinessOverrideAt) {
    return (
      <p
        className="rounded-[var(--radius-control)] px-3 py-2 text-xs"
        style={{ backgroundColor: "var(--stayo-forest-soft)", color: "var(--stayo-forest)" }}
      >
        Override de prontidão registrado por {item.readinessOverrideBy} em{" "}
        {new Date(item.readinessOverrideAt).toLocaleString("pt-BR")}: {item.readinessOverrideReason}
      </p>
    );
  }

  return (
    <div
      className="rounded-[var(--radius-control)] border px-3 py-2 text-xs"
      style={{ borderColor: "var(--stayo-danger)", color: "var(--stayo-danger)" }}
    >
      <p>
        Item pulado, mas {item.mandatory ? "obrigatório" : "bloqueador"} — continua impedindo a
        prontidão desta implantação, salvo override.
      </p>
      {expanded ? (
        <div className="mt-2 flex flex-col gap-2">
          <input
            value={by}
            onChange={(e) => setBy(e.target.value)}
            placeholder="Autorizado por"
            className="rounded-[var(--radius-control)] border px-2 py-1 text-xs outline-none"
            style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink)" }}
          />
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Justificativa do override"
            className="rounded-[var(--radius-control)] border px-2 py-1 text-xs outline-none"
            style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink)" }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={reason.trim() === "" || by.trim() === ""}
              onClick={() => onConfirm({ itemId: item.id, reason, by })}
              className="rounded-[var(--radius-control)] px-2 py-1 text-xs disabled:opacity-50"
              style={{ backgroundColor: "var(--stayo-danger)", color: "#fdfdfb" }}
            >
              Confirmar override
            </button>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-xs underline"
              style={{ color: "var(--stayo-ink-muted)" }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1 text-xs underline"
          style={{ color: "var(--stayo-danger)" }}
        >
          Registrar override
        </button>
      )}
    </div>
  );
}

function Tag({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "danger" | "gold" }) {
  const tones = {
    neutral: { backgroundColor: "var(--stayo-forest-soft)", color: "var(--stayo-forest)" },
    danger: { backgroundColor: "var(--stayo-gold-soft)", color: "var(--stayo-danger)" },
    gold: { backgroundColor: "var(--stayo-gold-soft)", color: "var(--stayo-warning)" },
  } as const;
  return (
    <span className="rounded-full px-2 py-0.5 text-[11px]" style={tones[tone]}>
      {label}
    </span>
  );
}
