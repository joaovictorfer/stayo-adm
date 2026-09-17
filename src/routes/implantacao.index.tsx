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
import { Drawer } from "../components/patterns/Drawer";
import { Wizard, type WizardStep } from "../components/patterns/Wizard";
import { adminApi, coreApi, implementationsListQuery } from "../lib/api/queries";
import { alternateStatuses, mainStatusFlow, statusLabels } from "../lib/implementation-status";

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
  const [drawerOpen, setDrawerOpen] = useState(false);
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
          onClick={() => setDrawerOpen(true)}
          className="rounded-[var(--radius-control)] px-3 py-2 text-sm"
          style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
        >
          Nova implantação
        </button>
      </PageHeader>

      <NewImplementationDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

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
        )}
      </Panel>
    </>
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
