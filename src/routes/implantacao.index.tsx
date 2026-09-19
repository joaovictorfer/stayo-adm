import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ClipboardCheck, Plus } from "lucide-react";
import { z } from "zod";

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
  condominiumsListQuery,
  implementationItemsQuery,
  implementationsListQuery,
  ownersListQuery,
} from "../lib/api/queries";
import { listActiveAdminProfiles, useAuthSession } from "../lib/auth/session";
import {
  alternateStatuses,
  computeReadiness,
  mainStatusFlow,
  statusLabels,
} from "../lib/implementation-status";
import type { ImplementationItem, ImplementationProject } from "../types/core";
import type { OwnerRecord } from "../types/admin";
import { formatBrazilPhone, isValidBrazilPhone, normalizeBrazilPhone, sameBrazilPhone } from "../lib/phone";

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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
      <PageHeader title="Implantações" count={query.isSuccess ? rows.length : undefined} subtitle="Central comercial, onboarding e ativação de novos imóveis">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-brand px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-brand-hover"
        >
          <Plus size={16} /> Nova implantação
        </button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-border bg-card p-3 shadow-[var(--shadow-card)]">
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
          className="flex items-center gap-1 text-xs text-muted-foreground"
        >
          De
          <input
            type="date"
            value={periodoFrom}
            onChange={(e) => setPeriodoFrom(e.target.value)}
            className="h-10 rounded-[var(--radius-control)] border border-border bg-card px-2 text-sm text-foreground outline-none focus:border-brand"
          />
        </label>
        <label
          className="flex items-center gap-1 text-xs text-muted-foreground"
        >
          Até
          <input
            type="date"
            value={periodoTo}
            onChange={(e) => setPeriodoTo(e.target.value)}
            className="h-10 rounded-[var(--radius-control)] border border-border bg-card px-2 text-sm text-foreground outline-none focus:border-brand"
          />
        </label>
        <SelectFilter
          label="Filtrar por prontidão"
          value={prontidao}
          onChange={setProntidao}
          options={prontidaoOptions}
        />
        <div
          className="ml-auto flex rounded-[var(--radius-control)] bg-muted p-0.5 text-xs"
        >
          {(["lista", "funil"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-[var(--radius-control)] px-3 py-1.5 font-semibold ${view === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
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
          <ul className="divide-y divide-border">
            {rows.map((i) => (
              <li key={i.id}>
                <Link
                  to="/implantacao/$id"
                  params={{ id: i.id }}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 text-sm hover:bg-muted/60 sm:px-5"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><ClipboardCheck size={18} /></span>
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-2"><strong className="truncate font-semibold text-foreground">{i.nickname || [i.condominiumName, i.unit].filter(Boolean).join(" · ") || i.code}</strong><span className="hidden rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground sm:inline">{i.code}</span></span>
                    <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>{i.ownerName || "Proprietário não informado"}</span><span>{statusLabels[i.status]}</span><span>Início {i.startDateEstimate ?? "a definir"}</span></span>
                  </span>
                  <ArrowRight size={16} className="shrink-0 text-muted-foreground" />
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

const quickImplementationSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do proprietário.").max(120),
  phone: z.string().refine(isValidBrazilPhone, "Informe um telefone brasileiro válido com DDD."),
  condominiumName: z.string().trim().min(2, "Informe o condomínio ou empreendimento.").max(120),
  unit: z.string().trim().min(1, "Informe a unidade.").max(30),
  city: z.string().trim().max(100),
  startDateEstimate: z.string().regex(/^$|^\d{4}-\d{2}$/, "Informe um mês válido."),
  responsibleUserId: z.string().trim().max(100),
});

const emptyForm = {
  name: "",
  phone: "",
  condominiumName: "",
  unit: "",
  city: "",
  startDateEstimate: "",
  responsibleUserId: "",
};

function NewImplementationDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const auth = useAuthSession();
  const [form, setForm] = useState(emptyForm);
  const [ownerChoice, setOwnerChoice] = useState<"link" | "new" | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const ownersQ = useQuery(ownersListQuery());
  const condominiumsQ = useQuery(condominiumsListQuery());
  const implementationsQ = useQuery(implementationsListQuery());
  const adminsQ = useQuery({
    queryKey: ["admin-profiles", "active"],
    queryFn: listActiveAdminProfiles,
    enabled: open,
  });

  const currentResponsibleId = auth.profile?.id ?? auth.session?.user.id ?? "";
  useEffect(() => {
    if (open && !form.responsibleUserId && currentResponsibleId) {
      setForm((current) => ({ ...current, responsibleUserId: currentResponsibleId }));
    }
  }, [currentResponsibleId, form.responsibleUserId, open]);

  const normalizedPhone = normalizeBrazilPhone(form.phone);
  const duplicateOwner = useMemo(
    () => (ownersQ.data ?? []).find((owner) => sameBrazilPhone(owner.phone, normalizedPhone)) ?? null,
    [normalizedPhone, ownersQ.data],
  );
  const ownerResolved = !duplicateOwner || ownerChoice !== null;

  const condominiumSuggestions = useMemo(() => {
    const byName = new Map<string, { name: string; city: string | null }>();
    for (const condominium of condominiumsQ.data?.data ?? []) {
      byName.set(condominium.name.toLocaleLowerCase("pt-BR"), {
        name: condominium.name,
        city: condominium.city,
      });
    }
    for (const implementation of implementationsQ.data?.data ?? []) {
      if (!implementation.condominiumName) continue;
      const key = implementation.condominiumName.toLocaleLowerCase("pt-BR");
      if (!byName.has(key)) {
        byName.set(key, { name: implementation.condominiumName, city: implementation.city });
      }
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [condominiumsQ.data, implementationsQ.data]);

  const responsibleOptions = useMemo(() => {
    const byId = new Map((adminsQ.data ?? []).map((profile) => [profile.id, profile.fullName]));
    if (currentResponsibleId && !byId.has(currentResponsibleId)) {
      byId.set(
        currentResponsibleId,
        auth.profile?.fullName ?? auth.session?.user.email ?? "Usuário atual",
      );
    }
    return [...byId.entries()].map(([id, name]) => ({ id, name }));
  }, [adminsQ.data, auth.profile?.fullName, auth.session?.user.email, currentResponsibleId]);

  const validation = quickImplementationSchema.safeParse(form);
  const fieldErrors = validation.success ? {} : validation.error.flatten().fieldErrors;

  const mutation = useMutation({
    mutationFn: async (input: typeof form) => {
      const validated = quickImplementationSchema.parse(input);
      if (duplicateOwner && ownerChoice === null) throw new Error("Escolha como tratar o proprietário encontrado.");
      const owner: OwnerRecord = duplicateOwner && ownerChoice === "link"
        ? duplicateOwner
        : await adminApi.owners.create({
            name: validated.name,
            phone: normalizeBrazilPhone(validated.phone),
            email: null,
          });
      return coreApi.implementations.create({
        status: "prospect",
        ownerId: owner.id,
        ownerName: owner.name,
        ownerPhone: owner.phone,
        condominiumName: validated.condominiumName,
        unit: validated.unit,
        city: validated.city || null,
        startDateEstimate: validated.startDateEstimate ? `${validated.startDateEstimate}-01` : null,
        responsibleUserId: validated.responsibleUserId || null,
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
      setOwnerChoice(null);
      setShowErrors(false);
      onClose();
      await navigate({ to: "/implantacao/$id", params: { id: created.id } });
    },
  });

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const steps: WizardStep[] = [
    {
      id: "contato",
      label: "Contato",
      isValid:
        form.name.trim().length >= 2 &&
        isValidBrazilPhone(form.phone) &&
        ownerResolved,
      content: (
        <div className="flex flex-col gap-4">
          <div>
            <p className="font-display text-base font-semibold text-foreground">Cadastro rápido</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre apenas o essencial. As demais informações poderão ser preenchidas depois.
            </p>
          </div>
          <TextField
            label="Nome do proprietário"
            value={form.name}
            onChange={set("name")}
            required
            maxLength={120}
            error={showErrors ? fieldErrors.name?.[0] : undefined}
          />
          <TextField
            label="WhatsApp / telefone"
            value={form.phone}
            onChange={(value) => {
              set("phone")(formatBrazilPhone(value));
              setOwnerChoice(null);
            }}
            required
            inputMode="tel"
            placeholder="(54) 99999-9999"
            maxLength={15}
            error={showErrors && form.phone ? fieldErrors.phone?.[0] : undefined}
          />
          {duplicateOwner && isValidBrazilPhone(form.phone) && (
            <div className="rounded-[var(--radius-control)] border border-premium/40 bg-premium-soft p-3" role="status">
              <p className="text-sm font-semibold text-foreground">Encontramos um proprietário com este telefone.</p>
              <p className="mt-1 text-xs text-muted-foreground">{duplicateOwner.name} · {formatBrazilPhone(duplicateOwner.phone ?? "")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => setOwnerChoice("link")} className={`rounded-[var(--radius-control)] px-3 py-2 text-xs font-semibold ${ownerChoice === "link" ? "bg-brand text-primary-foreground" : "border border-border bg-card text-foreground hover:bg-muted"}`}>Vincular proprietário</button>
                <button type="button" onClick={() => setOwnerChoice("new")} className={`rounded-[var(--radius-control)] px-3 py-2 text-xs font-semibold ${ownerChoice === "new" ? "bg-brand text-primary-foreground" : "border border-border bg-card text-foreground hover:bg-muted"}`}>Continuar com novo cadastro</button>
              </div>
            </div>
          )}
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Responsável interno</span>
            <select value={form.responsibleUserId} onChange={(event) => set("responsibleUserId")(event.target.value)} className="h-10 w-full rounded-[var(--radius-control)] border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/10">
              <option value="">Definir depois</option>
              {responsibleOptions.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
            </select>
          </label>
        </div>
      ),
    },
    {
      id: "imovel",
      label: "Imóvel",
      isValid: form.condominiumName.trim().length >= 2 && form.unit.trim().length > 0,
      content: (
        <div className="flex flex-col gap-4">
          <TextField
            label="Condomínio / empreendimento"
            value={form.condominiumName}
            onChange={(value) => {
              set("condominiumName")(value);
              const match = condominiumSuggestions.find((item) => item.name.toLocaleLowerCase("pt-BR") === value.trim().toLocaleLowerCase("pt-BR"));
              if (match?.city && !form.city) set("city")(match.city);
            }}
            required
            list="condominium-suggestions"
            placeholder="Digite para buscar ou informar um novo"
            maxLength={120}
            error={showErrors ? fieldErrors.condominiumName?.[0] : undefined}
          />
          <datalist id="condominium-suggestions">
            {condominiumSuggestions.map((item) => <option key={item.name} value={item.name}>{item.city ?? "Empreendimento existente"}</option>)}
          </datalist>
          <TextField
            label="Unidade"
            value={form.unit}
            onChange={set("unit")}
            required
            placeholder="Ex.: G304"
            maxLength={30}
            error={showErrors ? fieldErrors.unit?.[0] : undefined}
          />
          <TextField label="Cidade" value={form.city} onChange={set("city")} placeholder="Ex.: Gramado" maxLength={100} />
          <TextField
            label="Previsão inicial"
            type="month"
            value={form.startDateEstimate}
            onChange={set("startDateEstimate")}
            hint="Opcional — informe apenas o mês aproximado."
          />
          {mutation.isError && (
            <span className="text-sm text-destructive" role="alert">Não foi possível criar a implantação. Tente novamente.</span>
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
        setOwnerChoice(null);
        setShowErrors(false);
        onClose();
      }}
      eyebrow="Cadastro rápido"
      title="Nova implantação"
    >
      <Wizard
        steps={steps}
        completeLabel="Criar implantação"
        submitting={mutation.isPending}
        onComplete={() => {
          setShowErrors(true);
          if (validation.success && ownerResolved) mutation.mutate(form);
        }}
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
  placeholder,
  maxLength,
  inputMode,
  list,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string | undefined;
  maxLength?: number | undefined;
  inputMode?: "text" | "tel" | undefined;
  list?: string | undefined;
  error?: string | undefined;
  hint?: string | undefined;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}{required ? " *" : ""}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode={inputMode}
        list={list}
        aria-invalid={Boolean(error)}
        onChange={(e) => onChange(e.target.value)}
        className={`h-10 w-full rounded-[var(--radius-control)] border bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-brand/10 ${error ? "border-destructive" : "border-border"}`}
      />
      {error ? <span className="mt-1 block text-xs text-destructive" role="alert">{error}</span> : null}
      {!error && hint ? <span className="mt-1 block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}
