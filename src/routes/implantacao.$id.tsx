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
  ListChecks,
  LockKeyhole,
  Pencil,
  Send,
  Share2,
  CalendarPlus,
  Megaphone,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
import { EnxovalTab } from "../components/implantacao/EnxovalTab";
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
      { property: "og:title", content: "Detalhe da implantação — Stayo Admin" },
      {
        property: "og:description",
        content: "Etapas e checklist de uma implantação Stayo.",
      },
    ],
  }),
  component: ImplementationDetailPage,
});

const surface = {
  backgroundColor: "var(--stayo-surface)",
  borderColor: "var(--stayo-border)",
};

function ImplementationDetailPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<
    "resumo" | "proprietario" | "imovel" | "enxoval" | "itens_faltantes" | "checklist" | "proposta"
  >("resumo");
  const query = useQuery(implementationQuery(id));
  const itemsQuery = useQuery(implementationItemsQuery(id));
  const implementation = query.data;
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

  return (
    <div className="implementation-workspace">
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
        <Link to="/implantacao" className="implementation-back-link">
          Ver todas
        </Link>
      </header>

      {query.isPending ? (
        <DetailSkeleton />
      ) : query.isError ? (
        <ErrorRows onRetry={() => void query.refetch()} />
      ) : !implementation ? (
        <NotFoundPanel message="Implantação não encontrada" />
      ) : (
        <div className="implementation-workspace-stack">
          <section className="implementation-identity">
            <div className="implementation-cover">
              {implementation.coverImage ? (
                <img
                  src={implementation.coverImage}
                  alt={`Capa do imóvel ${implementation.nickname ?? implementation.code}`}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-[var(--stayo-forest)]" />
              )}
              <div className="implementation-cover-overlay" />
            </div>
            <div className="implementation-identity-body">
              <div className="implementation-identity-copy">
                <div className="implementation-property-mark" aria-hidden="true" />
                <h1 className="implementation-property-name">{propertyName}</h1>
                <div className="implementation-identity-meta">
                  <span className="implementation-status-pill">
                    <span aria-hidden="true" />
                    {statusLabels[implementation.status]}
                  </span>
                  <span>Proprietário: {implementation.ownerName || "Não informado"}</span>
                </div>
              </div>
              <div className="implementation-actions">
                <Button
                  className="implementation-primary-action"
                  size="sm"
                  onClick={() => setTab("proprietario")}
                >
                  <ExternalLink /> Portal
                </Button>
                <Button
                  className="implementation-secondary-action"
                  variant="outline"
                  size="sm"
                  onClick={() => void shareWorkspace()}
                >
                  <Share2 /> Compartilhar
                </Button>
              </div>
            </div>
          </section>

          <StatusStepper
            status={implementation.status}
            onChange={(status) => changeStatus.mutate(status)}
            pending={changeStatus.isPending}
          />

          <IndicatorCards items={items} loading={itemsQuery.isPending} />

          <nav className="implementation-tabs" aria-label="Seções da implantação">
            {(
              [
                "resumo",
                "proprietario",
                "imovel",
                "enxoval",
                "itens_faltantes",
                "checklist",
                "proposta",
              ] as const
            ).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={tab === t ? "is-active" : undefined}
                aria-current={tab === t ? "page" : undefined}
              >
                {t === "resumo"
                  ? "Resumo"
                  : t === "proprietario"
                    ? "Proprietário"
                    : t === "imovel"
                      ? "Imóvel"
                      : t === "enxoval"
                        ? "Enxoval"
                        : t === "itens_faltantes"
                          ? "Itens faltantes"
                          : t === "checklist"
                            ? "Checklist"
                            : "Proposta"}
              </button>
            ))}
          </nav>

          {tab === "resumo" ? (
            <div className="implementation-summary">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(260px,0.85fr)]">
                <div className="min-w-0 space-y-6">
                  <section>
                    <p className="implementation-section-label">Recomendação</p>
                    <div className="implementation-next-action">
                      <h2
                        className="text-xl font-semibold leading-snug sm:text-2xl"
                        style={{
                          fontFamily: "var(--stayo-font-display)",
                          color: "var(--stayo-forest)",
                        }}
                      >
                        {nextItem?.title ?? "Tudo em dia por enquanto"}
                      </h2>
                      <p
                        className="mt-2 max-w-2xl text-sm leading-relaxed"
                        style={{ color: "var(--stayo-ink-muted)" }}
                      >
                        {nextItem?.description ||
                          "Revise o progresso e acompanhe as próximas etapas da implantação."}
                      </p>
                      {nextItem && (
                        <Button size="sm" className="mt-3" onClick={() => setTab("checklist")}>
                          <ListChecks /> Resolver agora <ChevronRight />
                        </Button>
                      )}
                    </div>
                  </section>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <section>
                      <SummaryHeading>Imóvel</SummaryHeading>
                      <dl className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
                        <SummaryRow label="Condomínio" value={implementation.condominiumName} />
                        <SummaryRow label="Unidade" value={implementation.unit} />
                        <SummaryRow label="Cidade" value={implementation.city} />
                        <SummaryRow
                          label="Perfil"
                          value={
                            [
                              implementation.propertyType,
                              implementation.bedrooms != null
                                ? `${implementation.bedrooms} quarto(s)`
                                : null,
                              implementation.capacity != null
                                ? `${implementation.capacity} hóspedes`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ") || null
                          }
                        />
                      </dl>
                    </section>
                    <section>
                      <SummaryHeading>Proprietário</SummaryHeading>
                      <div className="space-y-2 text-sm">
                        {implementation.ownerId ? (
                          <LinkedField
                            to="/proprietarios/$id"
                            id={implementation.ownerId}
                            label={implementation.ownerName}
                          />
                        ) : (
                          <p className="font-semibold" style={{ color: "var(--stayo-forest)" }}>
                            {implementation.ownerName || "Não informado"}
                          </p>
                        )}
                        <p style={{ color: "var(--stayo-ink-muted)" }}>
                          {implementation.ownerPhone || "Telefone não informado"}
                        </p>
                      </div>
                    </section>
                    <section>
                      <SummaryHeading>Implantação</SummaryHeading>
                      <dl className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
                        <SummaryRow label="Etapa" value={statusLabels[implementation.status]} />
                        <SummaryRow label="Responsável" value={implementation.responsibleUserId} />
                        <SummaryRow
                          label="Previsão"
                          value={implementation.completionDateEstimate}
                        />
                      </dl>
                    </section>
                  </div>

                  <CommercialTermsPanel implementationId={implementation.id} />
                  <ContractConditionsPanel implementationId={implementation.id} />
                </div>

                <aside className="space-y-6">
                  <section>
                    <SummaryHeading>Pendências</SummaryHeading>
                    {pendingItems.length === 0 && missingPropertyFields === 0 ? (
                      <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                        Nenhuma pendência aberta.
                      </p>
                    ) : (
                      <ul className="space-y-4">
                        {missingPropertyFields > 0 && (
                          <li className="border-l-2 border-[var(--stayo-gold)] pl-3">
                            <p
                              className="text-sm font-medium"
                              style={{ color: "var(--stayo-ink)" }}
                            >
                              {missingPropertyFields}{" "}
                              {missingPropertyFields === 1
                                ? "informação ainda precisa"
                                : "informações ainda precisam"}{" "}
                              ser completada{missingPropertyFields === 1 ? "" : "s"}
                            </p>
                            <button
                              type="button"
                              onClick={() => setTab("imovel")}
                              className="mt-1 text-xs underline"
                              style={{ color: "var(--stayo-forest)" }}
                            >
                              Completar dados do imóvel
                            </button>
                          </li>
                        )}
                        {pendingItems.slice(0, 5).map((item) => (
                          <li
                            key={item.id}
                            className="border-l-2 pl-3"
                            style={{
                              borderColor: item.blocker
                                ? "var(--stayo-danger)"
                                : "var(--stayo-border)",
                            }}
                          >
                            <p
                              className="text-sm font-medium"
                              style={{ color: "var(--stayo-ink)" }}
                            >
                              {item.title}
                            </p>
                            <p className="mt-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                              {item.blocker
                                ? "Bloqueador crítico"
                                : item.mandatory
                                  ? "Obrigatório"
                                  : itemStatusLabels[item.status]}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                  <section>
                    <SummaryHeading>Atividade recente</SummaryHeading>
                    <Timeline entries={recentActivity(items).slice(0, 4)} />
                  </section>
                </aside>
              </div>

              <div className="mt-6 border-t pt-4" style={{ borderColor: "var(--stayo-border)" }}>
                <details>
                  <summary
                    className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.14em]"
                    style={{ color: "var(--stayo-ink-muted)" }}
                  >
                    Configurações operacionais
                  </summary>
                  <div className="mt-4 grid gap-4">
                    <InitialChargesPanel implementationId={implementation.id} />
                  </div>
                </details>
              </div>

              <details
                className="rounded-[var(--radius-card)] border bg-white shadow-sm"
                style={{ borderColor: "var(--stayo-border)" }}
              >
                <summary
                  className="cursor-pointer list-none px-4 py-3 text-sm font-medium"
                  style={{ color: "var(--stayo-ink)" }}
                >
                  Detalhes técnicos e Integração (IDs e Registros)
                </summary>
                <div
                  className="grid gap-3 border-t px-4 py-4 sm:grid-cols-2 text-xs"
                  style={{ borderColor: "var(--stayo-border)" }}
                >
                  <Field label="ID da Implantação" value={implementation.id} />
                  <Field label="Código" value={implementation.code} />
                  {implementation.origin && <Field label="Origem" value={implementation.origin} />}
                  {implementation.notes && (
                    <Field label="Observações técnicas" value={implementation.notes} />
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
                <div
                  className="border-t p-4"
                  style={{
                    borderColor: "var(--stayo-border)",
                    backgroundColor: "var(--stayo-surface)",
                  }}
                >
                  <CoreConversionPanel implementation={implementation} />
                </div>
              </details>
            </div>
          ) : tab === "proprietario" ? (
            <OwnerTab implementation={implementation} />
          ) : tab === "imovel" ? (
            <PropertyTab implementation={implementation} />
          ) : tab === "enxoval" ? (
            <EnxovalTab implementationId={implementation.id} mode="inventory" />
          ) : tab === "itens_faltantes" ? (
            <EnxovalTab implementationId={implementation.id} mode="missing" />
          ) : tab === "checklist" ? (
            <Checklist
              implementationId={implementation.id}
              items={itemsQuery.data ?? []}
              loading={itemsQuery.isPending}
              error={itemsQuery.isError}
              onRetry={() => void itemsQuery.refetch()}
            />
          ) : (
            <ProposalTab implementationId={implementation.id} />
          )}
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

function OwnerTab({ implementation }: { implementation: ImplementationProject }) {
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

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
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
                      item.state === "complete" ? "var(--stayo-success)" : "var(--stayo-ink-muted)",
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

      <div id="portal-owner-panel">
        <OwnerPortalPanel
          implementationId={implementation.id}
          ownerId={implementation.ownerId}
          compact
        />
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
 * Convite público (ainda sem conta/login real — depende de Supabase
 * configurado) pro proprietário preencher os próprios dados durante a
 * implantação. O token só é visível uma vez, no momento em que é gerado —
 * depois disso só existe o hash, nunca o valor puro.
 */
function OwnerPortalPanel({
  implementationId,
  ownerId,
  compact = false,
}: {
  implementationId: EntityId;
  ownerId: EntityId | null;
  compact?: boolean;
}) {
  const queryClient = useQueryClient();
  const linkQuery = useQuery(ownerOnboardingLinkQuery(implementationId));
  const submissionQuery = useQuery(ownerOnboardingSubmissionQuery(implementationId));
  const [copied, setCopied] = useState(false);
  const [freshToken, setFreshToken] = useState<string | null>(null);

  const invalidateLink = () =>
    queryClient.invalidateQueries({ queryKey: ["owner-onboarding", "link", implementationId] });

  const createLink = useMutation({
    mutationFn: () => adminApi.ownerOnboarding.createLink(implementationId, ownerId),
    onSuccess: async ({ token }) => {
      setFreshToken(token);
      await invalidateLink();
      toast.success("Novo acesso criado", { description: "O acesso anterior foi invalidado." });
    },
    onError: () => toast.error("Não foi possível gerar o acesso"),
  });

  const revokeLink = useMutation({
    mutationFn: (id: EntityId) => adminApi.ownerOnboarding.revoke(id),
    onSuccess: async () => {
      setFreshToken(null);
      await invalidateLink();
      toast.success("Acesso revogado");
    },
    onError: () => toast.error("Não foi possível revogar o acesso"),
  });

  const link = linkQuery.data;
  const status = link ? ownerOnboardingLinkStatus(link) : null;
  const url = freshToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/portal/implantacao/${freshToken}`
    : null;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Link copiado");
    } catch {
      // Clipboard indisponível (ex: contexto não seguro) — link já está visível pra copiar manualmente.
    }
  };

  return (
    <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
      <h2
        className="mb-3 text-sm"
        style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
      >
        {compact ? "Portal do Proprietário" : "Cadastro do proprietário"}
      </h2>

      {submissionQuery.data ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome completo" value={submissionQuery.data.fullName} />
          <Field label="Documento" value={maskDocument(submissionQuery.data.document)} />
          <Field label="E-mail" value={submissionQuery.data.email} />
          <Field label="Telefone" value={submissionQuery.data.phone} />
          <Field label="Chave Pix" value={maskPixKey(submissionQuery.data.pixKey)} />
          <Field label="Recebido em" value={submissionQuery.data.submittedAt} />
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
            {compact
              ? "Gerencie o acesso do proprietário ao acompanhamento da implantação."
              : "Gere um convite para o proprietário preencher os próprios dados — eles ficam aqui assim que ele enviar. O link expira em 7 dias e só fica visível para copiar logo após ser gerado."}
          </p>

          {link && status && (
            <div className="mb-3 grid gap-2 text-xs sm:grid-cols-2">
              <div className="flex flex-wrap items-center gap-2">
                <Tag label={invitationStatusLabels[status]} tone={invitationStatusTone[status]} />
                <span style={{ color: "var(--stayo-ink-muted)" }}>
                  {status === "ativo"
                    ? `Expira em ${new Date(link.expiresAt).toLocaleString("pt-BR")}`
                    : status === "revogado"
                      ? `Revogado em ${new Date(link.revokedAt!).toLocaleString("pt-BR")}`
                      : status === "expirado"
                        ? `Expirou em ${new Date(link.expiresAt).toLocaleString("pt-BR")}`
                        : `Usado em ${new Date(link.usedAt!).toLocaleString("pt-BR")}`}
                </span>
              </div>
              <span style={{ color: "var(--stayo-ink-muted)" }}>
                Último acesso:{" "}
                {link.lastAccessAt
                  ? new Date(link.lastAccessAt).toLocaleString("pt-BR")
                  : "Ainda não acessado"}
              </span>
            </div>
          )}

          {url && (
            <details className="mb-3 rounded-lg border p-3">
              <summary className="cursor-pointer text-xs font-medium">
                Mostrar link deste dispositivo
              </summary>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code
                  className="flex-1 rounded-[var(--radius-control)] border px-3 py-2 text-xs break-all"
                  style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink)" }}
                >
                  {url}
                </code>
                <button
                  type="button"
                  onClick={() => void copy()}
                  className="flex items-center gap-1.5 rounded-[var(--radius-control)] px-3 py-2 text-sm"
                  style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Copiado" : "Copiar"}
                </button>
                <button
                  type="button"
                  onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
                  className="flex items-center gap-1.5 rounded-[var(--radius-control)] border px-3 py-2 text-sm"
                >
                  <ExternalLink size={14} />
                  Abrir
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Acesse seu portal Stayo: ${url}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-[var(--radius-control)] border px-3 py-2 text-sm"
                >
                  <Share2 size={14} />
                  Enviar
                </a>
              </div>
            </details>
          )}
          {status === "ativo" && !url && (
            <p className="mb-3 rounded-lg bg-[var(--stayo-gold-soft)] p-3 text-xs text-[var(--stayo-warning)]">
              Acesso ativo. O link original não está disponível neste dispositivo.
            </p>
          )}

          {(!url || status !== "ativo") && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => createLink.mutate()}
                disabled={createLink.isPending}
                className="rounded-[var(--radius-control)] px-3 py-2 text-sm disabled:opacity-60"
                style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
              >
                <Send size={14} />
                {createLink.isPending
                  ? "Gerando..."
                  : link
                    ? "Enviar novo acesso"
                    : "Enviar acesso"}
              </button>
            </div>
          )}
          {status === "ativo" && link && (
            <div className="mt-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    disabled={revokeLink.isPending}
                    className="rounded-[var(--radius-control)] border px-3 py-2 text-sm disabled:opacity-60"
                    style={{ ...surface, color: "var(--stayo-danger)" }}
                  >
                    Revogar
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Revogar acesso do proprietário?</AlertDialogTitle>
                    <AlertDialogDescription>
                      O link deixará de funcionar imediatamente. Um novo acesso poderá ser criado
                      depois.
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
            </div>
          )}
        </>
      )}
    </div>
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

function IndicatorCards({ items, loading }: { items: ImplementationItem[]; loading: boolean }) {
  const progress = computeProgress(items);
  const readiness = computeReadiness(items);
  const pending = items.filter((item) => item.status !== "concluido").length;

  return (
    <div className="implementation-metrics">
      <Metric
        label="Progresso"
        value={loading ? "—" : `${progress.percent}%`}
        detail={`${progress.done} de ${progress.total} concluídos`}
      />
      <Metric
        label="Prontidão"
        value={loading ? "—" : readinessLabels[readiness.state]}
        detail={`${readiness.pendingBlockers} bloqueador(es)`}
        color={loading ? undefined : readinessColors[readiness.state]}
      />
      <Metric
        label="Pendências"
        value={loading ? "—" : String(pending).padStart(2, "0")}
        detail={`${readiness.pendingMandatory} obrigatório(s)`}
        className="col-span-2 sm:col-span-1"
      />
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  color,
  className = "",
}: {
  label: string;
  value: string;
  detail: string;
  color?: string | undefined;
  className?: string;
}) {
  return (
    <div className={`implementation-metric ${className}`}>
      <p
        className="text-[10px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: "var(--stayo-ink-muted)" }}
      >
        {label}
      </p>
      <p
        className="mt-1 text-lg font-semibold sm:text-xl"
        style={{ color: color ?? "var(--stayo-forest)", fontFamily: "var(--stayo-font-display)" }}
      >
        {value}
      </p>
      <p className="mt-1 text-[11px]" style={{ color: "var(--stayo-ink-muted)" }}>
        {detail}
      </p>
    </div>
  );
}

function PropertyTab({ implementation }: { implementation: ImplementationProject }) {
  const queryClient = useQueryClient();
  const detailsQ = useQuery({
    queryKey: ["implementation-property-details", implementation.id],
    queryFn: () => getPropertyDetails(implementation.id),
  });
  const timelineQ = useQuery({
    queryKey: ["implementation-timeline", implementation.id],
    queryFn: () => listPortalTimeline(implementation.id),
  });
  const inspectionsQ = useQuery({
    queryKey: ["implementation-inspections", implementation.id],
    queryFn: () => listPortalInspections(implementation.id),
  });
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [postalCode, setPostalCode] = useState("");
  const [addressDraft, setAddressDraft] = useState(implementation.address ?? "");
  const [cityDraft, setCityDraft] = useState(implementation.city ?? "");
  const [notesDraft, setNotesDraft] = useState(implementation.notes ?? "");
  const [addressLookupMessage, setAddressLookupMessage] = useState("");
  const [accessType, setAccessType] = useState<PropertyDetailsInput["accessType"]>(null);
  const [accessNotes, setAccessNotes] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [wifiNetwork, setWifiNetwork] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [timelineTitle, setTimelineTitle] = useState("");
  const [timelineDescription, setTimelineDescription] = useState("");
  const [inspectionDate, setInspectionDate] = useState("");
  const [inspectionNotes, setInspectionNotes] = useState("");

  useEffect(() => {
    if (!detailsQ.data) return;
    setAccessType(detailsQ.data.accessType);
    setAccessNotes(detailsQ.data.accessNotes ?? "");
    setAccessCode(detailsQ.data.accessCode ?? "");
    setWifiNetwork(detailsQ.data.wifiNetwork ?? "");
    setWifiPassword(detailsQ.data.wifiPassword ?? "");
  }, [detailsQ.data]);

  const saveSharedDetails = useMutation({
    mutationFn: () =>
      savePropertyDetails(implementation.id, {
        postalCode: detailsQ.data?.postalCode ?? implementation.postalCode,
        street: detailsQ.data?.street ?? implementation.address,
        number: detailsQ.data?.number ?? null,
        complement: detailsQ.data?.complement ?? null,
        district: detailsQ.data?.district ?? null,
        city: detailsQ.data?.city ?? implementation.city,
        state: detailsQ.data?.state ?? null,
        propertyType: detailsQ.data?.propertyType ?? implementation.propertyType,
        bedrooms: detailsQ.data?.bedrooms ?? implementation.bedrooms,
        suites: detailsQ.data?.suites ?? null,
        bathrooms: detailsQ.data?.bathrooms ?? null,
        parkingSpots: detailsQ.data?.parkingSpots ?? null,
        accessType,
        accessNotes: accessNotes || null,
        accessCode: accessCode || null,
        wifiNetwork: wifiNetwork || null,
        wifiPassword: wifiPassword || null,
        notes: detailsQ.data?.notes ?? null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["implementation-property-details", implementation.id],
      });
      toast.success("Acesso e Wi-Fi atualizados");
    },
  });
  const publishUpdate = useMutation({
    mutationFn: () =>
      createTimelineUpdate({
        implementationId: implementation.id,
        title: timelineTitle,
        description: timelineDescription,
        kind: "update",
        ownerVisible: true,
      }),
    onSuccess: async () => {
      setTimelineTitle("");
      setTimelineDescription("");
      await queryClient.invalidateQueries({
        queryKey: ["implementation-timeline", implementation.id],
      });
      toast.success("Atualização publicada no portal");
    },
  });
  const scheduleInspection = useMutation({
    mutationFn: () =>
      createInspection({
        implementationId: implementation.id,
        type: "implantacao",
        scheduledFor: inspectionDate ? new Date(inspectionDate).toISOString() : null,
        publicNotes: inspectionNotes,
        ownerVisible: true,
      }),
    onSuccess: async () => {
      setInspectionDate("");
      setInspectionNotes("");
      await queryClient.invalidateQueries({
        queryKey: ["implementation-inspections", implementation.id],
      });
      toast.success("Vistoria adicionada ao portal");
    },
  });

  const updateImplementation = useMutation({
    mutationFn: (input: {
      address?: string | null;
      city?: string | null;
      postalCode?: string | null;
      notes?: string | null;
    }) => coreApi.implementations.update(implementation.id, input),
    onSuccess: async () => {
      setEditingSection(null);
      await queryClient.invalidateQueries({ queryKey: ["implementations", implementation.id] });
      await queryClient.invalidateQueries({ queryKey: ["implementations"] });
    },
  });

  const filledFields = [
    implementation.nickname,
    implementation.condominiumName,
    implementation.unit,
    implementation.address,
    implementation.city,
    implementation.propertyType,
    implementation.bedrooms,
    implementation.capacity,
  ].filter((value) => value !== null && value !== undefined && value !== "").length;
  const totalFields = 8;
  const completionPercent = Math.round((filledFields / totalFields) * 100);

  async function searchPostalCode() {
    const normalized = postalCode.replace(/\\D/g, "");
    if (normalized.length !== 8) {
      setAddressLookupMessage("Informe um CEP válido com 8 números.");
      return;
    }

    setAddressLookupMessage("Buscando endereço...");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${normalized}/json/`);
      const data = (await response.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };

      if (!response.ok || data.erro) {
        setAddressLookupMessage("CEP não encontrado.");
        return;
      }

      const addressParts = [data.logradouro, data.bairro, data.localidade, data.uf].filter(Boolean);
      setAddressDraft(addressParts.join(", "));
      setCityDraft(data.localidade ?? "");
      setAddressLookupMessage("Endereço encontrado. Revise e salve a seção.");
    } catch {
      setAddressLookupMessage("Não foi possível consultar o CEP agora.");
    }
  }

  function Section({
    id,
    title,
    description,
    children,
  }: {
    id: string;
    title: string;
    description?: string;
    children: React.ReactNode;
  }) {
    const isEditing = editingSection === id;
    return (
      <details
        open={isEditing || undefined}
        className="group overflow-hidden rounded-[var(--radius-card)] border bg-white shadow-sm"
        style={{ borderColor: "var(--stayo-border)" }}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--stayo-ink)" }}>
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                {description}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(event) => {
              event.preventDefault();
              setEditingSection(isEditing ? null : id);
            }}
            className="shrink-0"
          >
            <Pencil />
            {isEditing ? "Fechar edição" : "Editar seção"}
          </Button>
        </summary>
        <div className="border-t px-4 py-4" style={{ borderColor: "var(--stayo-border)" }}>
          {children}
        </div>
      </details>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className="relative overflow-hidden rounded-[var(--radius-card)] border shadow-sm"
        style={{ borderColor: "var(--stayo-border)" }}
      >
        {implementation.coverImage ? (
          <img
            src={implementation.coverImage}
            alt={`Capa do imóvel ${implementation.nickname ?? implementation.code}`}
            className="h-48 w-full object-cover sm:h-60"
          />
        ) : (
          <div className="flex h-48 items-end bg-[linear-gradient(135deg,var(--stayo-forest-strong),var(--stayo-forest),var(--stayo-gold))] p-5 sm:h-60">
            <span className="text-sm text-[var(--stayo-on-dark-muted)]">
              Imagem institucional · nenhuma capa cadastrada
            </span>
          </div>
        )}
        <div className="flex flex-col gap-3 bg-white p-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p
              className="text-[11px] font-medium uppercase tracking-[0.14em]"
              style={{ color: "var(--stayo-ink-muted)" }}
            >
              Imóvel
            </p>
            <h1 className="mt-1 text-xl font-semibold" style={{ color: "var(--stayo-ink)" }}>
              {implementation.nickname || "Imóvel sem apelido"}
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
              {[implementation.condominiumName, implementation.unit].filter(Boolean).join(" · ") ||
                "Condomínio e unidade não informados"}
            </p>
          </div>
          <div className="min-w-44 rounded-[var(--radius-control)] bg-[var(--stayo-bg)] p-3">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span style={{ color: "var(--stayo-ink-muted)" }}>Preenchimento</span>
              <strong style={{ color: "var(--stayo-forest)" }}>{completionPercent}%</strong>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full"
              style={{ backgroundColor: "var(--stayo-border)" }}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${completionPercent}%`, backgroundColor: "var(--stayo-forest)" }}
              />
            </div>
            <p className="mt-1.5 text-[11px]" style={{ color: "var(--stayo-ink-muted)" }}>
              {filledFields} de {totalFields} campos principais
            </p>
          </div>
        </div>
      </div>

      <Section
        id="identificacao"
        title="Identificação e endereço"
        description="Dados básicos do imóvel e localização"
      >
        {editingSection === "identificacao" ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Apelido" value={implementation.nickname || "Não informado"} />
              <Field label="Condomínio" value={implementation.condominiumName || "Não informado"} />
              <Field label="Unidade" value={implementation.unit || "Não informado"} />
              <Field label="Cidade" value={implementation.city || "Não informado"} />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label
                className="flex-1 text-xs font-medium"
                style={{ color: "var(--stayo-ink-muted)" }}
              >
                Buscar endereço por CEP
                <input
                  value={postalCode}
                  onChange={(event) =>
                    setPostalCode(
                      event.target.value
                        .replace(/\D/g, "")
                        .slice(0, 8)
                        .replace(/^(\d{5})(\d)/, "$1-$2"),
                    )
                  }
                  inputMode="numeric"
                  placeholder="00000-000"
                  className="mt-1 w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink)" }}
                />
              </label>
              <button
                type="button"
                onClick={() => void searchPostalCode()}
                className="rounded-[var(--radius-control)] px-3 py-2 text-sm font-medium"
                style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
              >
                Buscar CEP
              </button>
            </div>
            {addressLookupMessage && (
              <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                {addressLookupMessage}
              </p>
            )}
            <label
              className="block text-xs font-medium"
              style={{ color: "var(--stayo-ink-muted)" }}
            >
              Endereço
              <input
                value={addressDraft}
                onChange={(event) => setAddressDraft(event.target.value)}
                className="mt-1 w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink)" }}
              />
            </label>
            <label
              className="block text-xs font-medium"
              style={{ color: "var(--stayo-ink-muted)" }}
            >
              Cidade
              <input
                value={cityDraft}
                onChange={(event) => setCityDraft(event.target.value)}
                className="mt-1 w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink)" }}
              />
            </label>
            <Button
              type="button"
              disabled={updateImplementation.isPending}
              onClick={() =>
                updateImplementation.mutate({
                  address: addressDraft,
                  city: cityDraft,
                  postalCode: postalCode || implementation.postalCode,
                })
              }
            >
              {updateImplementation.isPending ? "Salvando..." : "Salvar seção"}
            </Button>
          </div>
        ) : (
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Apelido" value={implementation.nickname || "Não informado"} />
            <Field label="Condomínio" value={implementation.condominiumName || "Não informado"} />
            <Field label="Unidade" value={implementation.unit || "Não informado"} />
            <Field label="Endereço" value={implementation.address || "Não informado"} />
            <Field label="Cidade" value={implementation.city || "Não informado"} />
          </div>
        )}
      </Section>

      <Section
        id="composicao"
        title="Composição"
        description="Características principais da acomodação"
      >
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
          <Field label="Tipo de imóvel" value={implementation.propertyType || "Não informado"} />
          <Field label="Quartos" value={implementation.bedrooms ?? "Não informado"} />
          <Field label="Capacidade" value={implementation.capacity ?? "Não informado"} />
        </div>
      </Section>

      <Section
        id="ambientes"
        title="Ambientes e camas"
        description="Organização dos ambientes e lugares de dormir"
      >
        <div
          className="rounded-[var(--radius-control)] border border-dashed bg-[var(--stayo-bg)] p-4"
          style={{ borderColor: "var(--stayo-border)" }}
        >
          <p className="text-sm font-medium" style={{ color: "var(--stayo-ink)" }}>
            {implementation.bedrooms ?? "Não informado"} quarto(s) cadastrado(s)
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
            Detalhamento de ambientes, camas e capacidades por cômodo ainda não informado nesta
            implantação.
          </p>
        </div>
      </Section>

      <Section
        id="acessos"
        title="Acessos e Wi-Fi"
        description="Ficha compartilhada com o proprietário"
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-[var(--stayo-ink-muted)]">
              Forma de acesso
              <select
                value={accessType ?? ""}
                onChange={(event) =>
                  setAccessType((event.target.value || null) as PropertyDetailsInput["accessType"])
                }
                className="mt-1 w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm text-[var(--stayo-ink)]"
              >
                <option value="">Selecione</option>
                <option value="key">Chave</option>
                <option value="lock">Fechadura digital</option>
                <option value="concierge">Portaria</option>
                <option value="other">Outro</option>
              </select>
            </label>
            <label className="text-xs font-medium text-[var(--stayo-ink-muted)]">
              Orientações
              <input
                value={accessNotes}
                onChange={(event) => setAccessNotes(event.target.value)}
                className="mt-1 w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm text-[var(--stayo-ink)]"
              />
            </label>
            <label className="text-xs font-medium text-[var(--stayo-ink-muted)]">
              Senha da fechadura
              <input
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value)}
                className="mt-1 w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm text-[var(--stayo-ink)]"
              />
            </label>
            <label className="text-xs font-medium text-[var(--stayo-ink-muted)]">
              Rede Wi-Fi
              <input
                value={wifiNetwork}
                onChange={(event) => setWifiNetwork(event.target.value)}
                className="mt-1 w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm text-[var(--stayo-ink)]"
              />
            </label>
            <label className="text-xs font-medium text-[var(--stayo-ink-muted)]">
              Senha do Wi-Fi
              <input
                value={wifiPassword}
                onChange={(event) => setWifiPassword(event.target.value)}
                className="mt-1 w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm text-[var(--stayo-ink)]"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--stayo-gold)] bg-[var(--stayo-gold-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--stayo-warning)]">
              <LockKeyhole className="size-3" /> Protegido · compartilhado com o proprietário
            </span>
            <Button
              size="sm"
              onClick={() => saveSharedDetails.mutate()}
              disabled={saveSharedDetails.isPending}
            >
              {saveSharedDetails.isPending ? "Salvando…" : "Salvar acesso"}
            </Button>
          </div>
        </div>
      </Section>

      <Section
        id="timeline-publica"
        title="Linha do tempo pública"
        description="Atualizações visíveis no Portal do Proprietário"
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_1.5fr_auto]">
          <input
            value={timelineTitle}
            onChange={(event) => setTimelineTitle(event.target.value)}
            placeholder="Título da atualização"
            className="rounded-[var(--radius-control)] border px-3 py-2 text-sm"
          />
          <input
            value={timelineDescription}
            onChange={(event) => setTimelineDescription(event.target.value)}
            placeholder="Mensagem para o proprietário"
            className="rounded-[var(--radius-control)] border px-3 py-2 text-sm"
          />
          <Button
            size="sm"
            onClick={() => publishUpdate.mutate()}
            disabled={!timelineTitle.trim() || publishUpdate.isPending}
          >
            <Megaphone /> Publicar
          </Button>
        </div>
        <div className="mt-4 space-y-2">
          {(timelineQ.data ?? []).slice(0, 5).map((event) => (
            <div
              key={event.id}
              className="flex items-start justify-between gap-3 border-t border-[var(--stayo-border)] pt-3 text-sm"
            >
              <div>
                <strong>{event.title}</strong>
                {event.description && (
                  <p className="text-xs text-[var(--stayo-ink-muted)]">{event.description}</p>
                )}
              </div>
              <span className="shrink-0 text-xs text-[var(--stayo-ink-muted)]">
                {new Intl.DateTimeFormat("pt-BR").format(new Date(event.date))}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="vistorias"
        title="Vistorias"
        description="Agendamento e resumo liberados no portal"
      >
        <div className="grid gap-3 sm:grid-cols-[13rem_1fr_auto]">
          <input
            type="datetime-local"
            value={inspectionDate}
            onChange={(event) => setInspectionDate(event.target.value)}
            className="rounded-[var(--radius-control)] border px-3 py-2 text-sm"
          />
          <input
            value={inspectionNotes}
            onChange={(event) => setInspectionNotes(event.target.value)}
            placeholder="Resumo para o proprietário"
            className="rounded-[var(--radius-control)] border px-3 py-2 text-sm"
          />
          <Button
            size="sm"
            onClick={() => scheduleInspection.mutate()}
            disabled={!inspectionDate || scheduleInspection.isPending}
          >
            <CalendarPlus /> Agendar
          </Button>
        </div>
        <div className="mt-4 space-y-2">
          {(inspectionsQ.data ?? []).map((inspection) => (
            <div
              key={inspection.id}
              className="flex items-center justify-between border-t border-[var(--stayo-border)] pt-3 text-sm"
            >
              <span>{inspection.publicNotes || "Vistoria do imóvel"}</span>
              <strong>{inspection.status === "completed" ? "Concluída" : "Agendada"}</strong>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="observacoes"
        title="Observações internas"
        description="Notas de uso exclusivo da operação"
      >
        {editingSection === "observacoes" ? (
          <div className="space-y-3">
            <textarea
              value={notesDraft}
              onChange={(event) => setNotesDraft(event.target.value)}
              rows={5}
              placeholder="Adicione observações internas sobre o imóvel"
              className="w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink)" }}
            />
            <Button
              type="button"
              disabled={updateImplementation.isPending}
              onClick={() => updateImplementation.mutate({ notes: notesDraft })}
            >
              {updateImplementation.isPending ? "Salvando..." : "Salvar seção"}
            </Button>
          </div>
        ) : (
          <p
            className="whitespace-pre-wrap text-sm"
            style={{ color: implementation.notes ? "var(--stayo-ink)" : "var(--stayo-ink-muted)" }}
          >
            {implementation.notes || "Nenhuma observação interna cadastrada."}
          </p>
        )}
      </Section>
    </div>
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
