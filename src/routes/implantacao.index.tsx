import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Pencil } from "lucide-react";

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
import { Button } from "../components/ui/button";
import { AdminActionButton, AdminStatusBadge, AdminFilterBar } from "@/components/admin/AdminPrimitives";
import {
  CLEANING_RESPONSIBILITY_LABELS,
  DEFAULT_QUICK_IMPLEMENTATION_CONDITIONS,
  cleaningResponsibilityText,
  type CleaningResponsibility,
} from "../config/commercial-defaults";
import { useAuthSession } from "../lib/auth/session";
import {
  adminApi,
  commercialTermDefaultsQuery,
  coreApi,
  implementationItemsQuery,
  implementationsListQuery,
} from "../lib/api/queries";
import {
  alternateStatuses,
  computeReadiness,
  mainStatusFlow,
  readinessLabels,
  statusLabels,
} from "../lib/implementation-status";
import { supabase } from "../integrations/supabase/client";
import { isSupabaseConfigured } from "../lib/api/supabase-client";
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
  { value: "nao_avaliada", label: "Não avaliada (sem requisitos)" },
  { value: "apta", label: "Apta para operação" },
  { value: "com_pendencias", label: "Com pendências" },
  { value: "bloqueada", label: "Bloqueada" },
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
        if (prontidao !== readiness.state) return false;
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
        <AdminActionButton
          type="button"
          onClick={() => setDrawerOpen(true)}
        >
          Nova implantação
        </AdminActionButton>
      </PageHeader>

      <AdminFilterBar className="mb-4">
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
        <div className="ml-auto flex rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-0.5 text-xs">
          {(["lista", "funil"] as const).map((v) => (
            <Button
              key={v}
              type="button"
              variant="ghost"
              onClick={() => setView(v)}
              className={`h-7 rounded-[calc(var(--admin-radius)-2px)] px-3 text-xs ${view === v ? "bg-[var(--admin-primary)] text-[var(--primary-foreground)] hover:bg-[var(--admin-primary-hover)] hover:text-[var(--primary-foreground)]" : "text-[var(--admin-muted)]"}`}
            >
              {v === "lista" ? "Lista" : "Funil"}
            </Button>
          ))}
        </div>
      </AdminFilterBar>

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
          <ul className="divide-y divide-[var(--admin-border)]">
            {rows.map((i) => (
              <li key={i.id}>
                <Link
                  to="/implantacao/$id"
                  params={{ id: i.id }}
                  className="admin-data-row grid gap-2 text-sm sm:grid-cols-[7rem_1fr_1fr_10rem_7rem]"
                >
                  <span className="font-medium">{i.code}</span>
                  <span>{i.ownerName || "—"}</span>
                  <span className="text-[var(--admin-muted)]">
                    {[i.condominiumName, i.unit].filter(Boolean).join(" · ") || "—"}
                  </span>
                  <AdminStatusBadge tone={i.status === "ativo" ? "success" : i.status === "cancelado" ? "danger" : "info"}>{statusLabels[i.status]}</AdminStatusBadge>
                  <span className="text-[var(--admin-muted)]">
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
                      {readiness && readiness.state !== "apta" && readiness.state !== "nao_avaliada" && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px]"
                          style={{
                            backgroundColor: "var(--stayo-gold-soft)",
                            color: readiness.state === "bloqueada" ? "var(--stayo-danger)" : "var(--stayo-warning)",
                          }}
                        >
                          {readinessLabels[readiness.state]}
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
  responsibleUserId: "",
  condominiumName: "",
  unit: "",
  city: "",
  ...DEFAULT_QUICK_IMPLEMENTATION_CONDITIONS,
};

function NewImplementationDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const auth = useAuthSession();
  const defaultsQuery = useQuery(commercialTermDefaultsQuery());
  const [form, setForm] = useState(emptyForm);
  const [editingConditions, setEditingConditions] = useState(false);

  useEffect(() => {
    if (!open) return;
    const administrationDefault = defaultsQuery.data?.find(
      (term) => term.chargeType === "percentage" && term.label.toLocaleLowerCase("pt-BR").includes("admin"),
    );
    setForm((current) => ({
      ...current,
      responsibleUserId: current.responsibleUserId || auth.profile?.id || "",
      administrationFee: administrationDefault ? String(administrationDefault.value) : current.administrationFee,
    }));
  }, [auth.profile?.id, defaultsQuery.data, open]);

  const mutation = useMutation({
    mutationFn: async (input: typeof form) => {
      const owner = await adminApi.owners.findOrCreateByPhone({
        name: input.name,
        phone: input.phone,
        email: null,
      });

      const condicoesText = [
        `Taxa de administração: ${input.administrationFee}%`,
        `Limpeza: ${cleaningResponsibilityText(input)}`,
        `Repasse: ${input.payoutRule}`,
        `Limite de manutenção: R$ ${input.maintenanceLimit}`,
        `Exclusividade: ${input.exclusivity ? "Sim" : "Não"}`,
        `Vigência: ${input.durationMonths} meses`,
        `Aviso prévio: ${input.noticePeriodDays} dias`,
      ].join("\n");

      const created = await coreApi.implementations.create({
        status: "prospect",
        ownerId: owner.id,
        ownerName: owner.name,
        ownerPhone: owner.phone,
        nickname: null,
        condominiumName: input.condominiumName || null,
        unit: input.unit || null,
        address: null,
        postalCode: null,
        city: input.city || null,
        propertyType: null,
        bedrooms: null,
        capacity: null,
        startDateEstimate: null,
        responsibleUserId: input.responsibleUserId || null,
        notes: condicoesText,
      });

      const clonedTerms = await adminApi.commercialTerms.cloneDefaults(created.id);
      const administrationTerm = clonedTerms.find(
        (term) => term.chargeType === "percentage" && term.label.toLocaleLowerCase("pt-BR").includes("admin"),
      );
      if (administrationTerm && administrationTerm.value !== Number(input.administrationFee)) {
        await adminApi.commercialTerms.update(administrationTerm.id, {
          value: Number(input.administrationFee),
        });
      }

      if (isSupabaseConfigured()) {
        const { error } = await supabase.from("implementation_contract_conditions").upsert({
          implementation_id: created.id,
          administration_fee: Number(input.administrationFee),
          cleaning_responsibility: cleaningResponsibilityText(input),
          payout_rule: input.payoutRule.trim(),
          maintenance_limit: Number(input.maintenanceLimit),
          exclusivity: input.exclusivity,
          duration_months: Number(input.durationMonths),
          notice_period_days: Number(input.noticePeriodDays),
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
      }

      return created;
    },
    onSuccess: async (created) => {
      queryClient.setQueryData(implementationsListQuery().queryKey, (prev) => ({
        data: [created, ...(prev?.data ?? [])],
        nextCursor: prev?.nextCursor ?? null,
      }));
      queryClient.setQueryData(["implementations", "detail", created.id], created);
      setForm(emptyForm);
      setEditingConditions(false);
      onClose();
      await navigate({ to: "/implantacao/$id", params: { id: created.id } });
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
            Dados principais do proprietário e responsável.
          </p>
          <TextField label="Nome" value={form.name} onChange={set("name")} required />
           <TextField label="WhatsApp" value={form.phone} onChange={(value) => set("phone")(formatBrazilianPhone(value))} inputMode="tel" required />
           <TextField label="Responsável interno" value={auth.profile?.fullName && form.responsibleUserId === auth.profile.id ? auth.profile.fullName : form.responsibleUserId} onChange={set("responsibleUserId")} />
        </div>
      ),
    },
    {
      id: "imovel",
      label: "Imóvel",
      content: (
        <div className="flex flex-col gap-3">
          <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
            Identificação básica do local.
          </p>
          <TextField
            label="Condomínio"
            value={form.condominiumName}
            onChange={set("condominiumName")}
          />
          <TextField label="Unidade" value={form.unit} onChange={set("unit")} />
          <TextField label="Cidade" value={form.city} onChange={set("city")} />
        </div>
      ),
    },
    {
      id: "condicoes",
      label: "Condições",
      content: (
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
              Condições padrão Stayo já aplicadas. Altere somente se houver exceção.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditingConditions((value) => !value)} className="shrink-0 gap-1.5">
              <Pencil className="size-3.5" />
              {editingConditions ? "Fechar" : "Alterar exceções"}
            </Button>
          </div>
          {!editingConditions ? (
            <div className="divide-y rounded-[var(--radius-card)] border bg-white px-4" style={{ borderColor: "var(--stayo-border)" }}>
              <ConditionSummary label="Taxa de administração" value={`${form.administrationFee}%`} />
              <ConditionSummary label="Taxa de limpeza" value={cleaningResponsibilityText(form)} />
              <ConditionSummary label="Forma de repasse" value={form.payoutRule} />
              <ConditionSummary label="Manutenção sem autorização" value={`Até ${formatCurrencyInput(form.maintenanceLimit)}`} />
              <ConditionSummary label="Exclusividade" value={form.exclusivity ? "Sim" : "Não"} />
              <ConditionSummary label="Vigência" value={`${form.durationMonths} meses`} />
              <ConditionSummary label="Aviso prévio" value={`${form.noticePeriodDays} dias`} />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField label="Taxa de administração (%)" value={form.administrationFee} onChange={set("administrationFee")} type="number" inputMode="decimal" />
              <SelectField label="Taxa de limpeza" value={form.cleaningResponsibility} onChange={(value) => setForm((current) => ({ ...current, cleaningResponsibility: value as CleaningResponsibility }))} options={Object.entries(CLEANING_RESPONSIBILITY_LABELS).map(([value, label]) => ({ value, label }))} />
              {form.cleaningResponsibility === "custom" && <div className="sm:col-span-2"><TextField label="Responsabilidade personalizada" value={form.customCleaningResponsibility} onChange={set("customCleaningResponsibility")} /></div>}
              <div className="sm:col-span-2"><TextField label="Forma de repasse" value={form.payoutRule} onChange={set("payoutRule")} /></div>
              <TextField label="Limite de manutenção sem autorização (R$)" value={form.maintenanceLimit} onChange={set("maintenanceLimit")} type="number" inputMode="decimal" />
              <SelectField label="Exclusividade" value={form.exclusivity ? "yes" : "no"} onChange={(value) => setForm((current) => ({ ...current, exclusivity: value === "yes" }))} options={[{ value: "yes", label: "Sim" }, { value: "no", label: "Não" }]} />
              <TextField label="Vigência (meses)" value={form.durationMonths} onChange={set("durationMonths")} type="number" inputMode="numeric" />
              <TextField label="Aviso prévio (dias)" value={form.noticePeriodDays} onChange={set("noticePeriodDays")} type="number" inputMode="numeric" />
            </div>
          )}
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
        setEditingConditions(false);
        onClose();
      }}
      eyebrow="Implantação"
      title="Nova implantação"
    >
      <Wizard
        steps={steps}
        completeLabel="Criar implantação"
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
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  inputMode?: "text" | "tel" | "numeric" | "decimal";
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
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
        style={{ ...surface, color: "var(--stayo-ink)" }}
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs" style={{ color: "var(--stayo-ink-muted)" }}>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none" style={{ ...surface, color: "var(--stayo-ink)" }}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function ConditionSummary({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 py-2.5 text-sm"><span style={{ color: "var(--stayo-ink-muted)" }}>{label}</span><strong className="text-right font-medium" style={{ color: "var(--stayo-ink)" }}>{value}</strong></div>;
}

function formatBrazilianPhone(value: string): string {
  const digits = value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCurrencyInput(value: string): string {
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed)) return "Não informado";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parsed);
}
