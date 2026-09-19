import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import {
  EmptyRows,
  ErrorRows,
  ListSkeleton,
  PageHeader,
  Panel,
  SearchInput,
  SelectFilter,
} from "../components/data/ListStates";
import { Drawer } from "../components/patterns/Drawer";
import { Wizard, type WizardStep } from "../components/patterns/Wizard";
import {
  adminApi,
  coreApi,
  implementationItemsQuery,
  implementationTemplatesQuery,
  implementationsListQuery,
} from "../lib/api/queries";
import {
  alternateStatuses,
  computeReadiness,
  mainStatusFlow,
  statusLabels,
} from "../lib/implementation-status";
import type { ImplementationItem, ImplementationProject } from "../types/core";

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

const prontidaoOptions = [
  { value: "all", label: "Prontidão: todas" },
  { value: "pronta", label: "Prontas para operação" },
  { value: "pendente", label: "Com pendência (bloqueio/obrigatório aberto)" },
];

function ImplementationsPage() {
  const [status, setStatus] = useState("all");
  const [responsavel, setResponsavel] = useState("");
  const [periodoFrom, setPeriodoFrom] = useState("");
  const [periodoTo, setPeriodoTo] = useState("");
  const [prontidao, setProntidao] = useState("all");
  const [view, setView] = useState<"lista" | "funil">("lista");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const query = useQuery(implementationsListQuery());
  const data = query.data?.data ?? [];

  // Prontidão depende do checklist de cada implantação — buscado uma vez
  // por linha (dataset pequeno) para alimentar o filtro e os cartões do funil.
  const itemsQueries = useQueries({
    queries: data.map((impl) => implementationItemsQuery(impl.id)),
  });
  const readinessById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeReadiness>>();
    data.forEach((impl, index) => {
      const items = itemsQueries[index]?.data as ImplementationItem[] | undefined;
      if (items) map.set(impl.id, computeReadiness(items));
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, itemsQueries.map((q) => q.dataUpdatedAt).join(",")]);

  const rows = useMemo(() => {
    return data.filter((i) => {
      if (status !== "all" && i.status !== status) return false;
      if (
        responsavel.trim() &&
        !(i.responsibleUserId ?? "").toLowerCase().includes(responsavel.trim().toLowerCase())
      ) {
        return false;
      }
      if (periodoFrom && (!i.startDateEstimate || i.startDateEstimate < periodoFrom)) return false;
      if (periodoTo && (!i.startDateEstimate || i.startDateEstimate > periodoTo)) return false;
      if (prontidao !== "all") {
        const readiness = readinessById.get(i.id);
        if (!readiness) return false;
        if (prontidao === "pronta" && !readiness.ready) return false;
        if (prontidao === "pendente" && readiness.ready) return false;
      }
      return true;
    });
  }, [data, status, responsavel, periodoFrom, periodoTo, prontidao, readinessById]);

  const statusOptions = [
    { value: "all", label: "Todos os status" },
    ...[...mainStatusFlow, ...alternateStatuses].map((s) => ({
      value: s,
      label: statusLabels[s],
    })),
  ];

  const noRowsMessage =
    status === "all" && !responsavel && !periodoFrom && !periodoTo && prontidao === "all"
      ? "Nenhuma implantação cadastrada ainda"
      : "Nenhuma implantação com estes filtros";

  return (
    <>
      <PageHeader title="Implantações" count={query.isSuccess ? rows.length : undefined}>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="rounded-[var(--radius-control)] px-3 py-2 text-sm"
          style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
        >
          Nova implantação
        </button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SelectFilter
          label="Filtrar por status"
          value={status}
          onChange={setStatus}
          options={statusOptions}
        />
        <SearchInput
          value={responsavel}
          onChange={setResponsavel}
          placeholder="Filtrar por responsável"
        />
        <label
          className="flex items-center gap-1 text-xs"
          style={{ color: "var(--stayo-ink-muted)" }}
        >
          De
          <input
            type="date"
            value={periodoFrom}
            onChange={(e) => setPeriodoFrom(e.target.value)}
            className="rounded-[var(--radius-control)] border px-2 py-2 text-sm outline-none"
            style={{ ...surface, color: "var(--stayo-ink)" }}
          />
        </label>
        <label
          className="flex items-center gap-1 text-xs"
          style={{ color: "var(--stayo-ink-muted)" }}
        >
          Até
          <input
            type="date"
            value={periodoTo}
            onChange={(e) => setPeriodoTo(e.target.value)}
            className="rounded-[var(--radius-control)] border px-2 py-2 text-sm outline-none"
            style={{ ...surface, color: "var(--stayo-ink)" }}
          />
        </label>
        <SelectFilter
          label="Filtrar por prontidão"
          value={prontidao}
          onChange={setProntidao}
          options={prontidaoOptions}
        />
        <div
          className="ml-auto flex rounded-[var(--radius-control)] border p-0.5 text-xs"
          style={surface}
        >
          {(["lista", "funil"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className="rounded-[var(--radius-control)] px-3 py-1.5"
              style={{
                backgroundColor: view === v ? "var(--stayo-forest)" : "transparent",
                color: view === v ? "#fdfdfb" : "var(--stayo-ink-muted)",
              }}
            >
              {v === "lista" ? "Lista" : "Funil"}
            </button>
          ))}
        </div>
      </div>

      <NewImplementationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

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
          <EmptyRows message={noRowsMessage} />
        </Panel>
      ) : view === "lista" ? (
        <Panel>
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
                  <span>{i.ownerName || "—"}</span>
                  <span style={{ color: "var(--stayo-ink-muted)" }}>
                    {[i.condominiumName, i.unit].filter(Boolean).join(" · ") || "—"}
                  </span>
                  <span style={{ color: "var(--stayo-ink-muted)" }}>{statusLabels[i.status]}</span>
                  <span style={{ color: "var(--stayo-ink-muted)" }}>
                    {i.startDateEstimate ?? "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : (
        <PipelineView rows={rows} readinessById={readinessById} />
      )}
    </>
  );
}

/** Visão de funil: uma coluna por status do fluxo principal, na ordem em que acontece. */
function PipelineView({
  rows,
  readinessById,
}: {
  rows: ImplementationProject[];
  readinessById: Map<string, ReturnType<typeof computeReadiness>>;
}) {
  const columns = [...mainStatusFlow, ...alternateStatuses];

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((col) => {
        const colRows = rows.filter((r) => r.status === col);
        return (
          <div key={col} className="w-64 shrink-0">
            <div
              className="mb-2 flex items-center justify-between px-1 text-xs"
              style={{ color: "var(--stayo-ink-muted)" }}
            >
              <span className="font-medium" style={{ color: "var(--stayo-ink)" }}>
                {statusLabels[col]}
              </span>
              <span>{colRows.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {colRows.map((r) => {
                const readiness = readinessById.get(r.id);
                return (
                  <Link
                    key={r.id}
                    to="/implantacao/$id"
                    params={{ id: r.id }}
                    className="block rounded-[var(--radius-card)] border p-3 text-sm"
                    style={{ ...surface, color: "var(--stayo-ink)" }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{r.code}</span>
                      {readiness && !readiness.ready && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px]"
                          style={{
                            backgroundColor: "var(--stayo-gold-soft)",
                            color: "var(--stayo-warning)",
                          }}
                        >
                          Pendente
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                      {r.ownerName || "—"}
                    </p>
                    <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                      {[r.condominiumName, r.unit].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </Link>
                );
              })}
              {colRows.length === 0 && (
                <p className="px-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                  Vazio
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const emptyForm = {
  name: "",
  phone: "",
  condominiumName: "",
  unit: "",
  nickname: "",
  city: "",
  address: "",
  postalCode: "",
  propertyType: "",
  bedrooms: "",
  capacity: "",
  startDateEstimate: "",
  responsibleUserId: "",
  notes: "",
};

function NewImplementationDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [templateId, setTemplateId] = useState("");
  const templatesQ = useQuery(implementationTemplatesQuery());


  const mutation = useMutation({
    mutationFn: async (input: typeof form) => {
      const owner = await adminApi.owners.findOrCreateByPhone({
        name: input.name,
        phone: input.phone,
        email: null,
      });
      return coreApi.implementations.create({
        status: "prospect",
        ownerId: owner.id,
        ownerName: owner.name,
        ownerPhone: owner.phone,
        nickname: input.nickname || null,
        condominiumName: input.condominiumName || null,
        unit: input.unit || null,
        address: input.address || null,
        postalCode: input.postalCode || null,
        city: input.city || null,
        propertyType: input.propertyType || null,
        bedrooms: input.bedrooms ? Number.parseInt(input.bedrooms, 10) : null,
        capacity: input.capacity ? Number.parseInt(input.capacity, 10) : null,
        startDateEstimate: input.startDateEstimate || null,
        responsibleUserId: input.responsibleUserId || null,
        notes: input.notes || null,
      });
    },
    onSuccess: async (created) => {
      queryClient.setQueryData(implementationsListQuery().queryKey, (prev) => ({
        data: [created, ...(prev?.data ?? [])],
        nextCursor: prev?.nextCursor ?? null,
      }));
      queryClient.setQueryData(["implementations", "detail", created.id], created);
      await adminApi.commercialTerms.cloneDefaults(created.id);
      setForm(emptyForm);
      onClose();
    },
  });

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const steps: WizardStep[] = [
    {
      id: "proprietario",
      label: "Proprietário",
      isValid: form.name.trim() !== "" && form.phone.trim() !== "",
      content: (
        <div className="flex flex-col gap-3">
          <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
            Cadastro rápido — feito durante a ligação. O restante é completado depois.
          </p>
          <TextField label="Proprietário" value={form.name} onChange={set("name")} required />
          <TextField label="Telefone" value={form.phone} onChange={set("phone")} required />
        </div>
      ),
    },
    {
      id: "imovel",
      label: "Imóvel",
      content: (
        <div className="flex flex-col gap-3">
          <TextField label="Apelido" value={form.nickname} onChange={set("nickname")} />
          <TextField
            label="Condomínio"
            value={form.condominiumName}
            onChange={set("condominiumName")}
          />
          <TextField label="Unidade" value={form.unit} onChange={set("unit")} />
          <TextField label="Cidade" value={form.city} onChange={set("city")} />
          <TextField label="Endereço" value={form.address} onChange={set("address")} />
          <TextField label="CEP" value={form.postalCode} onChange={set("postalCode")} />
          <TextField
            label="Tipo do imóvel"
            value={form.propertyType}
            onChange={set("propertyType")}
          />
          <TextField
            label="Quartos"
            type="number"
            value={form.bedrooms}
            onChange={set("bedrooms")}
          />
          <TextField
            label="Capacidade"
            type="number"
            value={form.capacity}
            onChange={set("capacity")}
          />
        </div>
      ),
    },
    {
      id: "planejamento",
      label: "Planejamento",
      content: (
        <div className="flex flex-col gap-3">
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
          <TextField label="Observação" value={form.notes} onChange={set("notes")} />
          {mutation.isError && (
            <span className="text-sm" style={{ color: "var(--stayo-danger)" }} role="alert">
              Não foi possível salvar.
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <Drawer
      open={open}
      onClose={() => {
        setForm(emptyForm);
        onClose();
      }}
      eyebrow="Implantação"
      title="Nova implantação"
    >
      <Wizard
        steps={steps}
        completeLabel="Salvar implantação"
        submitting={mutation.isPending}
        onComplete={() => mutation.mutate(form)}
      />
    </Drawer>
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
