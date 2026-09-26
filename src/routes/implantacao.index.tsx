import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  LayoutGrid,
  List,
  Plus,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  AdminActionButton,
  AdminFilterBar,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { DeleteImplementationButton } from "@/components/implantacao/DeleteImplementationButton";
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
        className="mb-4 hidden rounded-[var(--radius-card)] border px-4 py-3 sm:block sm:px-5"
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
        {rows.map((item, index) => {
          const commercial = commercialByImplementation.get(item.id);
          const tone =
            item.status === "ativo"
              ? "success"
              : item.status === "cancelado" || item.status === "nao_convertido"
                ? "danger"
                : "info";
          const contactName =
            item.ownerName || (item.ownerId ? "Contato a completar" : "Aguardando cadastro");
          const phone = item.ownerPhone
            ? formatBrazilianPhone(item.ownerPhone)
            : "Telefone a completar";
          return (
            <li
              key={item.id}
              className="animate-fade-in"
              style={{ animationDelay: `${Math.min(index, 8) * 35}ms`, animationFillMode: "both" }}
            >
              <Link
                to="/implantacao/$id"
                params={{ id: item.id }}
                className="group block py-4 pl-4 pr-14 transition-colors duration-200 hover:bg-[var(--admin-surface-subtle)] focus-visible:bg-[var(--admin-surface-subtle)] focus-visible:outline-none active:bg-[var(--admin-surface-subtle)] sm:grid sm:grid-cols-[minmax(220px,1.3fr)_minmax(180px,1fr)_10rem_11rem_minmax(200px,1.1fr)] sm:items-center sm:gap-4 sm:pl-4 sm:pr-16"
              >
                {/* Mobile card */}
                <div className="flex flex-col gap-3 sm:hidden">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className="line-clamp-2 text-[15px] font-semibold leading-snug"
                        style={{ color: "var(--stayo-ink)" }}
                      >
                        {opportunityTitle(item)}
                      </p>
                      <p
                        className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.06em]"
                        style={{ color: "var(--stayo-ink-muted)" }}
                      >
                        {item.code}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <AdminStatusBadge tone={tone}>{statusLabels[item.status]}</AdminStatusBadge>
                      <ChevronRight
                        className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                        style={{ color: "var(--stayo-ink-muted)" }}
                      />
                    </div>
                  </div>
                  <div
                    className="flex items-center justify-between gap-3 text-[13px]"
                    style={{ color: "var(--stayo-ink-muted)" }}
                  >
                    <span className="min-w-0 truncate">
                      <span style={{ color: "var(--stayo-ink)" }}>{contactName}</span>
                      {" · "}
                      {phone}
                    </span>
                    <span className="shrink-0 text-xs">
                      {responsibleLabel(item, currentUserId, assigneeById)}
                    </span>
                  </div>
                  <div
                    className="rounded-[var(--admin-radius)] px-3 py-2 text-sm"
                    style={{ backgroundColor: "var(--admin-surface-subtle)" }}
                  >
                    <CommercialPriority
                      item={item}
                      commercial={commercial}
                      loadState={commercialLoadState}
                    />
                  </div>
                </div>

                {/* Desktop row */}
                <div className="hidden min-w-0 sm:block">
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
                <div className="hidden min-w-0 text-sm sm:block">
                  <p className="truncate" style={{ color: "var(--stayo-ink)" }}>
                    {contactName}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                    {phone}
                  </p>
                </div>
                <div className="hidden sm:block">
                  <AdminStatusBadge tone={tone}>{statusLabels[item.status]}</AdminStatusBadge>
                </div>
                <span className="hidden text-sm sm:block" style={{ color: "var(--stayo-ink-muted)" }}>
                  {responsibleLabel(item, currentUserId, assigneeById)}
                </span>
                <div className="hidden sm:block">
                  <CommercialPriority
                    item={item}
                    commercial={commercial}
                    loadState={commercialLoadState}
                  />
                </div>
              </Link>
              <div className="absolute right-3 top-3 sm:top-1/2 sm:-translate-y-1/2">
                <DeleteImplementationButton
                  id={item.id}
                  code={item.code}
                  locked={
                    item.status === "ativo" ||
                    Boolean(item.corePropertyId) ||
                    Boolean(item.coreOwnerId)
                  }
                  navigateAfterDelete={false}
                  compact
                />
              </div>
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
