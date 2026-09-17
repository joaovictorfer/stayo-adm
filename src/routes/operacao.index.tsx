import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, ListChecks } from "lucide-react";
import { useMemo, useState } from "react";

import {
  EmptyRows,
  ErrorRows,
  ListSkeleton,
  PageHeader,
  Panel,
} from "../components/data/ListStates";
import { Drawer } from "../components/patterns/Drawer";
import { IndicatorCard, PeriodFilter } from "../components/patterns/IndicatorCard";
import { coreApi, operationTasksListQuery, propertiesListQuery } from "../lib/api/queries";
import type { OperationTask } from "../types/core";

export const Route = createFileRoute("/operacao/")({
  head: () => ({
    meta: [
      { title: "Operação — Stayo Admin" },
      { name: "description", content: "Pendências operacionais da rotina Stayo." },
      { property: "og:title", content: "Operação — Stayo Admin" },
      { property: "og:description", content: "Pendências operacionais da rotina Stayo." },
    ],
  }),
  component: OperationPage,
});

type PeriodValue = "7" | "14" | "30";
const periodOptions: { value: PeriodValue; label: string }[] = [
  { value: "7", label: "7d" },
  { value: "14", label: "14d" },
  { value: "30", label: "30d" },
];

type ViewMode = "lista" | "agenda";
const viewOptions: { value: ViewMode; label: string }[] = [
  { value: "lista", label: "Lista" },
  { value: "agenda", label: "Agenda" },
];

const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long" }).format(new Date(iso));

function OperationPage() {
  const [period, setPeriod] = useState<PeriodValue>("7");
  const [view, setView] = useState<ViewMode>("lista");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const query = useQuery(operationTasksListQuery());

  const rows = useMemo(() => {
    const horizon = Date.now() + Number(period) * 24 * 60 * 60 * 1000;
    return (query.data?.data ?? []).filter((t) => {
      if (!t.dueDate) return true;
      const due = Date.parse(t.dueDate);
      return Number.isNaN(due) || due <= horizon;
    });
  }, [query.data, period]);

  const byDay = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const t of rows) {
      const key = t.dueDate ?? "Sem data prevista";
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    for (const [, tasks] of map) {
      tasks.sort((a, b) => (a.scheduledTime ?? "99:99").localeCompare(b.scheduledTime ?? "99:99"));
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  const unassigned = rows.filter((t) => !t.responsibleUserId).length;

  return (
    <>
      <PageHeader title="Operação">
        <PeriodFilter value={view} onChange={setView} options={viewOptions} />
        <PeriodFilter value={period} onChange={setPeriod} options={periodOptions} />
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="rounded-[var(--radius-control)] px-3 py-2 text-sm"
          style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
        >
          Nova rotina
        </button>
      </PageHeader>
      <p className="mb-4 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        Pendências operacionais do dia a dia, considerando os próximos {period} dias.
      </p>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <IndicatorCard icon={ListChecks} label="Pendências no período" value={rows.length} />
        <IndicatorCard
          icon={AlertTriangle}
          label="Sem responsável"
          value={unassigned}
          tone={unassigned > 0 ? "warning" : "neutral"}
        />
      </div>

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
          <EmptyRows message="Nenhuma pendência operacional no período selecionado" />
        </Panel>
      ) : view === "lista" ? (
        <Panel>
          <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
            {rows.map((t) => (
              <li key={t.id}>
                <Link
                  to="/operacao/$id"
                  params={{ id: t.id }}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"
                  style={{ color: "var(--stayo-ink)" }}
                >
                  <span className="font-medium">{t.title}</span>
                  <span style={{ color: "var(--stayo-ink-muted)" }}>
                    {t.propertyName ?? t.propertyId ?? "—"}
                  </span>
                  <span className="ml-auto" style={{ color: "var(--stayo-ink-muted)" }}>
                    {t.dueDate ?? "—"} · {t.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : (
        <div className="flex flex-col gap-3">
          {byDay.map(([day, tasks]) => (
            <div
              key={day}
              className="rounded-[var(--radius-card)] border"
              style={{
                borderColor: "var(--stayo-border)",
                backgroundColor: "var(--stayo-surface)",
              }}
            >
              <h2
                className="border-b px-4 py-2 text-sm capitalize"
                style={{
                  borderColor: "var(--stayo-border)",
                  fontFamily: "var(--stayo-font-display)",
                  color: "var(--stayo-ink)",
                }}
              >
                {day === "Sem data prevista" ? day : dayLabel(day)}
              </h2>
              <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
                {tasks.map((t) => (
                  <li key={t.id}>
                    <Link
                      to="/operacao/$id"
                      params={{ id: t.id }}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"
                      style={{ color: "var(--stayo-ink)" }}
                    >
                      <span className="w-12 shrink-0" style={{ color: "var(--stayo-ink-muted)" }}>
                        {t.scheduledTime ?? "—"}
                      </span>
                      <span className="font-medium">{t.title}</span>
                      <span style={{ color: "var(--stayo-ink-muted)" }}>
                        {t.propertyName ?? t.propertyId ?? "—"}
                      </span>
                      <span className="ml-auto" style={{ color: "var(--stayo-ink-muted)" }}>
                        {t.status}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <NewOperationTaskDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

const surface = { backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" };

const emptyTaskForm = {
  title: "",
  kind: "limpeza",
  propertyId: "",
  dueDate: "",
  scheduledTime: "",
  priority: "media",
};

function NewOperationTaskDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const propertiesQuery = useQuery(propertiesListQuery());
  const [form, setForm] = useState(emptyTaskForm);

  const properties = propertiesQuery.data?.data ?? [];

  const create = useMutation({
    mutationFn: (): Promise<OperationTask> => {
      const property = properties.find((p) => p.id === form.propertyId) ?? null;
      return coreApi.operations.create({
        title: form.title,
        kind: form.kind,
        propertyId: property?.id ?? null,
        propertyName: property?.name ?? null,
        reservationId: null,
        reservationCode: null,
        dueDate: form.dueDate || null,
        scheduledTime: form.scheduledTime || null,
        responsibleUserId: null,
        status: "pendente",
        priority: form.priority,
        totalAmount: null,
      });
    },
    onSuccess: async () => {
      setForm(emptyTaskForm);
      onClose();
      await queryClient.invalidateQueries({ queryKey: ["operations"] });
    },
  });

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <Drawer
      open={open}
      onClose={() => {
        setForm(emptyTaskForm);
        onClose();
      }}
      eyebrow="Operação"
      title="Nova rotina"
      footer={
        <button
          type="button"
          onClick={() => create.mutate()}
          disabled={create.isPending || form.title.trim() === ""}
          className="w-full rounded-[var(--radius-control)] px-3 py-2 text-sm disabled:opacity-60"
          style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
        >
          {create.isPending ? "Salvando..." : "Salvar"}
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <TextField label="Título" value={form.title} onChange={set("title")} />
        <label className="block text-sm">
          <span className="mb-1 block text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
            Tipo
          </span>
          <select
            value={form.kind}
            onChange={(e) => set("kind")(e.target.value)}
            className="w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
            style={{ ...surface, color: "var(--stayo-ink)" }}
          >
            <option value="limpeza">Limpeza</option>
            <option value="manutencao">Manutenção</option>
            <option value="vistoria">Vistoria</option>
            <option value="outro">Outro</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
            Imóvel
          </span>
          <select
            value={form.propertyId}
            onChange={(e) => set("propertyId")(e.target.value)}
            className="w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
            style={{ ...surface, color: "var(--stayo-ink)" }}
          >
            <option value="">Sem imóvel vinculado</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <TextField label="Prazo" value={form.dueDate} onChange={set("dueDate")} type="date" />
        <TextField
          label="Horário previsto"
          value={form.scheduledTime}
          onChange={set("scheduledTime")}
          type="time"
        />
        <label className="block text-sm">
          <span className="mb-1 block text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
            Prioridade
          </span>
          <select
            value={form.priority}
            onChange={(e) => set("priority")(e.target.value)}
            className="w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
            style={{ ...surface, color: "var(--stayo-ink)" }}
          >
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
          </select>
        </label>
        {create.isError && (
          <span className="text-sm" style={{ color: "var(--stayo-danger)" }} role="alert">
            Não foi possível salvar.
          </span>
        )}
      </div>
    </Drawer>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
        style={{ ...surface, color: "var(--stayo-ink)" }}
      />
    </label>
  );
}
