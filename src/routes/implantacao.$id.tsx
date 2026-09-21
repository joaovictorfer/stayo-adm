import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Check, Copy } from "lucide-react";
import { useMemo, useState } from "react";

import {
  DetailSkeleton,
  ErrorRows,
  Field,
  NotFoundPanel,
  PageHeader,
  Panel,
} from "../components/data/ListStates";
import { ProposalTab } from "../components/implantacao/ProposalTab";
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
import type { ChargeType, InitialChargeStatus } from "../types/admin";
import type {
  EntityId,
  ImplementationItem,
  ImplementationProject,
  ImplementationStatus,
} from "../types/core";
import {
  type OwnerOnboardingLinkStatus,
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
  const [tab, setTab] = useState<"resumo" | "checklist" | "proposta">("resumo");
  const query = useQuery(implementationQuery(id));
  const itemsQuery = useQuery(implementationItemsQuery(id));
  const implementation = query.data;
  const nextItem = (itemsQuery.data ?? []).find((item) => item.status !== "concluido");

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
    <>
      <PageHeader title={implementation?.code ?? "Implantação"}>
        <Link
          to="/implantacao"
          className="text-sm underline"
          style={{ color: "var(--stayo-ink-muted)" }}
        >
          Voltar para implantações
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
          <div className="relative overflow-hidden rounded-[var(--radius-card)] border bg-white shadow-sm" style={{ borderColor: "var(--stayo-border)" }}>
            <div className="absolute inset-0 bg-gradient-to-r from-[rgba(11,49,80,0.92)] via-[rgba(11,49,80,0.72)] to-transparent" />
            {implementation.coverImage ? (
              <img
                src={implementation.coverImage}
                alt={`Capa do imóvel ${implementation.nickname ?? implementation.code}`}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-[linear-gradient(135deg,#0B3150_0%,#123F68_58%,#d6b36a_160%)]" />
            )}
            <div className="relative flex min-h-[148px] flex-col justify-end gap-3 p-5 text-white sm:min-h-[168px] sm:p-6">
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/75">
                <span className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1">Implantação</span>
                <span>{implementation.code}</span>
              </div>
              <div>
                <h1 className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
                  {implementation.nickname || implementation.condominiumName || "Novo imóvel"}
                </h1>
                <p className="mt-1 text-sm text-white/80">
                  {[implementation.condominiumName, implementation.unit, implementation.city]
                    .filter(Boolean)
                    .join(" · ") || "Detalhes da implantação"}
                </p>
              </div>
            </div>
          </div>

          <StatusStepper
            status={implementation.status}
            onChange={(status) => changeStatus.mutate(status)}
            pending={changeStatus.isPending}
          />

          <IndicatorCards items={itemsQuery.data ?? []} loading={itemsQuery.isPending} />

          <div className="flex gap-2 border-b" style={{ borderColor: "var(--stayo-border)" }}>
            {(["resumo", "checklist", "proposta"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className="px-3 py-2 text-sm"
                style={{
                  color: tab === t ? "var(--stayo-ink)" : "var(--stayo-ink-muted)",
                  borderBottom:
                    tab === t ? "2px solid var(--stayo-forest)" : "2px solid transparent",
                }}
              >
                {t === "resumo" ? "Resumo" : t === "checklist" ? "Checklist" : "Proposta"}
              </button>
            ))}
          </div>

          {tab === "resumo" ? (
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-[var(--radius-card)] border bg-white p-4 shadow-sm" style={{ borderColor: "var(--stayo-border)" }}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color: "var(--stayo-ink-muted)" }}>
                        Próxima ação
                      </p>
                      <h2 className="mt-1 text-base font-semibold" style={{ color: "var(--stayo-ink)" }}>
                        {nextItem?.title ?? "Tudo em dia por enquanto"}
                      </h2>
                    </div>
                    {nextItem && <Tag label="Pendente" tone="gold" />}
                  </div>
                  <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                    {nextItem?.description || "Revise o progresso e acompanhe as próximas etapas da implantação."}
                  </p>
                </div>

                <div className="rounded-[var(--radius-card)] border bg-white p-4 shadow-sm" style={{ borderColor: "var(--stayo-border)" }}>
                  <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color: "var(--stayo-ink-muted)" }}>
                    Proprietário
                  </p>
                  <div className="space-y-2">
                    {implementation.ownerId ? (
                      <LinkedField
                        to="/proprietarios/$id"
                        id={implementation.ownerId}
                        label={implementation.ownerName}
                      />
                    ) : (
                      <p className="text-sm font-medium" style={{ color: "var(--stayo-ink)" }}>{implementation.ownerName || "Não informado"}</p>
                    )}
                    {implementation.ownerPhone && (
                      <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>{implementation.ownerPhone}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-[var(--radius-card)] border bg-white p-4 shadow-sm" style={{ borderColor: "var(--stayo-border)" }}>
                <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color: "var(--stayo-ink-muted)" }}>
                  Dados principais do imóvel
                </p>
                <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                  {implementation.nickname && <Field label="Apelido" value={implementation.nickname} />}
                  {implementation.condominiumName && <Field label="Condomínio" value={implementation.condominiumName} />}
                  {implementation.unit && <Field label="Unidade" value={implementation.unit} />}
                  {implementation.address && <Field label="Endereço" value={implementation.address} />}
                  {implementation.city && <Field label="Cidade" value={implementation.city} />}
                  {implementation.propertyType && <Field label="Tipo" value={implementation.propertyType} />}
                  {implementation.bedrooms !== null && implementation.bedrooms !== undefined && <Field label="Quartos" value={implementation.bedrooms} />}
                  {implementation.capacity !== null && implementation.capacity !== undefined && <Field label="Capacidade" value={implementation.capacity} />}
                </div>
                {(() => {
                  const missing = [
                    !implementation.nickname && "Apelido",
                    !implementation.condominiumName && "Condomínio",
                    !implementation.unit && "Unidade",
                    !implementation.address && "Endereço",
                    !implementation.city && "Cidade",
                    !implementation.propertyType && "Tipo",
                    (implementation.bedrooms === null || implementation.bedrooms === undefined) && "Quartos",
                    (implementation.capacity === null || implementation.capacity === undefined) && "Capacidade",
                  ].filter(Boolean);

                  if (missing.length === 0) return null;
                  return (
                    <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--stayo-border)" }}>
                      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em]" style={{ color: "var(--stayo-ink-muted)" }}>
                        Pendentes de preenchimento
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {missing.map((field) => (
                          <span key={field as string} className="rounded-md border bg-slate-50/50 px-2.5 py-1 text-[11px] font-medium text-slate-500" style={{ borderColor: "var(--stayo-border)" }}>
                            {field}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <CommercialTermsPanel implementationId={implementation.id} />

              <OwnerPortalPanel
                implementationId={implementation.id}
                ownerId={implementation.ownerId}
              />

              <InitialChargesPanel implementationId={implementation.id} />

              <details className="rounded-[var(--radius-card)] border bg-white shadow-sm" style={{ borderColor: "var(--stayo-border)" }}>
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium" style={{ color: "var(--stayo-ink)" }}>
                  Detalhes técnicos e Integração
                </summary>
                <div className="grid gap-3 border-t px-4 py-4 sm:grid-cols-2" style={{ borderColor: "var(--stayo-border)" }}>
                  <Field label="ID" value={implementation.id} />
                  <Field label="Código" value={implementation.code} />
                  <Field label="Status" value={statusLabels[implementation.status]} />
                  {implementation.responsibleUserId && <Field label="Responsável" value={implementation.responsibleUserId} />}
                  {implementation.startDateEstimate && <Field label="Previsão de início" value={implementation.startDateEstimate} />}
                  {implementation.completionDateEstimate && <Field label="Previsão de conclusão" value={implementation.completionDateEstimate} />}
                  {implementation.origin && <Field label="Origem" value={implementation.origin} />}
                  {implementation.notes && <Field label="Observação" value={implementation.notes} />}
                  {implementation.corePropertyId && <Field label="Imóvel no Core" value={implementation.corePropertyId} />}
                  {implementation.coreOwnerId && <Field label="Proprietário no Core" value={implementation.coreOwnerId} />}
                  <Field label="Criada em" value={implementation.createdAt} />
                  <Field label="Atualizada em" value={implementation.updatedAt} />
                </div>
                <div className="border-t p-4" style={{ borderColor: "var(--stayo-border)", backgroundColor: "var(--stayo-surface)" }}>
                  <CoreConversionPanel implementation={implementation} />
                </div>
              </details>

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
}: {
  implementationId: EntityId;
  ownerId: EntityId | null;
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
    },
  });

  const revokeLink = useMutation({
    mutationFn: (id: EntityId) => adminApi.ownerOnboarding.revoke(id),
    onSuccess: async () => {
      setFreshToken(null);
      await invalidateLink();
    },
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
        Cadastro do proprietário
      </h2>

      {submissionQuery.data ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome completo" value={submissionQuery.data.fullName} />
          <Field label="Documento" value={submissionQuery.data.document} />
          <Field label="E-mail" value={submissionQuery.data.email} />
          <Field label="Telefone" value={submissionQuery.data.phone} />
          <Field label="Chave Pix" value={submissionQuery.data.pixKey} />
          <Field label="Recebido em" value={submissionQuery.data.submittedAt} />
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
            Gere um convite para o proprietário preencher os próprios dados — eles ficam aqui assim
            que ele enviar. O link expira em 7 dias e só fica visível para copiar logo após ser
            gerado.
          </p>

          {link && status && (
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
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
          )}

          {url && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
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
            </div>
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
                {createLink.isPending
                  ? "Gerando..."
                  : link
                    ? "Gerar novo convite"
                    : "Gerar convite para o proprietário"}
              </button>
            </div>
          )}
          {status === "ativo" && link && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => revokeLink.mutate(link.id)}
                disabled={revokeLink.isPending}
                className="rounded-[var(--radius-control)] border px-3 py-2 text-sm disabled:opacity-60"
                style={{ ...surface, color: "var(--stayo-danger)" }}
              >
                {revokeLink.isPending ? "Revogando..." : "Revogar"}
              </button>
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

  return (
    <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wide" style={{ color: "var(--stayo-ink-muted)" }}>
          Status da implantação
        </p>
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

      <ol className="flex flex-col md:flex-row gap-3 md:gap-1.5">
        {mainStatusFlow.map((s, index) => {
          let state: "done" | "current" | "future" | "blocked" = "future";
          
          if (isAlternate) {
            state = "blocked";
          } else if (currentIndex !== -1) {
            if (index < currentIndex) state = "done";
            else if (index === currentIndex) state = "current";
          }

          const color = 
            state === "done" ? "var(--stayo-forest)" :
            state === "current" ? "var(--stayo-forest)" :
            state === "blocked" ? "var(--stayo-danger)" :
            "var(--stayo-border)";
            
          const opacity = state === "done" ? 0.55 : state === "blocked" ? 0.4 : 1;
          const isCurrent = state === "current";

          return (
            <li key={s} className="flex md:flex-1 flex-row md:flex-col items-center md:items-start gap-3 md:gap-2 min-w-0">
              <span
                className="h-2 w-8 md:h-1.5 md:w-full shrink-0 rounded-full transition-colors"
                title={state === "blocked" ? "Bloqueado / Alternativo" : ""}
                style={{ backgroundColor: color, opacity }}
              />
              <span
                className="text-[11px] md:text-[10px] lg:text-[11px] leading-tight break-words md:pr-1"
                style={{
                  color: isCurrent ? "var(--stayo-ink)" : "var(--stayo-ink-muted)",
                  fontWeight: isCurrent ? 600 : 400,
                }}
              >
                {statusLabels[s]}
              </span>
            </li>
          );
        })}
      </ol>

      {isAlternate && (
        <p
          className="mt-5 inline-block rounded-[var(--radius-control)] px-2 py-1 text-xs"
          style={{ backgroundColor: "var(--stayo-gold-soft)", color: "var(--stayo-warning)" }}
        >
          Fora da linha principal (bloqueado): {statusLabels[status]}
        </p>
      )}
    </div>
  );
}

function IndicatorCards({ items, loading }: { items: ImplementationItem[]; loading: boolean }) {
  const progress = computeProgress(items);
  const readiness = computeReadiness(items);

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="rounded-[var(--radius-card)] border bg-white px-4 py-3 shadow-sm" style={{ borderColor: "var(--stayo-border)" }}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: "var(--stayo-ink-muted)" }}>
            Progresso
          </p>
          <p className="text-xl font-semibold" style={{ color: "var(--stayo-ink)" }}>
            {loading ? "—" : `${progress.percent}%`}
          </p>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: "var(--stayo-border)" }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${progress.percent}%`, backgroundColor: "var(--stayo-forest)" }} />
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
          {progress.done} de {progress.total} itens concluídos
        </p>
      </div>

      <div className="rounded-[var(--radius-card)] border bg-white px-4 py-3 shadow-sm" style={{ borderColor: loading ? "var(--stayo-border)" : readinessColors[readiness.state] }}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: "var(--stayo-ink-muted)" }}>
            Prontidão
          </p>
          <p className="text-base font-semibold" style={{ color: loading ? "var(--stayo-ink-muted)" : readinessColors[readiness.state] }}>
            {loading ? "—" : readinessLabels[readiness.state]}
          </p>
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
          {readiness.pendingBlockers} bloqueador(es) · {readiness.pendingMandatory} obrigatório(s) em aberto
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
