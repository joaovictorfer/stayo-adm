import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import {
  DetailSkeleton,
  ErrorRows,
  Field,
  NotFoundPanel,
  PageHeader,
  Panel,
} from "../components/data/ListStates";
import { implementationItemsQuery, implementationQuery } from "../lib/api/queries";
import {
  alternateStatuses,
  computeProgress,
  computeReadiness,
  itemStatusColor,
  itemStatusLabels,
  mainStatusFlow,
  statusLabels,
} from "../lib/implementation-status";
import type { ImplementationItem, ImplementationStatus } from "../types/core";

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
  const [tab, setTab] = useState<"resumo" | "checklist">("resumo");
  const query = useQuery(implementationQuery(id));
  const itemsQuery = useQuery(implementationItemsQuery(id));
  const implementation = query.data;

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
          <StatusStepper status={implementation.status} />

          <IndicatorCards items={itemsQuery.data ?? []} loading={itemsQuery.isPending} />

          <div className="flex gap-2 border-b" style={{ borderColor: "var(--stayo-border)" }}>
            {(["resumo", "checklist"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className="px-3 py-2 text-sm"
                style={{
                  color: tab === t ? "var(--stayo-ink)" : "var(--stayo-ink-muted)",
                  borderBottom: tab === t ? "2px solid var(--stayo-forest)" : "2px solid transparent",
                }}
              >
                {t === "resumo" ? "Resumo" : "Checklist"}
              </button>
            ))}
          </div>

          {tab === "resumo" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="ID" value={implementation.id} />
              <Field label="Código" value={implementation.code} />
              <Field label="Status" value={statusLabels[implementation.status]} />
              <Field label="Proprietário (prospect)" value={implementation.ownerProspect.name} />
              <Field label="Telefone" value={implementation.ownerProspect.phone} />
              <Field label="E-mail" value={implementation.ownerProspect.email} />
              <Field label="Condomínio" value={implementation.condominiumName} />
              <Field label="Unidade" value={implementation.unit} />
              <Field label="Cidade" value={implementation.city} />
              <Field label="Responsável" value={implementation.responsibleUserId} />
              <Field label="Previsão de início" value={implementation.startDateEstimate} />
              <Field label="Previsão de conclusão" value={implementation.completionDateEstimate} />
              <Field label="Origem" value={implementation.origin} />
              <Field label="Observação" value={implementation.notes} />
              <Field label="Imóvel no Core" value={implementation.corePropertyId} />
              <Field label="Proprietário no Core" value={implementation.coreOwnerId} />
              <Field label="Criada em" value={implementation.createdAt} />
              <Field label="Atualizada em" value={implementation.updatedAt} />
            </div>
          ) : (
            <Checklist
              items={itemsQuery.data ?? []}
              loading={itemsQuery.isPending}
              error={itemsQuery.isError}
              onRetry={() => void itemsQuery.refetch()}
            />
          )}
        </div>
      )}
    </>
  );
}

function StatusStepper({ status }: { status: ImplementationStatus }) {
  const currentIndex = mainStatusFlow.indexOf(status);
  const isAlternate = alternateStatuses.includes(status);

  return (
    <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
      <ol className="flex gap-2 overflow-x-auto pb-1">
        {mainStatusFlow.map((s, index) => {
          const done = currentIndex > index;
          const current = currentIndex === index;
          return (
            <li key={s} className="flex min-w-[8.5rem] flex-1 flex-col gap-2">
              <span
                className="h-1.5 w-full rounded-full"
                style={{
                  backgroundColor:
                    done || current ? "var(--stayo-forest)" : "var(--stayo-border)",
                  opacity: done ? 0.55 : 1,
                }}
              />
              <span
                className="text-xs"
                style={{
                  color: current ? "var(--stayo-ink)" : "var(--stayo-ink-muted)",
                  fontWeight: current ? 600 : 400,
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
          className="mt-3 inline-block rounded-[var(--radius-control)] px-2 py-1 text-xs"
          style={{ backgroundColor: "var(--stayo-gold-soft)", color: "var(--stayo-warning)" }}
        >
          Fora da linha principal: {statusLabels[status]}
        </p>
      )}
    </div>
  );
}

function IndicatorCards({
  items,
  loading,
}: {
  items: ImplementationItem[];
  loading: boolean;
}) {
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
          borderColor: readiness.ready ? "var(--stayo-success)" : "var(--stayo-gold)",
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
              : readiness.ready
                ? "var(--stayo-success)"
                : "var(--stayo-danger)",
          }}
        >
          {loading ? "—" : readiness.ready ? "Apta" : "Não apta"}
        </p>
        <p className="mt-3 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
          {readiness.pendingBlockers} bloqueador(es) em aberto ·{" "}
          {readiness.pendingMandatory} obrigatório(s) em aberto
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
          Não é a mesma coisa que progresso: um único bloqueador pendente impede a operação.
        </p>
      </div>
    </div>
  );
}

function Checklist({
  items,
  loading,
  error,
  onRetry,
}: {
  items: ImplementationItem[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
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
        <div className="px-4 py-16 text-center text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          Nenhum item de checklist nesta implantação ainda
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
                  <li key={item.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                    <span className="text-sm" style={{ color: "var(--stayo-ink)" }}>
                      {item.title}
                    </span>
                    {item.mandatory && <Tag label="Obrigatório" />}
                    {item.blocker && <Tag label="Bloqueador" tone="danger" />}
                    {item.ownerVisible && <Tag label="Visível ao proprietário" tone="gold" />}
                    <span
                      className="ml-auto text-xs"
                      style={{ color: itemStatusColor[item.status] }}
                    >
                      {itemStatusLabels[item.status]}
                    </span>
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
