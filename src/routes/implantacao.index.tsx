import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  Columns3,
  Copy,
  ExternalLink,
  Building2,
  CheckCircle2,
  Clock,
  MapPin,
  UserRound,
  LayoutGrid,
  List,
  Megaphone,
  Settings2,
  Loader2,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  AdminActionButton,
  AdminFilterBar,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import { listImplementationCoverUrls } from "@/lib/api/implementation-covers";
import { DeleteImplementationButton } from "@/components/implantacao/DeleteImplementationButton";
import { FieldLinkDialog } from "@/components/field/FieldLinkDialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { useAuthSession } from "../lib/auth/session";
import { commercialMeetingsApi } from "../lib/api/commercial-meetings";
import { implementationsListQuery } from "../lib/api/queries";
import { duplicateOpportunity } from "../lib/api/opportunities";
import { commercialUrgency, formatCommercialDateTime } from "../lib/commercial-meeting-state";
import { opportunityNextAction, opportunityTitle } from "../lib/opportunity-state";
import { formatBrazilianPhone } from "../lib/owner-form-validation";
import { alternateStatuses, mainStatusFlow, statusLabels } from "../lib/implementation-status";
import type { CommercialAssignee, CommercialOverviewRow } from "../types/commercial-journey";
import type { ImplementationProject } from "../types/core";
import { supabase } from "@/integrations/supabase/client";
import { Eye, Pencil } from "lucide-react";
import { loadOpportunityForm } from "../lib/api/opportunity-form";
import { toJourneyStep } from "../lib/opportunity-journey";
import { isDraftOrigin, journeyLabel, proposalStage } from "../lib/journey-states";
import type { CommercialProposalStatus } from "../types/commercial-proposal";

const JOURNEY_NEXT: Record<string, string> = {
  Rascunho: "Continuar cadastro",
  "Proposta publicada": "Aguardar aceite da proposta",
  "Proposta aceita": "Planejar implantação",
};
const journeyNextAction = (label: string) => JOURNEY_NEXT[label] ?? null;

/** Mesmo rótulo do cabeçalho e do cadastro: rascunho e proposta reais. */
function useJourneyLabels() {
  const q = useQuery({
    queryKey: ["implementations", "journey-states"],
    queryFn: async () => {
      const [projects, proposals] = await Promise.all([
        supabase.from("implementation_projects").select("id, origin, draft_completed_at"),
        supabase.from("proposals").select("implementation_id, status"),
      ]);
      if (projects.error) throw projects.error;
      if (proposals.error) throw proposals.error;
      return { projects: projects.data ?? [], proposals: proposals.data ?? [] };
    },
    staleTime: 30_000,
  });
  return (item: ImplementationProject) => {
    const p = q.data?.projects.find((r) => r.id === item.id);
    if (!q.data || !p) return statusLabels[item.status];
    const versions = q.data.proposals
      .filter((r) => r.implementation_id === item.id)
      .map((r) => ({ status: r.status as CommercialProposalStatus }));
    return journeyLabel({
      status: item.status,
      isDraft: isDraftOrigin(p.origin, p.draft_completed_at),
      proposal: proposalStage(versions),
    });
  };
}

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
  const [view, setView] = useState<"cards" | "lista" | "funil">("cards");
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
        <FieldLinkDialog />
        <AdminActionButton type="button" onClick={() => setDrawerOpen(true)}>
          <Plus className="size-4" />
          Nova oportunidade
        </AdminActionButton>
      </PageHeader>

      {query.isSuccess && data.length > 0 && <StageSummary data={data} />}

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
            aria-label="Cartões"
            onClick={() => setView("cards")}
            className={`h-7 gap-1.5 px-2.5 text-xs ${
              view === "cards"
                ? "bg-[var(--admin-primary)] text-[var(--primary-foreground)] hover:bg-[var(--admin-primary-hover)] hover:text-[var(--primary-foreground)]"
                : "text-[var(--admin-muted)]"
            }`}
          >
            <LayoutGrid className="size-3.5" /> Cartões
          </Button>
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
            <Columns3 className="size-3.5" /> Funil
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
      ) : view === "cards" ? (
        <OpportunityCards rows={rows} />
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

const KPIS: { label: string; statuses: ImplementationProject["status"][]; tone: string; Icon: typeof Settings2 }[] = [
  { label: "Em andamento", statuses: ["prospect", "proposta", "aguardando_aprovacao", "aprovado", "planejamento", "em_implantacao", "validacao", "pronto_para_operacao"], tone: "var(--admin-primary)", Icon: Settings2 },
  { label: "Aguardando proprietário", statuses: ["proposta", "aguardando_aprovacao"], tone: "var(--stayo-sand, oklch(0.62 0.08 75))", Icon: Clock },
  { label: "Anúncios ativos", statuses: ["ativo"], tone: "var(--success, oklch(0.6 0.12 155))", Icon: Megaphone },
];

function journeyProgress(status: ImplementationProject["status"]) {
  const i = mainStatusFlow.indexOf(status);
  return i < 0 ? 0 : Math.round(((i + 1) / mainStatusFlow.length) * 100);
}

function StageSummary({ data }: { data: ImplementationProject[] }) {
  return (
    <section className="mb-4 grid gap-3 sm:grid-cols-3">
      {KPIS.map(({ label, statuses, tone, Icon }) => (
        <div
          key={label}
          className="flex items-center gap-4 rounded-[var(--radius-card)] border p-4"
          style={surface}
        >
          <span
            className="grid size-12 shrink-0 place-items-center rounded-full"
            style={{ color: tone, backgroundColor: `color-mix(in oklab, ${tone} 15%, transparent)` }}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>{label}</p>
            <p className="text-3xl font-semibold leading-tight" style={{ color: "var(--stayo-ink)" }}>
              {data.filter((d) => statuses.includes(d.status)).length}
            </p>
          </div>
        </div>
      ))}
    </section>
  );
}

function ProgressRing({ value }: { value: number }) {
  const r = 22, c = 2 * Math.PI * r;
  return (
    <div className="relative grid size-14 shrink-0 place-items-center" aria-label={`${value}% concluído`}>
      <svg viewBox="0 0 52 52" className="absolute inset-0 -rotate-90">
        <circle cx="26" cy="26" r={r} fill="none" strokeWidth="4" style={{ stroke: "var(--admin-surface-subtle)" }} />
        <circle cx="26" cy="26" r={r} fill="none" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)}
          style={{ stroke: "var(--admin-primary)", transition: "stroke-dashoffset 600ms ease" }} />
      </svg>
      <span className="text-xs font-semibold" style={{ color: "var(--stayo-ink)" }}>{value}%</span>
    </div>
  );
}

function OpportunityCards({ rows }: { rows: ImplementationProject[] }) {
  const labelFor = useJourneyLabels();
  const ids = rows.map((r) => r.id);
  const covers = useQuery({
    queryKey: ["implementations", "covers", ids],
    queryFn: () => listImplementationCoverUrls(ids),
    staleTime: 30 * 60_000,
  });
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((item, index) => {
        const label = labelFor(item);
        const cover = covers.data?.[item.id];
        const next = journeyNextAction(label) ?? "Ver ficha";
        const place = [item.condominiumName, item.unit].filter(Boolean).join(" · ");
        return (
          <li
            key={item.id}
            className="group flex animate-fade-in flex-col overflow-hidden rounded-[var(--radius-card)] border transition-shadow duration-200 hover:shadow-lg"
            style={{ ...surface, animationDelay: `${Math.min(index, 8) * 40}ms`, animationFillMode: "both" }}
          >
            <Link to="/implantacao/$id" params={{ id: item.id }} search={{ secao: "visao" }} className="relative block aspect-[16/9] overflow-hidden" style={{ backgroundColor: "var(--admin-primary)" }}>
              {cover ? (
                <img src={cover} alt={opportunityTitle(item)} loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
              ) : (
                <div className="grid size-full place-items-center" style={{ color: "color-mix(in oklab, var(--primary-foreground) 55%, transparent)" }}>
                  <Building2 className="size-10" aria-hidden="true" />
                </div>
              )}
              <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm" style={{ backgroundColor: "var(--stayo-surface)", color: "var(--stayo-ink)" }}>
                <CheckCircle2 className="size-3.5" aria-hidden="true" /> {label}
              </span>
              {place && (
                <span className="absolute right-3 top-3 inline-flex max-w-[55%] items-center gap-1 truncate rounded-full px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: "color-mix(in oklab, var(--admin-primary) 80%, transparent)", color: "var(--primary-foreground)" }}>
                  <MapPin className="size-3.5 shrink-0" aria-hidden="true" /> <span className="truncate">{place}</span>
                </span>
              )}
            </Link>
            <div className="flex flex-1 flex-col gap-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to="/implantacao/$id" params={{ id: item.id }} search={{ secao: "visao" }} className="block truncate text-base font-semibold hover:underline" style={{ color: "var(--stayo-ink)" }}>
                    {opportunityTitle(item)}
                  </Link>
                  <p className="mt-0.5 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>{item.code}</p>
                  <div className="mt-3 flex items-center gap-2 text-sm">
                    <UserRound className="size-4 shrink-0" style={{ color: "var(--stayo-ink-muted)" }} aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="truncate" style={{ color: "var(--stayo-ink)" }}>{item.ownerName || "Contato a completar"}</p>
                      <p className="truncate text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                        {item.ownerPhone ? formatBrazilianPhone(item.ownerPhone) : "Proprietário"}
                      </p>
                    </div>
                  </div>
                </div>
                <ProgressRing value={({ Rascunho: 10, "Proposta publicada": 30, "Proposta aceita": 45 } as Record<string, number>)[label] ?? journeyProgress(item.status)} />
              </div>
              <div className="mt-auto flex items-center gap-2">
                <CardPrimaryAction item={item} isDraft={label === "Rascunho"} label={next} />
                <ImplementationRowActions item={item} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function CardPrimaryAction({ item, isDraft, label }: { item: ImplementationProject; isDraft: boolean; label: string }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  async function go() {
    if (busy) return;
    setBusy(true);
    try {
      if (isDraft) {
        const form = await loadOpportunityForm(item.id);
        await navigate({ to: "/implantacao/$id", params: { id: item.id }, search: { etapa: toJourneyStep(form.draftStep) ?? "contato" } });
      } else {
        await navigate({ to: "/implantacao/$id", params: { id: item.id }, search: { secao: "visao" } });
      }
    } catch {
      toast.error("Não foi possível abrir a ficha. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AdminActionButton type="button" className="h-10 flex-1 justify-center" disabled={busy} onClick={() => void go()}>
      {isDraft ? <Pencil className="size-4" /> : <CalendarClock className="size-4" />}
      {busy ? "Abrindo…" : label}
    </AdminActionButton>
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
  const labelFor = useJourneyLabels();
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
              className="relative animate-fade-in"
              style={{ animationDelay: `${Math.min(index, 8) * 35}ms`, animationFillMode: "both" }}
            >
              <Link
                to="/implantacao/$id"
                params={{ id: item.id }}
                className="group block pb-2 pt-4 pl-4 pr-14 transition-colors duration-200 hover:bg-[var(--admin-surface-subtle)] focus-visible:bg-[var(--admin-surface-subtle)] focus-visible:outline-none active:bg-[var(--admin-surface-subtle)] sm:grid sm:grid-cols-[minmax(220px,1.3fr)_minmax(180px,1fr)_10rem_11rem_minmax(200px,1.1fr)] sm:items-center sm:gap-4 sm:pl-4 sm:pr-16"
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
                      <AdminStatusBadge tone={tone}>{labelFor(item)}</AdminStatusBadge>
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
                  <AdminStatusBadge tone={tone}>{labelFor(item)}</AdminStatusBadge>
                </div>
                <span
                  className="hidden text-sm sm:block"
                  style={{ color: "var(--stayo-ink-muted)" }}
                >
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
              <RowPrimaryActions item={item} isDraft={labelFor(item) === "Rascunho"} />
              <div className="absolute right-3 top-3 sm:top-6">
                <ImplementationRowActions item={item} />
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/** Ações explícitas: "Ver ficha" abre o Resumo; "Continuar cadastro" retoma a etapa salva. */
function RowPrimaryActions({ item, isDraft }: { item: ImplementationProject; isDraft: boolean }) {
  const navigate = useNavigate();
  const [resuming, setResuming] = useState(false);
  async function resume() {
    if (resuming) return;
    setResuming(true);
    try {
      const form = await loadOpportunityForm(item.id);
      await navigate({ to: "/implantacao/$id", params: { id: item.id }, search: { etapa: toJourneyStep(form.draftStep) ?? "contato" } });
    } catch {
      toast.error("Não foi possível retomar o cadastro. Tente novamente.");
    } finally {
      setResuming(false);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
      <Button asChild variant="outline" size="sm" className="min-h-9">
        <Link to="/implantacao/$id" params={{ id: item.id }} search={{ secao: "visao" }}>
          <Eye aria-hidden="true" /> Ver ficha
        </Link>
      </Button>
      {isDraft && (
        <Button type="button" variant="ghost" size="sm" className="min-h-9" disabled={resuming} onClick={() => void resume()}>
          <Pencil aria-hidden="true" /> {resuming ? "Abrindo…" : "Continuar cadastro"}
        </Button>
      )}
    </div>
  );
}

function ImplementationRowActions({ item }: { item: ImplementationProject }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [duplicating, setDuplicating] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const locked =
    item.status === "ativo" || Boolean(item.corePropertyId) || Boolean(item.coreOwnerId);

  function openDetails() {
    void navigate({ to: "/implantacao/$id", params: { id: item.id }, search: { secao: "visao" } });
  }

  async function duplicate() {
    if (duplicating) return;
    setDuplicating(true);
    try {
      const created = await duplicateOpportunity({
        id: item.id,
        code: item.code,
        nickname: item.nickname,
        ownerId: item.ownerId,
        ownerName: item.ownerName,
        ownerPhone: item.ownerPhone,
        responsibleUserId: item.responsibleUserId,
      });
      await queryClient.invalidateQueries({ queryKey: ["implementations"] });
      toast.success(`${item.code} duplicada em um novo rascunho.`);
      await navigate({
        to: "/implantacao/$id",
        params: { id: created.implementationId },
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível duplicar a implantação.",
      );
    } finally {
      setDuplicating(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 rounded-[var(--radius-control)] border border-transparent bg-[var(--stayo-surface)]/90 text-[var(--stayo-ink-muted)] shadow-sm hover:border-[var(--stayo-border)] hover:bg-[var(--stayo-surface)] hover:text-[var(--stayo-ink)]"
            aria-label={`Ações de ${item.code}`}
            title={`Ações de ${item.code}`}
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={openDetails}>
            <ExternalLink aria-hidden="true" />
            Ver ficha
          </DropdownMenuItem>
          <DropdownMenuItem disabled={duplicating} onSelect={() => void duplicate()}>
            {duplicating ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Copy aria-hidden="true" />
            )}
            Duplicar implantação
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-[var(--stayo-danger)] focus:text-[var(--stayo-danger)]"
            onSelect={() => setDeleteOpen(true)}
          >
            <Trash2 aria-hidden="true" />
            Excluir implantação
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteImplementationButton
        id={item.id}
        code={item.code}
        locked={locked}
        navigateAfterDelete={false}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        showTrigger={false}
      />
    </>
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
                    {item.ownerName ||
                      (item.ownerId ? "Contato a completar" : "Aguardando cadastro")}
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
  const labelFor = useJourneyLabels();
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
      {journeyNextAction(labelFor(item)) ?? opportunityNextAction(item)}
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
