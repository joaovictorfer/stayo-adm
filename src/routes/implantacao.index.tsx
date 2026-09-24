import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { LayoutGrid, List, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { AdminActionButton, AdminFilterBar, AdminStatusBadge } from "@/components/admin/AdminPrimitives";
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
import { implementationsListQuery } from "../lib/api/queries";
import { opportunityNextAction, opportunityTitle } from "../lib/opportunity-state";
import { formatBrazilianPhone } from "../lib/owner-form-validation";
import { alternateStatuses, mainStatusFlow, statusLabels } from "../lib/implementation-status";
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

function ImplementationsPage() {
  const auth = useAuthSession();
  const query = useQuery(implementationsListQuery());
  const data = query.data?.data ?? [];
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"lista" | "funil">("lista");
  const [drawerOpen, setDrawerOpen] = useState(false);

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
        <OpportunityList rows={rows} currentUserId={auth.profile?.id ?? null} />
      ) : (
        <Pipeline rows={rows} currentUserId={auth.profile?.id ?? null} />
      )}
    </>
  );
}

function OpportunityList({
  rows,
  currentUserId,
}: {
  rows: ImplementationProject[];
  currentUserId: string | null;
}) {
  return (
    <Panel>
      <div className="hidden grid-cols-[minmax(220px,1.3fr)_minmax(180px,1fr)_10rem_11rem_minmax(180px,1fr)] gap-4 border-b px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] sm:grid" style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink-muted)" }}>
        <span>Oportunidade</span>
        <span>Contato</span>
        <span>Etapa</span>
        <span>Responsável</span>
        <span>Próxima ação</span>
      </div>
      <ul className="divide-y divide-[var(--admin-border)]">
        {rows.map((item) => (
          <li key={item.id}>
            <Link
              to="/implantacao/$id"
              params={{ id: item.id }}
              className="admin-data-row grid gap-3 px-4 py-4 sm:grid-cols-[minmax(220px,1.3fr)_minmax(180px,1fr)_10rem_11rem_minmax(180px,1fr)] sm:items-center"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold" style={{ color: "var(--stayo-ink)" }}>
                  {opportunityTitle(item)}
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                  {item.code}
                </p>
              </div>
              <div className="min-w-0 text-sm">
                <p className="truncate" style={{ color: "var(--stayo-ink)" }}>
                  {item.ownerName || "Contato a completar"}
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                  {item.ownerPhone ? formatBrazilianPhone(item.ownerPhone) : "Telefone a completar"}
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
                {responsibleLabel(item, currentUserId)}
              </span>
              <span className="text-sm font-medium" style={{ color: "var(--stayo-forest)" }}>
                {opportunityNextAction(item)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Pipeline({
  rows,
  currentUserId,
}: {
  rows: ImplementationProject[];
  currentUserId: string | null;
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
                  <p className="truncate text-sm font-semibold" style={{ color: "var(--stayo-ink)" }}>
                    {opportunityTitle(item)}
                  </p>
                  <p className="mt-1 truncate text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                    {item.ownerName || "Contato a completar"}
                    {item.ownerPhone ? ` · ${formatBrazilianPhone(item.ownerPhone)}` : ""}
                  </p>
                  <p className="mt-3 text-xs font-medium" style={{ color: "var(--stayo-forest)" }}>
                    {opportunityNextAction(item)}
                  </p>
                  <p className="mt-1 text-[11px]" style={{ color: "var(--stayo-ink-muted)" }}>
                    {responsibleLabel(item, currentUserId)}
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

function responsibleLabel(item: ImplementationProject, currentUserId: string | null): string {
  if (!item.responsibleUserId) return "A definir";
  if (currentUserId && item.responsibleUserId === currentUserId) return "Você";
  return "Responsável definido";
}
