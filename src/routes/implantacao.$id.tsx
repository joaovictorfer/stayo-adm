import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Check, FileDown } from "lucide-react";
import { useMemo, useState } from "react";

import {
  DetailSkeleton,
  ErrorRows,
  Field,
  NotFoundPanel,
  PageHeader,
  Panel,
} from "../components/data/ListStates";
import { AttentionPanel, attentionItems } from "../components/implantacao/AttentionPanel";
import { OwnersPanel } from "../components/implantacao/OwnersPanel";
import { PropertyPanel } from "../components/implantacao/PropertyPanel";
import { SuppliesPanel } from "../components/implantacao/SuppliesPanel";
import { ProposalTab } from "../components/implantacao/ProposalTab";
import { WorkspaceHeader } from "../components/implantacao/WorkspaceHeader";
import { OwnerPortalAccess } from "../components/implantacao/OwnerPortalAccess";
import { LinkedField } from "../components/patterns/LinkedField";
import { Timeline, type TimelineEntry } from "../components/patterns/Timeline";
import {
  adminApi,
  commercialTermsQuery,
  coreApi,
  implementationItemsQuery,
  implementationQuery,
  initialChargesQuery,
  supplyItemsQuery,
} from "../lib/api/queries";
import { blockingSupplyItems } from "../types/implementation-supply";
import { generateImplementationSummaryPdf } from "../lib/pdf/implementation-pdf";
import { downloadPdfBytes } from "../lib/pdf/download";
import { coreConversionService, isCoreConversionEnabled } from "../lib/core-conversion";
import { listActiveAdminProfiles } from "../lib/auth/session";
import { formatMoney } from "../lib/format";
import {
  alternateStatuses,
  computeProgress,
  computeReadiness,
  itemStatusColor,
  itemStatusLabels,
  mainStatusFlow,
  statusLabels,
} from "../lib/implementation-status";
import { initialChargeStatusLabels } from "../lib/initial-charge-status";
import type { ChargeType, InitialChargeStatus } from "../types/admin";
import type {
  EntityId,
  ImplementationItem,
  ImplementationProject,
  ImplementationStatus,
} from "../types/core";

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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
    "resumo" | "proprietarios" | "imovel" | "enxoval" | "faltantes" | "checklist" | "proposta"
  >("resumo");
  const [portalOpen, setPortalOpen] = useState(false);
  const query = useQuery(implementationQuery(id));
  const itemsQuery = useQuery(implementationItemsQuery(id));
  const suppliesQuery = useQuery(supplyItemsQuery(id));
  const adminProfilesQuery = useQuery({
    queryKey: ["admin-profiles", "active"],
    queryFn: listActiveAdminProfiles,
  });
  const implementation = query.data;

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

  const checklistItems = itemsQuery.data ?? [];
  const progress = computeProgress(checklistItems);
  const readiness = computeReadiness(checklistItems);

  return (
    <>
      <PageHeader title="Workspace de implantação" subtitle={implementation?.code}>
        <Link
          to="/implantacao"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft size={15} /> Voltar
        </Link>
      </PageHeader>

      {query.isPending ? (
        <DetailSkeleton />
      ) : query.isError ? (
        <ErrorRows onRetry={() => void query.refetch()} />
      ) : !implementation ? (
        <NotFoundPanel message="Implantação não encontrada" />
      ) : (
        <div className="flex flex-col gap-4">
          <WorkspaceHeader
            implementation={implementation}
            progressPercent={progress.percent}
            progressDone={progress.done}
            progressTotal={progress.total}
            readiness={readiness}
            pendingCount={
              attentionItems(checklistItems).length +
              blockingSupplyItems(suppliesQuery.data ?? []).length
            }
            onOpenProposal={() => setTab("proposta")}
            onOpenPortal={() => setPortalOpen(true)}
          />
          <OwnerPortalAccess
            open={portalOpen}
            onClose={() => setPortalOpen(false)}
            implementation={implementation}
            checklist={checklistItems}
          />

          <AttentionPanel items={checklistItems} />

          <div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
              onClick={async () => {
                const bytes = await generateImplementationSummaryPdf({
                  implementation,
                  checklist: checklistItems,
                  supplies: suppliesQuery.data ?? [],
                  progressPercent: progress.percent,
                  readiness,
                  blockers: [
                    ...attentionItems(checklistItems).map((item) => item.title),
                    ...blockingSupplyItems(suppliesQuery.data ?? []).map(
                      (item) => `Enxoval/faltante: ${item.name}`,
                    ),
                  ],
                  statusLabel: statusLabels[implementation.status],
                  responsibleName:
                    adminProfilesQuery.data?.find(
                      (profile) => profile.id === implementation.responsibleUserId,
                    )?.fullName ?? null,
                });
                downloadPdfBytes(bytes, `resumo-${implementation.code}.pdf`);
              }}
            >
              <FileDown size={15} /> Gerar PDF do resumo
            </button>
          </div>

          <StatusStepper
            status={implementation.status}
            onChange={(status) => changeStatus.mutate(status)}
            pending={changeStatus.isPending}
          />

          <IndicatorCards items={itemsQuery.data ?? []} loading={itemsQuery.isPending} />


          <div className="flex gap-1 overflow-x-auto rounded-[var(--radius-card)] border border-border bg-card p-1 shadow-[var(--shadow-card)]">
            {(
              [
                ["resumo", "Resumo"],
                ["proprietarios", "Proprietários"],
                ["imovel", "Imóvel"],
                ["enxoval", "Enxoval"],
                ["faltantes", "Itens faltantes"],
                ["checklist", "Checklist"],
                ["proposta", "Proposta"],
              ] as const
            ).map(([t, label]) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${tab === t ? "bg-brand text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "resumo" ? (
            <div className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="ID" value={implementation.id} />
                <Field label="Código" value={implementation.code} />
                <Field label="Status" value={statusLabels[implementation.status]} />
                <Field
                  label="Proprietário"
                  value={
                    implementation.ownerId ? (
                      <LinkedField
                        to="/proprietarios/$id"
                        id={implementation.ownerId}
                        label={implementation.ownerName}
                      />
                    ) : (
                      implementation.ownerName
                    )
                  }
                />
                <Field label="Telefone" value={implementation.ownerPhone} />
                <Field label="Apelido do imóvel" value={implementation.nickname} />
                <Field label="Condomínio" value={implementation.condominiumName} />
                <Field label="Unidade" value={implementation.unit} />
                <Field label="Endereço" value={implementation.address} />
                <Field label="CEP" value={implementation.postalCode} />
                <Field label="Cidade" value={implementation.city} />
                <Field label="Tipo do imóvel" value={implementation.propertyType} />
                <Field label="Quartos" value={implementation.bedrooms} />
                <Field label="Capacidade" value={implementation.capacity} />
                <Field label="Responsável" value={implementation.responsibleUserId} />
                <Field label="Previsão de início" value={implementation.startDateEstimate} />
                <Field
                  label="Previsão de conclusão"
                  value={implementation.completionDateEstimate}
                />
                <Field label="Origem" value={implementation.origin} />
                <Field label="Observação" value={implementation.notes} />
                <Field label="Imóvel no Core" value={implementation.corePropertyId} />
                <Field label="Proprietário no Core" value={implementation.coreOwnerId} />
                <Field label="Criada em" value={implementation.createdAt} />
                <Field label="Atualizada em" value={implementation.updatedAt} />
              </div>

              <CommercialTermsPanel implementationId={implementation.id} />

              <InitialChargesPanel implementationId={implementation.id} />

              <CoreConversionPanel implementation={implementation} />

              <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
                <h2
                  className="mb-3 text-sm"
                  style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
                >
                  Atividade recente
                </h2>
                <Timeline entries={recentActivity(itemsQuery.data ?? [])} />
              </div>
            </div>
          ) : tab === "proprietarios" ? (
            <OwnersPanel implementationId={implementation.id} />
          ) : tab === "imovel" ? (
            <PropertyPanel implementationId={implementation.id} />
          ) : tab === "enxoval" ? (
            <SuppliesPanel implementationId={implementation.id} module="enxoval" />
          ) : tab === "faltantes" ? (
            <SuppliesPanel implementationId={implementation.id} module="faltante" />
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
    </>
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

  return (
    <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
      <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--stayo-ink-muted)" }}>
            Status da implantação
          </p>
          <div className="mt-2 hidden flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground sm:flex" aria-label="Legenda da timeline">
            <TimelineLegend color="var(--stayo-success)" label="Concluído" />
            <TimelineLegend color="var(--stayo-forest)" label="Atual" />
            <TimelineLegend color="var(--stayo-border)" label="Futuro" />
            <TimelineLegend color="var(--stayo-danger)" label="Bloqueado" />
          </div>
        </div>
        <select
          value={status}
          onChange={(e) => onChange(e.target.value as ImplementationStatus)}
          disabled={pending}
          className="rounded-[var(--radius-control)] border px-2 py-1 text-xs outline-none disabled:opacity-60"
          style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink)" }}
        >
          {[...mainStatusFlow, ...alternateStatuses].map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </select>
      </div>
      <ol className="grid min-w-0 grid-cols-1 gap-0 sm:grid-cols-9" aria-label="Etapas da implantação">
        {mainStatusFlow.map((s, index) => {
          const done = currentIndex > index;
          const current = currentIndex === index;
          const future = !done && !current;
          return (
            <li
              key={s}
              className="relative grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] gap-3 pb-5 last:pb-0 sm:flex sm:flex-col sm:items-center sm:gap-2 sm:px-1 sm:pb-0 sm:text-center"
              aria-current={current ? "step" : undefined}
            >
              {index < mainStatusFlow.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute left-[0.9375rem] top-8 h-[calc(100%-2rem)] w-0.5 sm:left-1/2 sm:top-[0.9375rem] sm:h-0.5 sm:w-full"
                  style={{ backgroundColor: done ? "var(--stayo-success)" : "var(--stayo-border)" }}
                />
              )}
              <span
                className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-xs font-semibold"
                style={{
                  borderColor: done
                    ? "var(--stayo-success)"
                    : current
                      ? "var(--stayo-forest)"
                      : "var(--stayo-border)",
                  backgroundColor: done
                    ? "var(--stayo-success)"
                    : current
                      ? "var(--stayo-forest-soft)"
                      : "var(--stayo-surface)",
                  color: done
                    ? "var(--stayo-surface)"
                    : current
                      ? "var(--stayo-forest)"
                      : "var(--stayo-ink-muted)",
                }}
              >
                {done ? <Check aria-hidden="true" size={15} strokeWidth={2.5} /> : index + 1}
              </span>
              <span className="min-w-0 pt-1 sm:pt-0">
                <span
                  className="block text-xs leading-4"
                  style={{
                    color: current ? "var(--stayo-ink)" : "var(--stayo-ink-muted)",
                    fontWeight: current ? 700 : done ? 600 : 400,
                  }}
                >
                  {statusLabels[s]}
                </span>
                <span className="mt-0.5 block text-[10px] font-medium uppercase sm:hidden" style={{ color: current ? "var(--stayo-forest)" : "var(--stayo-ink-muted)" }}>
                  {done ? "Concluído" : current ? "Atual" : future ? "Futuro" : ""}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      {isAlternate && (
        <p
          className="mt-4 flex items-center gap-2 rounded-[var(--radius-control)] px-3 py-2 text-xs font-semibold"
          style={{ backgroundColor: "var(--stayo-danger-soft)", color: "var(--stayo-danger)" }}
        >
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: "var(--stayo-danger)" }} />
          Fluxo bloqueado: {statusLabels[status]}
        </p>
      )}
    </div>
  );
}

function TimelineLegend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function IndicatorCards({ items, loading }: { items: ImplementationItem[]; loading: boolean }) {
  const progress = computeProgress(items);
  const readiness = computeReadiness(items);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
        <p className="text-xs uppercase tracking-wide" style={{ color: "var(--stayo-ink-muted)" }}>
          Progresso do checklist
        </p>
        <p
          className="mt-1 text-3xl"
          style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
        >
          {loading ? "—" : `${progress.percent}%`}
        </p>
        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: "var(--stayo-border)" }}
        >
          <div
            className="h-full rounded-full"
            style={{ width: `${progress.percent}%`, backgroundColor: "var(--stayo-forest)" }}
          />
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
          {progress.done} de {progress.total} itens concluídos
        </p>
      </div>

      <div
        className="rounded-[var(--radius-card)] border p-4"
        style={{
          ...surface,
          borderColor:
            readiness.status === "apta"
              ? "var(--stayo-success)"
              : readiness.status === "bloqueada"
                ? "var(--stayo-danger)"
                : "var(--stayo-gold)",
        }}
      >
        <p className="text-xs uppercase tracking-wide" style={{ color: "var(--stayo-ink-muted)" }}>
          Prontidão operacional
        </p>
        <p
          className="mt-1 text-3xl"
          style={{
            fontFamily: "var(--stayo-font-display)",
            color: loading
              ? "var(--stayo-ink-muted)"
              : readiness.status === "apta"
                ? "var(--stayo-success)"
                : readiness.status === "bloqueada"
                  ? "var(--stayo-danger)"
                  : "var(--stayo-warning)",
          }}
        >
          {loading ? "—" : readiness.label}
        </p>
        <p className="mt-3 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
          {readiness.status === "nao_avaliada"
            ? "Checklist/requisitos de prontidão ainda não configurados"
            : `${readiness.pendingBlockers} bloqueador(es) em aberto · ${readiness.pendingMandatory} obrigatório(s) em aberto`}
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
          Não é a mesma coisa que progresso: um único bloqueador pendente impede a operação.
        </p>
      </div>
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

  return (
    <div className="flex flex-col gap-4">
      {[...groups.entries()].map(([phase, categories]) => (
        <div key={phase} className="rounded-[var(--radius-card)] border" style={surface}>
          <h2
            className="border-b px-4 py-3 text-sm"
            style={{
              borderColor: "var(--stayo-border)",
              fontFamily: "var(--stayo-font-display)",
              color: "var(--stayo-ink)",
            }}
          >
            {phase}
          </h2>
          {[...categories.entries()].map(([category, list]) => (
            <div key={category}>
              <p
                className="px-4 pt-3 text-xs uppercase tracking-wide"
                style={{ color: "var(--stayo-ink-muted)" }}
              >
                {category}
              </p>
              <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
                {list.map((item) => (
                  <li key={item.id} className="flex flex-col gap-2 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm" style={{ color: "var(--stayo-ink)" }}>
                        {item.title}
                      </span>
                      {item.mandatory && <Tag label="Obrigatório" />}
                      {item.blocker && <Tag label="Bloqueador" tone="danger" />}
                      {item.ownerVisible && <Tag label="Visível ao proprietário" tone="gold" />}
                      <select
                        value={item.status}
                        onChange={(e) =>
                          updateStatus.mutate({
                            itemId: item.id,
                            status: e.target.value as ImplementationItem["status"],
                          })
                        }
                        disabled={updateStatus.isPending}
                        className="ml-auto rounded-[var(--radius-control)] border px-2 py-1 text-xs outline-none disabled:opacity-60"
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
                    </div>
                    {item.status === "pulado" && (item.mandatory || item.blocker) && (
                      <ReadinessOverrideRow item={item} onConfirm={override.mutate} />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}
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
