import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CalendarClock, LayoutGrid, List, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import {
  AdminActionButton,
  AdminFilterBar,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { NewOpportunityDrawer } from "../components/implantacao/NewOpportunityDrawer";
import {
  EmptyRows,
  ErrorRows,
  ListSkeleton,
  PageHeader,
  Panel,
  SearchInput,
  SelectFilter,
} from "../components/data/ListStates";
import { Button } from "../components/ui/button";
import { useAuthSession } from "../lib/auth/session";
import { commercialMeetingsApi } from "../lib/api/commercial-meetings";
import { implementationsListQuery } from "../lib/api/queries";
import { commercialUrgency, formatCommercialDateTime } from "../lib/commercial-meeting-state";
import { opportunityNextAction, opportunityTitle } from "../lib/opportunity-state";
import { formatBrazilianPhone } from "../lib/owner-form-validation";
import { alternateStatuses, mainStatusFlow, statusLabels } from "../lib/implementation-status";
import type { CommercialAssignee, CommercialOverviewRow } from "../types/commercial-journey";
import type { ImplementationProject } from "../types/core";

export const Route = createFileRoute("/implantacao/")({
  head: () => ({
    meta: [
      { title: "Implantações — Stayo Admin" },
      {
        name: "description",
        content: "Oportunidades comerciais e implantações de novos imóveis.",
      },
      { property: "og:title", content: "Implantações — Stayo Admin" },
      {
        property: "og:description",
        content: "Oportunidades comerciais e implantações de novos imóveis.",
      },
    ],
  }),
  component: ImplementationsPage,
});

const surface = {
  backgroundColor: "var(--stayo-surface)",
  borderColor: "var(--stayo-border)",
};

type CommercialLoadState = "loading" | "ready" | "error";

function ImplementationsPage() {
  const auth = useAuthSession();
  const query = useQuery(implementationsListQuery());
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
  const data = query.data?.data ?? [];
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"lista" | "funil">("lista");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const commercialByImplementation = useMemo(
    () =>
      new Map((commercialQuery.data ?? []).map((item) => [item.implementationId, item] as const)),
    [commercialQuery.data],
  );
  const assigneeById = useMemo(
    () => new Map((assigneesQuery.data ?? []).map((item) => [item.id, item] as const)),
    [assigneesQuery.data],
  );
  const commercialLoadState: CommercialLoadState =
    commercialQuery.isError || assigneesQuery.isError
      ? "error"
      : commercialQuery.isPending || assigneesQuery.isPending
        ? "loading"
        : "ready";

  const rows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return data.filter((item) => {
      if (status !== "all" && item.status !== status) return false;
      if (!term) return true;
      const haystack = [
        item.code,
        opportunityTitle(item),
        item.ownerName,
        item.ownerPhone,
        item.condominiumName,
        item.unit,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR");
      return haystack.includes(term);
    });
  }, [data, search, status]);

  const statusOptions = [
    { value: "all", label: "Todas as etapas" },
    ...[...mainStatusFlow, ...alternateStatuses].map((value) => ({
      value,
      label: statusLabels[value],
    })),
  ];

  return (
    <>
      <PageHeader title="Implantações" count={query.isSuccess ? rows.length : undefined}>
        <AdminActionButton type="button" onClick={() => setDrawerOpen(true)}>
          <Plus className="size-4" />
          Nova oportunidade
        </AdminActionButton>
      </PageHeader>

      <section
        className="mb-4 rounded-[var(--radius-card)] border px-4 py-3 sm:px-5"
        style={{ borderColor: "var(--stayo-border)", backgroundColor: "var(--stayo-surface)" }}
      >
        <p className="text-sm font-medium" style={{ color: "var(--stayo-ink)" }}>
          Comece o relacionamento antes de ter todos os dados do imóvel.
        </p>
        <p className="mt-1 text-xs leading-5" style={{ color: "var(--stayo-ink-muted)" }}>
          Nome, telefone e um título provisório bastam. A mesma ficha evolui depois para proposta,
          implantação e conversão operacional.
        </p>
      </section>

      <AdminFilterBar className="mb-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por título, contato, telefone ou código"
        />
        <SelectFilter
          label="Filtrar por etapa"
          value={status}
          onChange={setStatus}
          options={statusOptions}
        />
        <div className="ml-auto flex rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-0.5 text-xs">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setView("lista")}
            className={`h-7 gap-1.5 px-2.5 text-xs ${
              view === "lista"
                ? "bg-[var(--admin-primary)] text-[var(--primary-foreground)] hover:bg-[var(--admin-primary-hover)] hover:text-[var(--primary-foreground)]"
                : "text-[var(--admin-muted)]"
            }`}
          >
            <List className="size-3.5" /> Lista
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setView("funil")}
            className={`h-7 gap-1.5 px-2.5 text-xs ${
              view === "funil"
                ? "bg-[var(--admin-primary)] text-[var(--primary-foreground)] hover:bg-[var(--admin-primary-hover)] hover:text-[var(--primary-foreground)]"
                : "text-[var(--admin-muted)]"
            }`}
          >
            <LayoutGrid className="size-3.5" /> Funil
          </Button>
        </div>
      </AdminFilterBar>

      <NewOpportunityDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {query.isPending ? (
        <Panel>
          <ListSkeleton />
        </Panel>
      ) : query.isError ? (
        <Panel>
          <ErrorRows onRetry={() => void query.refetch()} />
        </Panel>
      ) : rows.length === 0 ? (
        <Panel>
          <EmptyRows
            message={
              data.length === 0
                ? "Nenhuma oportunidade ou implantação cadastrada ainda"
                : "Nenhum registro encontrado com estes filtros"
            }
          />
        </Panel>
      ) : view === "lista" ? (
        <OpportunityList
          rows={rows}
          currentUserId={auth.profile?.id ?? null}
          commercialByImplementation={commercialByImplementation}
          assigneeById={assigneeById}
          commercialLoadState={commercialLoadState}
        />
      ) : (
        <Pipeline
          rows={rows}
          currentUserId={auth.profile?.id ?? null}
          commercialByImplementation={commercialByImplementation}
          assigneeById={assigneeById}
          commercialLoadState={commercialLoadState}
        />
      )}
    </>
  );
}

function OpportunityList({
  rows,
  currentUserId,
  commercialByImplementation,
  assigneeById,
  commercialLoadState,
}: {
  rows: ImplementationProject[];
  currentUserId: string | null;
  commercialByImplementation: Map<string, CommercialOverviewRow>;
  assigneeById: Map<string, CommercialAssignee>;
  commercialLoadState: CommercialLoadState;
}) {
  return (
    <Panel>
      <div
        className="hidden grid-cols-[minmax(220px,1.3fr)_minmax(180px,1fr)_10rem_11rem_minmax(200px,1.1fr)] gap-4 border-b px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] sm:grid"
        style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink-muted)" }}
      >
        <span>Oportunidade</span>
        <span>Contato</span>
        <span>Etapa</span>
        <span>Responsável</span>
        <span>Próxima ação</span>
      </div>
      <ul className="divide-y divide-[var(--admin-border)]">
        {rows.map((item) => {
          const commercial = commercialByImplementation.get(item.id);
          return (
            <li key={item.id}>
              <Link
                to="/implantacao/$id"
                params={{ id: item.id }}
                className="admin-data-row grid gap-3 px-4 py-4 sm:grid-cols-[minmax(220px,1.3fr)_minmax(180px,1fr)_10rem_11rem_minmax(200px,1.1fr)] sm:items-center"
              >
                <div className="min-w-0">
                  <p
                    className="truncate text-sm font-semibold"
                    style={{ color: "var(--stayo-ink)" }}
                  >
                    {opportunityTitle(item)}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                    {item.code}
                  </p>
                </div>
                <div className="min-w-0 text-sm">
                  <p className="truncate" style={{ color: "var(--stayo-ink)" }}>
                    {item.ownerName || (item.ownerId ? "Contato a completar" : "Aguardando cadastro")}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                    {item.ownerPhone
                      ? formatBrazilianPhone(item.ownerPhone)
                      : "Telefone a completar"}
                  </p>
                </div>
                <div>
                  <AdminStatusBadge
                    tone={
                      item.status === "ativo"
                        ? "success"
                        : item.status === "cancelado" || item.status === "nao_convertido"
                          ? "danger"
                          : "info"
                    }
                  >
                    {statusLabels[item.status]}
                  </AdminStatusBadge>
                </div>
                <span className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                  {responsibleLabel(item, currentUserId, assigneeById)}
                </span>
                <CommercialPriority
                  item={item}
                  commercial={commercial}
                  loadState={commercialLoadState}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function Pipeline({
  rows,
  currentUserId,
  commercialByImplementation,
  assigneeById,
  commercialLoadState,
}: {
  rows: ImplementationProject[];
  currentUserId: string | null;
  commercialByImplementation: Map<string, CommercialOverviewRow>;
  assigneeById: Map<string, CommercialAssignee>;
  commercialLoadState: CommercialLoadState;
}) {
  const columns = [...mainStatusFlow, ...alternateStatuses];
  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {columns.map((status) => {
        const items = rows.filter((item) => item.status === status);
        return (
          <section key={status} className="w-72 shrink-0">
            <div className="mb-2 flex items-center justify-between px-1 text-xs">
              <strong style={{ color: "var(--stayo-ink)" }}>{statusLabels[status]}</strong>
              <span style={{ color: "var(--stayo-ink-muted)" }}>{items.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {items.map((item) => (
                <Link
                  key={item.id}
                  to="/implantacao/$id"
                  params={{ id: item.id }}
                  className="rounded-[var(--radius-card)] border p-3"
                  style={surface}
                >
                  <p
                    className="truncate text-sm font-semibold"
                    style={{ color: "var(--stayo-ink)" }}
                  >
                    {opportunityTitle(item)}
                  </p>
                  <p className="mt-1 truncate text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                    {item.ownerName || (item.ownerId ? "Contato a completar" : "Aguardando cadastro")}
                    {item.ownerPhone ? ` · ${formatBrazilianPhone(item.ownerPhone)}` : ""}
                  </p>
                  <div className="mt-3">
                    <CommercialPriority
                      item={item}
                      commercial={commercialByImplementation.get(item.id)}
                      loadState={commercialLoadState}
                    />
                  </div>
                  <p className="mt-1 text-[11px]" style={{ color: "var(--stayo-ink-muted)" }}>
                    {responsibleLabel(item, currentUserId, assigneeById)}
                  </p>
                </Link>
              ))}
              {items.length === 0 && (
                <div
                  className="rounded-[var(--radius-card)] border border-dashed p-4 text-center text-xs"
                  style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink-muted)" }}
                >
                  Vazio
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function CommercialPriority({
  item,
  commercial,
  loadState,
}: {
  item: ImplementationProject;
  commercial: CommercialOverviewRow | undefined;
  loadState: CommercialLoadState;
}) {
  if (loadState === "loading") {
    return <span className="text-xs text-[var(--stayo-ink-muted)]">Carregando agenda…</span>;
  }
  if (loadState === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--stayo-warning)]">
        <AlertTriangle className="size-3.5" /> Agenda indisponível
      </span>
    );
  }

  const urgency = commercialUrgency(commercial);
  if (commercial?.nextActionTitle && commercial.nextActionDueAt && commercial.nextActionTimeZone) {
    return (
      <span className="block min-w-0">
        <span
          className="block truncate text-sm font-medium"
          style={{
            color: urgency === "overdue_action" ? "var(--stayo-danger)" : "var(--stayo-forest)",
          }}
        >
          {commercial.nextActionTitle}
        </span>
        <span className="mt-0.5 block text-[11px] text-[var(--stayo-ink-muted)]">
          {urgency === "overdue_action" ? "Vencida · " : "Até "}
          {formatCommercialDateTime(commercial.nextActionDueAt, commercial.nextActionTimeZone)}
          {commercial.nextActionResponsibleName ? ` · ${commercial.nextActionResponsibleName}` : ""}
        </span>
      </span>
    );
  }

  if (commercial?.meetingStartsAt && commercial.meetingTimeZone) {
    return (
      <span className="block min-w-0">
        <span
          className="inline-flex items-center gap-1.5 text-sm font-medium"
          style={{
            color: urgency === "meeting_soon" ? "var(--stayo-warning)" : "var(--stayo-forest)",
          }}
        >
          <CalendarClock className="size-3.5" /> Reunião agendada
        </span>
        <span className="mt-0.5 block text-[11px] text-[var(--stayo-ink-muted)]">
          {formatCommercialDateTime(commercial.meetingStartsAt, commercial.meetingTimeZone)}
          {commercial.meetingResponsibleName ? ` · ${commercial.meetingResponsibleName}` : ""}
        </span>
      </span>
    );
  }

  return (
    <span className="text-sm font-medium" style={{ color: "var(--stayo-forest)" }}>
      {opportunityNextAction(item)}
    </span>
  );
}

function responsibleLabel(
  item: ImplementationProject,
  currentUserId: string | null,
  assigneeById: Map<string, CommercialAssignee>,
): string {
  if (!item.responsibleUserId) return "A definir";
  if (currentUserId && item.responsibleUserId === currentUserId) return "Você";
  return assigneeById.get(item.responsibleUserId)?.fullName ?? "Responsável definido";
}
