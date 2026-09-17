import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import {
  EmptyRows,
  ErrorRows,
  ListSkeleton,
  PageHeader,
  Panel,
  SelectFilter,
} from "../components/data/ListStates";
import { coreApi, implementationsListQuery } from "../lib/api/queries";
import {
  alternateStatuses,
  mainStatusFlow,
  nextImplementationCode,
  statusLabels,
} from "../lib/implementation-status";
import type { ImplementationProject } from "../types/core";

export const Route = createFileRoute("/implantacao/")({
  head: () => ({
    meta: [
      { title: "Implantações — Stayo Admin" },
      { name: "description", content: "Acompanhamento das implantações de novos imóveis." },
      { property: "og:title", content: "Implantações — Stayo Admin" },
      {
        property: "og:description",
        content: "Acompanhamento das implantações de novos imóveis.",
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
  const [status, setStatus] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const query = useQuery(implementationsListQuery());
  const data = query.data?.data ?? [];

  const rows = useMemo(
    () => (status === "all" ? data : data.filter((i) => i.status === status)),
    [data, status],
  );

  const statusOptions = [
    { value: "all", label: "Todos os status" },
    ...[...mainStatusFlow, ...alternateStatuses].map((s) => ({
      value: s,
      label: statusLabels[s],
    })),
  ];

  return (
    <>
      <PageHeader title="Implantações" count={query.isSuccess ? rows.length : undefined}>
        <SelectFilter
          label="Filtrar por status"
          value={status}
          onChange={setStatus}
          options={statusOptions}
        />
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          className="rounded-[var(--radius-control)] px-3 py-2 text-sm"
          style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
        >
          {formOpen ? "Fechar" : "Nova implantação"}
        </button>
      </PageHeader>

      {formOpen && <QuickForm existing={data} onDone={() => setFormOpen(false)} />}

      <Panel>
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <ErrorRows onRetry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyRows
            message={
              status === "all"
                ? "Nenhuma implantação cadastrada ainda"
                : "Nenhuma implantação com este status"
            }
          />
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
            {rows.map((i) => (
              <li key={i.id}>
                <Link
                  to="/implantacao/$id"
                  params={{ id: i.id }}
                  className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[7rem_1fr_1fr_10rem_7rem]"
                  style={{ color: "var(--stayo-ink)" }}
                >
                  <span className="font-medium">{i.code}</span>
                  <span>{i.ownerProspect.name || "—"}</span>
                  <span style={{ color: "var(--stayo-ink-muted)" }}>
                    {[i.condominiumName, i.unit].filter(Boolean).join(" · ") || "—"}
                  </span>
                  <span style={{ color: "var(--stayo-ink-muted)" }}>
                    {statusLabels[i.status]}
                  </span>
                  <span style={{ color: "var(--stayo-ink-muted)" }}>
                    {i.startDateEstimate ?? "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

function QuickForm({
  existing,
  onDone,
}: {
  existing: ImplementationProject[];
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    condominiumName: "",
    unit: "",
    startDateEstimate: "",
    responsibleUserId: "",
    notes: "",
  });

  const mutation = useMutation({
    mutationFn: (input: typeof form) =>
      coreApi.implementations.create({
        code: nextImplementationCode(existing.map((i) => i.code)),
        status: "prospect",
        ownerProspect: { name: input.name, phone: input.phone, email: null },
        condominiumName: input.condominiumName || null,
        unit: input.unit || null,
        startDateEstimate: input.startDateEstimate || null,
        responsibleUserId: input.responsibleUserId || null,
        notes: input.notes || null,
      }),
    onSuccess: (created) => {
      queryClient.setQueryData(implementationsListQuery().queryKey, (prev) => ({
        data: [created, ...(prev?.data ?? [])],
        nextCursor: prev?.nextCursor ?? null,
      }));
      queryClient.setQueryData(["implementations", "detail", created.id], created);
      onDone();
    },
  });

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <form
      className="mb-4 rounded-[var(--radius-card)] border p-4"
      style={surface}
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(form);
      }}
    >
      <p className="mb-3 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
        Cadastro rápido — feito durante a ligação. O restante é completado depois.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField label="Proprietário" value={form.name} onChange={set("name")} required />
        <TextField label="Telefone" value={form.phone} onChange={set("phone")} required />
        <TextField
          label="Condomínio"
          value={form.condominiumName}
          onChange={set("condominiumName")}
        />
        <TextField label="Unidade" value={form.unit} onChange={set("unit")} />
        <TextField
          label="Previsão de início"
          type="date"
          value={form.startDateEstimate}
          onChange={set("startDateEstimate")}
        />
        <TextField
          label="Responsável"
          value={form.responsibleUserId}
          onChange={set("responsibleUserId")}
        />
        <div className="sm:col-span-3">
          <TextField label="Observação" value={form.notes} onChange={set("notes")} />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-[var(--radius-control)] px-3 py-2 text-sm disabled:opacity-60"
          style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
        >
          {mutation.isPending ? "Salvando..." : "Salvar implantação"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-sm underline"
          style={{ color: "var(--stayo-ink-muted)" }}
        >
          Cancelar
        </button>
        {mutation.isError && (
          <span className="text-sm" style={{ color: "var(--stayo-danger)" }} role="alert">
            Não foi possível salvar.
          </span>
        )}
      </div>
    </form>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
        style={{ ...surface, color: "var(--stayo-ink)" }}
      />
    </label>
  );
}
