import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, SquareCheck } from "lucide-react";
import { useMemo, useState } from "react";

import {
  EmptyRows,
  ErrorRows,
  ListSkeleton,
  PageHeader,
  Panel,
  SelectFilter,
} from "../components/data/ListStates";
import { Drawer } from "../components/patterns/Drawer";
import { IndicatorCard } from "../components/patterns/IndicatorCard";
import { coreApi, inspectionsListQuery, propertiesListQuery } from "../lib/api/queries";
import { inspectionTypeLabels } from "../lib/inspection-types";
import type { Inspection, InspectionType } from "../types/core";

export const Route = createFileRoute("/vistorias/")({
  head: () => ({
    meta: [
      { title: "Vistorias — Stayo Admin" },
      { name: "description", content: "Vistorias de implantação, entrada, saída e manutenção." },
      { property: "og:title", content: "Vistorias — Stayo Admin" },
      {
        property: "og:description",
        content: "Vistorias de implantação, entrada, saída e manutenção.",
      },
    ],
  }),
  component: InspectionsPage,
});

function InspectionsPage() {
  const [type, setType] = useState("todos");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const query = useQuery(inspectionsListQuery());

  const rows = useMemo(() => {
    const data = query.data?.data ?? [];
    return type === "todos" ? data : data.filter((i) => i.type === type);
  }, [query.data, type]);

  const unassigned = rows.filter((i) => !i.responsibleUserId).length;

  return (
    <>
      <PageHeader title="Vistorias" count={query.isSuccess ? rows.length : undefined}>
        <SelectFilter
          label="Filtrar por tipo"
          value={type}
          onChange={setType}
          options={[
            { value: "todos", label: "Todos os tipos" },
            ...Object.entries(inspectionTypeLabels).map(([value, label]) => ({ value, label })),
          ]}
        />
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="rounded-[var(--radius-control)] px-3 py-2 text-sm"
          style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
        >
          Nova vistoria
        </button>
      </PageHeader>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <IndicatorCard icon={SquareCheck} label="Vistorias no filtro" value={rows.length} />
        <IndicatorCard
          icon={AlertTriangle}
          label="Sem responsável"
          value={unassigned}
          tone={unassigned > 0 ? "warning" : "neutral"}
        />
      </div>

      <Panel>
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <ErrorRows onRetry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyRows
            message={
              type === "todos"
                ? "Nenhuma vistoria registrada ainda"
                : "Nenhuma vistoria com este tipo"
            }
          />
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
            {rows.map((i) => (
              <li key={i.id}>
                <Link
                  to="/vistorias/$id"
                  params={{ id: i.id }}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"
                  style={{ color: "var(--stayo-ink)" }}
                >
                  <span className="font-medium">{inspectionTypeLabels[i.type]}</span>
                  <span style={{ color: "var(--stayo-ink-muted)" }}>
                    {i.propertyName ?? i.propertyId}
                  </span>
                  <span className="ml-auto" style={{ color: "var(--stayo-ink-muted)" }}>
                    {i.scheduledFor ?? "—"} · {i.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <NewInspectionDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

const surface = { backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" };

const emptyInspectionForm = {
  type: "entrada" as InspectionType,
  propertyId: "",
  scheduledFor: "",
  notes: "",
};

function NewInspectionDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const propertiesQuery = useQuery(propertiesListQuery());
  const [form, setForm] = useState(emptyInspectionForm);

  const properties = propertiesQuery.data?.data ?? [];

  const create = useMutation({
    mutationFn: (): Promise<Inspection> => {
      const property = properties.find((p) => p.id === form.propertyId);
      if (!property) throw new Error("Selecione um imóvel");
      return coreApi.inspections.create({
        type: form.type,
        propertyId: property.id,
        propertyName: property.name,
        implementationId: null,
        reservationId: null,
        scheduledFor: form.scheduledFor || null,
        responsibleUserId: null,
        status: "pendente",
        notes: form.notes || null,
      });
    },
    onSuccess: async () => {
      setForm(emptyInspectionForm);
      onClose();
      await queryClient.invalidateQueries({ queryKey: ["inspections"] });
    },
  });

  const set =
    <K extends keyof typeof form>(key: K) =>
    (value: (typeof form)[K]) =>
      setForm((f) => ({ ...f, [key]: value }));

  return (
    <Drawer
      open={open}
      onClose={() => {
        setForm(emptyInspectionForm);
        onClose();
      }}
      eyebrow="Vistorias"
      title="Nova vistoria"
      footer={
        <button
          type="button"
          onClick={() => create.mutate()}
          disabled={create.isPending || form.propertyId === ""}
          className="w-full rounded-[var(--radius-control)] px-3 py-2 text-sm disabled:opacity-60"
          style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
        >
          {create.isPending ? "Salvando..." : "Salvar"}
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
            Tipo
          </span>
          <select
            value={form.type}
            onChange={(e) => set("type")(e.target.value as InspectionType)}
            className="w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
            style={{ ...surface, color: "var(--stayo-ink)" }}
          >
            {Object.entries(inspectionTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
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
            <option value="">Selecione um imóvel</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
            Data prevista
          </span>
          <input
            type="date"
            value={form.scheduledFor}
            onChange={(e) => set("scheduledFor")(e.target.value)}
            className="w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
            style={{ ...surface, color: "var(--stayo-ink)" }}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
            Observações
          </span>
          <textarea
            value={form.notes}
            onChange={(e) => set("notes")(e.target.value)}
            rows={4}
            className="w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
            style={{ ...surface, color: "var(--stayo-ink)" }}
          />
        </label>
        {create.isError && (
          <span className="text-sm" style={{ color: "var(--stayo-danger)" }} role="alert">
            {create.error instanceof Error ? create.error.message : "Não foi possível salvar."}
          </span>
        )}
      </div>
    </Drawer>
  );
}
