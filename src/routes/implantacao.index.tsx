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
import {
  AdminActionButton,
  AdminStatusBadge,
  AdminFilterBar,
} from "@/components/admin/AdminPrimitives";
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
        <AdminActionButton type="button" onClick={() => setDrawerOpen(true)}>
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
                  <AdminStatusBadge
                    tone={
                      i.status === "ativo"
                        ? "success"
                        : i.status === "cancelado"
                          ? "danger"
                          : "info"
                    }
                  >
                    {statusLabels[i.status]}
                  </AdminStatusBadge>
                  <span className="text-[var(--admin-muted)]">{i.startDateEstimate ?? "—"}</span>
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
                      {readiness &&
                        readiness.state !== "apta" &&
                        readiness.state !== "nao_avaliada" && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px]"
                            style={{
                              backgroundColor: "var(--stayo-gold-soft)",
                              color:
                                readiness.state === "bloqueada"
                                  ? "var(--stayo-danger)"
                                  : "var(--stayo-warning)",
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

interface AdditionalOwnerForm {
  id: string;
  name: string;
  phone: string;
  document: string;
  email: string;
}

const emptyForm = {
  name: "",
  phone: "",
  email: "",
  document: "",
  ownerAddress: "",
  pixKey: "",
  bankName: "",
  responsibleUserId: "",
  additionalOwners: [] as AdditionalOwnerForm[],
  condominiumId: "",
  condominiumName: "",
  tower: "",
  hasTower: false,
  unit: "",
  city: "",
  address: "",
  parkingBox: "",
  wifiNetwork: "",
  wifiPassword: "",
  lockPassword: "",
  observations: "",
  coverImage: "",
  condominiumCover: "",
  ...DEFAULT_QUICK_IMPLEMENTATION_CONDITIONS,
};

type IntakeForm = typeof emptyForm;

function NewImplementationDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const auth = useAuthSession();
  const defaultsQuery = useQuery(commercialTermDefaultsQuery());
  const [form, setForm] = useState<IntakeForm>(emptyForm);
  const [editingConditions, setEditingConditions] = useState(false);
  const [showOwnerExtras, setShowOwnerExtras] = useState(false);
  const [showPropertyExtras, setShowPropertyExtras] = useState(false);
  const [condoQuery, setCondoQuery] = useState("");
  const [condoPrompt, setCondoPrompt] = useState(false);
  const [condoDraft, setCondoDraft] = useState({ name: "", address: "", city: "" });
  const [uploading, setUploading] = useState<"property" | "condominium" | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const restored = useRef(false);

  const condominiumsQuery = useQuery({
    queryKey: ["admin", "condominiums", condoQuery],
    queryFn: () => adminApi.condominiums.list(condoQuery),
    enabled: open,
  });

  // Restaura rascunho ao abrir — o cadastro nunca se perde ao fechar sem querer.
  useEffect(() => {
    if (!open || restored.current) return;
    restored.current = true;
    const draft = readImplementationIntakeDraft<IntakeForm>();
    if (draft) {
      setForm({ ...emptyForm, ...draft });
      setCondoQuery(draft.condominiumName ?? "");
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      restored.current = false;
      return;
    }
    const administrationDefault = defaultsQuery.data?.find(
      (term) =>
        term.chargeType === "percentage" && term.label.toLocaleLowerCase("pt-BR").includes("admin"),
    );
    setForm((current) => ({
      ...current,
      responsibleUserId: current.responsibleUserId || auth.profile?.id || "",
      administrationFee: administrationDefault
        ? String(administrationDefault.value)
        : current.administrationFee,
    }));
  }, [auth.profile?.id, defaultsQuery.data, open]);

  // Autosalvamento do rascunho a cada alteração.
  useEffect(() => {
    if (!open) return;
    saveImplementationIntakeDraft(form);
  }, [form, open]);

  const mutation = useMutation({
    mutationFn: async (input: IntakeForm) => {
      const owner = await adminApi.owners.findOrCreateByPhone({
        name: input.name.trim(),
        phone: input.phone.trim() || null,
        email: input.email.trim() || null,
        document: input.document.trim() || null,
      });

      const additional = [] as Array<{ ownerId: string; role: string }>;
      for (const extra of input.additionalOwners) {
        if (!extra.name.trim()) continue;
        const created = await adminApi.owners.findOrCreateByPhone({
          name: extra.name.trim(),
          phone: extra.phone.trim() || null,
          email: extra.email.trim() || null,
          document: extra.document.trim() || null,
        });
        additional.push({ ownerId: created.id, role: "coproprietario" });
      }

      let condominiumId = input.condominiumId;
      if (!condominiumId && input.condominiumName.trim()) {
        const condo = await adminApi.condominiums.create({
          name: input.condominiumName.trim(),
          address: null,
          city: input.city.trim() || null,
          coverImage: input.condominiumCover || null,
        });
        condominiumId = condo.id;
      }

      const created = await coreApi.implementations.create({
        status: "prospect",
        ownerId: owner.id,
        ownerName: owner.name,
        ownerPhone: owner.phone,
        ownerAddress: input.ownerAddress.trim() || null,
        additionalOwners: additional,
        nickname: null,
        condominiumId: condominiumId || null,
        condominiumName: input.condominiumName.trim() || null,
        tower: input.hasTower ? input.tower.trim() || null : null,
        unit: input.unit.trim() || null,
        address: input.address.trim() || null,
        postalCode: null,
        city: input.city.trim() || null,
        propertyType: null,
        bedrooms: null,
        capacity: null,
        startDateEstimate: null,
        responsibleUserId: input.responsibleUserId || null,
        coverImage: input.coverImage || input.condominiumCover || null,
        parkingBox: input.parkingBox.trim() || null,
        wifiNetwork: input.wifiNetwork.trim() || null,
        wifiPassword: input.wifiPassword.trim() || null,
        lockPassword: input.lockPassword.trim() || null,
        observations: input.observations.trim() || null,
        administrationFee: input.administrationFee,
        cleaningResponsibility: cleaningResponsibilityText(input),
        payoutRule: input.payoutRule.trim(),
        maintenanceLimit: input.maintenanceLimit,
        exclusivity: input.exclusivity,
        durationMonths: input.durationMonths,
        noticePeriodDays: input.noticePeriodDays,
        notes: null,
      } as Parameters<typeof coreApi.implementations.create>[0]);

      await adminApi.commercialTerms.cloneDefaults(created.id).catch(() => []);

      if (isSupabaseConfigured() && (input.pixKey.trim() || input.bankName.trim())) {
        await supabase.from("owner_payout_accounts").insert({
          implementation_id: created.id,
          bank_name: input.bankName.trim() || null,
          account_holder: input.name.trim() || null,
          holder_tax_id: input.document.trim() || null,
          pix_key: input.pixKey.trim() || null,
          is_primary: true,
        });
      }

      return created;
    },
    onSuccess: async (created) => {
      queryClient.setQueryData(implementationsListQuery().queryKey, (prev) => ({
        data: [created, ...(prev?.data ?? [])],
        nextCursor: prev?.nextCursor ?? null,
      }));
      queryClient.setQueryData(["implementations", "detail", created.id], created);
      clearImplementationIntakeDraft();
      setForm(emptyForm);
      setCondoQuery("");
      setEditingConditions(false);
      onClose();
      await navigate({ to: "/implantacao/$id", params: { id: created.id } });
    },
  });

  const set = (key: keyof IntakeForm) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const pickCover = async (file: File, kind: "property" | "condominium") => {
    setUploadError(null);
    setUploading(kind);
    try {
      const path = await uploadImplementationCover(file, kind);
      if (path) {
        setForm((f) =>
          kind === "property" ? { ...f, coverImage: path } : { ...f, condominiumCover: path },
        );
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Não foi possível enviar a imagem.");
    } finally {
      setUploading(null);
    }
  };

  const condominiumOptions = (condominiumsQuery.data ?? []).slice(0, 5);
  const exactMatch = condominiumOptions.some(
    (item) =>
      item.name.toLocaleLowerCase("pt-BR").trim() ===
      condoQuery.toLocaleLowerCase("pt-BR").trim(),
  );

  const steps: WizardStep[] = [
    {
      id: "proprietario",
      label: "Proprietário",
      isValid: form.name.trim() !== "" && form.phone.trim() !== "",
      content: (
        <div className="flex flex-col gap-3">
          <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
            Só o essencial agora. O restante pode ser completado depois.
          </p>
          <TextField label="Nome completo" value={form.name} onChange={set("name")} required />
          <TextField
            label="Telefone (WhatsApp)"
            value={form.phone}
            onChange={(value) => set("phone")(formatBrazilianPhone(value))}
            inputMode="tel"
            required
          />
          <Expandable
            open={showOwnerExtras}
            onToggle={() => setShowOwnerExtras((v) => !v)}
            label="Dados complementares"
            hint="E-mail, CPF, endereço, Pix e banco"
          >
            <TextField label="E-mail" value={form.email} onChange={set("email")} />
            <TextField label="CPF/CNPJ" value={form.document} onChange={set("document")} />
            <TextField label="Endereço" value={form.ownerAddress} onChange={set("ownerAddress")} />
            <TextField label="Chave Pix" value={form.pixKey} onChange={set("pixKey")} />
            <TextField label="Banco" value={form.bankName} onChange={set("bankName")} />

            <div className="flex flex-col gap-3">
              {form.additionalOwners.map((extra, index) => (
                <div
                  key={extra.id}
                  className="flex flex-col gap-2 rounded-[var(--radius-card)] border p-3"
                  style={{ borderColor: "var(--stayo-border)" }}
                >
                  <div className="flex items-center justify-between">
                    <strong className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                      Proprietário {index + 2}
                    </strong>
                    <button
                      type="button"
                      aria-label="Remover proprietário"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          additionalOwners: f.additionalOwners.filter((o) => o.id !== extra.id),
                        }))
                      }
                      style={{ color: "var(--stayo-danger)" }}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  {(["name", "phone", "document", "email"] as const).map((field) => (
                    <TextField
                      key={field}
                      label={
                        field === "name"
                          ? "Nome"
                          : field === "phone"
                            ? "Telefone"
                            : field === "document"
                              ? "CPF/CNPJ"
                              : "E-mail"
                      }
                      value={extra[field]}
                      onChange={(value) =>
                        setForm((f) => ({
                          ...f,
                          additionalOwners: f.additionalOwners.map((o) =>
                            o.id === extra.id
                              ? {
                                  ...o,
                                  [field]: field === "phone" ? formatBrazilianPhone(value) : value,
                                }
                              : o,
                          ),
                        }))
                      }
                    />
                  ))}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 self-start"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    additionalOwners: [
                      ...f.additionalOwners,
                      {
                        id: crypto.randomUUID(),
                        name: "",
                        phone: "",
                        document: "",
                        email: "",
                      },
                    ],
                  }))
                }
              >
                <Plus className="size-3.5" />
                Adicionar proprietário
              </Button>
            </div>
          </Expandable>
        </div>
      ),
    },
    {
      id: "imovel",
      label: "Imóvel",
      isValid: form.condominiumName.trim() !== "" && form.unit.trim() !== "",
      content: (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <TextField
              label="Condomínio"
              value={condoQuery}
              onChange={(value) => {
                setCondoQuery(value);
                setForm((f) => ({ ...f, condominiumId: "", condominiumName: value }));
              }}
              required
            />
            {condoQuery.trim().length >= 2 && !form.condominiumId && (
              <div
                className="mt-1 overflow-hidden rounded-[var(--radius-card)] border"
                style={{ borderColor: "var(--stayo-border)" }}
              >
                {condominiumOptions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full flex-col items-start px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--stayo-surface-muted,rgba(0,0,0,0.04))]"
                    onClick={() => {
                      setCondoQuery(item.name);
                      setForm((f) => ({
                        ...f,
                        condominiumId: item.id,
                        condominiumName: item.name,
                        city: f.city || item.city || "",
                        address: f.address || item.address || "",
                      }));
                    }}
                  >
                    <span style={{ color: "var(--stayo-ink)" }}>{item.name}</span>
                    <span className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                      {[item.city, item.status === "pending" ? "cadastro pendente" : null]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </span>
                  </button>
                ))}
                {!exactMatch && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                    style={{ color: "var(--stayo-forest)" }}
                    onClick={() => {
                      setCondoDraft({ name: condoQuery, address: "", city: form.city });
                      setCondoPrompt(true);
                    }}
                  >
                    <Plus className="size-3.5" />
                    Cadastrar “{condoQuery}” agora
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {form.hasTower ? (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <TextField label="Torre" value={form.tower} onChange={set("tower")} />
                </div>
                <button
                  type="button"
                  aria-label="Remover torre"
                  className="mb-2"
                  onClick={() => setForm((f) => ({ ...f, hasTower: false, tower: "" }))}
                  style={{ color: "var(--stayo-danger)" }}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-5 gap-1.5"
                onClick={() => setForm((f) => ({ ...f, hasTower: true }))}
              >
                <Plus className="size-3.5" />
                Torre
              </Button>
            )}
            <TextField label="Unidade" value={form.unit} onChange={set("unit")} required />
          </div>
          <TextField label="Cidade" value={form.city} onChange={set("city")} />

          <CoverPicker
            label="Foto do imóvel"
            value={form.coverImage}
            busy={uploading === "property"}
            onPick={(file) => pickCover(file, "property")}
            onClear={() => setForm((f) => ({ ...f, coverImage: "" }))}
          />
          <CoverPicker
            label="Foto do condomínio"
            value={form.condominiumCover}
            busy={uploading === "condominium"}
            onPick={(file) => pickCover(file, "condominium")}
            onClear={() => setForm((f) => ({ ...f, condominiumCover: "" }))}
          />
          {uploadError && (
            <span className="text-xs" style={{ color: "var(--stayo-danger)" }} role="alert">
              {uploadError}
            </span>
          )}

          <Expandable
            open={showPropertyExtras}
            onToggle={() => setShowPropertyExtras((v) => !v)}
            label="Acesso e detalhes"
            hint="Vaga/box, Wi-Fi, fechadura e observações"
          >
            <TextField label="Vaga/Box" value={form.parkingBox} onChange={set("parkingBox")} />
            <TextField label="Rede Wi-Fi" value={form.wifiNetwork} onChange={set("wifiNetwork")} />
            <TextField
              label="Senha do Wi-Fi"
              value={form.wifiPassword}
              onChange={set("wifiPassword")}
            />
            <TextField
              label="Senha da fechadura"
              value={form.lockPassword}
              onChange={set("lockPassword")}
            />
            <TextField
              label="Observações"
              value={form.observations}
              onChange={set("observations")}
            />
          </Expandable>
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditingConditions((value) => !value)}
              className="shrink-0 gap-1.5"
            >
              <Pencil className="size-3.5" />
              {editingConditions ? "Fechar" : "Alterar exceções"}
            </Button>
          </div>
          {!editingConditions ? (
            <div
              className="divide-y rounded-[var(--radius-card)] border bg-white px-4"
              style={{ borderColor: "var(--stayo-border)" }}
            >
              <ConditionSummary
                label="Taxa de administração"
                value={`${form.administrationFee}%`}
              />
              <ConditionSummary label="Taxa de limpeza" value={cleaningResponsibilityText(form)} />
              <ConditionSummary label="Forma de repasse" value={form.payoutRule} />
              <ConditionSummary
                label="Manutenção sem autorização"
                value={`Até ${formatCurrencyInput(form.maintenanceLimit)}`}
              />
              <ConditionSummary label="Exclusividade" value={form.exclusivity ? "Sim" : "Não"} />
              <ConditionSummary label="Vigência" value={`${form.durationMonths} meses`} />
              <ConditionSummary label="Aviso prévio" value={`${form.noticePeriodDays} dias`} />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField
                label="Taxa de administração (%)"
                value={form.administrationFee}
                onChange={set("administrationFee")}
                type="number"
                inputMode="decimal"
              />
              <SelectField
                label="Taxa de limpeza"
                value={form.cleaningResponsibility}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    cleaningResponsibility: value as CleaningResponsibility,
                  }))
                }
                options={Object.entries(CLEANING_RESPONSIBILITY_LABELS).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
              {form.cleaningResponsibility === "custom" && (
                <div className="sm:col-span-2">
                  <TextField
                    label="Responsabilidade personalizada"
                    value={form.customCleaningResponsibility}
                    onChange={set("customCleaningResponsibility")}
                  />
                </div>
              )}
              <div className="sm:col-span-2">
                <TextField
                  label="Forma de repasse"
                  value={form.payoutRule}
                  onChange={set("payoutRule")}
                />
              </div>
              <TextField
                label="Limite de manutenção sem autorização (R$)"
                value={form.maintenanceLimit}
                onChange={set("maintenanceLimit")}
                type="number"
                inputMode="decimal"
              />
              <SelectField
                label="Exclusividade"
                value={form.exclusivity ? "yes" : "no"}
                onChange={(value) =>
                  setForm((current) => ({ ...current, exclusivity: value === "yes" }))
                }
                options={[
                  { value: "yes", label: "Sim" },
                  { value: "no", label: "Não" },
                ]}
              />
              <TextField
                label="Vigência (meses)"
                value={form.durationMonths}
                onChange={set("durationMonths")}
                type="number"
                inputMode="numeric"
              />
              <TextField
                label="Aviso prévio (dias)"
                value={form.noticePeriodDays}
                onChange={set("noticePeriodDays")}
                type="number"
                inputMode="numeric"
              />
            </div>
          )}
          {mutation.isError && (
            <span className="text-sm" style={{ color: "var(--stayo-danger)" }} role="alert">
              {mutation.error instanceof Error
                ? mutation.error.message
                : "Não foi possível salvar."}
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
        saveImplementationIntakeDraft(form);
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
      {condoPrompt && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
          <div
            className="absolute inset-0"
            style={{ backgroundColor: "rgba(20, 23, 19, 0.5)" }}
            onClick={() => setCondoPrompt(false)}
          />
          <div
            className="relative m-4 w-full max-w-sm rounded-[var(--radius-card)] border p-4"
            style={surface}
          >
            <h3 className="text-base" style={{ color: "var(--stayo-ink)" }}>
              Cadastrar condomínio
            </h3>
            <p className="mt-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
              Informe o que souber agora. Sem endereço, o cadastro fica pendente.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <TextField
                label="Nome"
                value={condoDraft.name}
                onChange={(value) => setCondoDraft((d) => ({ ...d, name: value }))}
                required
              />
              <TextField
                label="Endereço (opcional)"
                value={condoDraft.address}
                onChange={(value) => setCondoDraft((d) => ({ ...d, address: value }))}
              />
              <TextField
                label="Cidade (opcional)"
                value={condoDraft.city}
                onChange={(value) => setCondoDraft((d) => ({ ...d, city: value }))}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCondoPrompt(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  const created = await adminApi.condominiums.create({
                    name: condoDraft.name.trim(),
                    address: condoDraft.address.trim() || null,
                    city: condoDraft.city.trim() || null,
                  });
                  setForm((f) => ({
                    ...f,
                    condominiumId: created.id,
                    condominiumName: created.name,
                    city: f.city || created.city || "",
                    address: f.address || created.address || "",
                  }));
                  setCondoQuery(created.name);
                  setCondoPrompt(false);
                  await condominiumsQuery.refetch();
                }}
              >
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}

function Expandable({
  open,
  onToggle,
  label,
  hint,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-[var(--radius-card)] border transition-colors"
      style={{ borderColor: "var(--stayo-border)" }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm"
        aria-expanded={open}
      >
        <span>
          <span className="block" style={{ color: "var(--stayo-ink)" }}>
            {label}
          </span>
          {hint && (
            <span className="block text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
              {hint}
            </span>
          )}
        </span>
        <ChevronDown
          className="size-4 shrink-0 transition-transform duration-200"
          style={{
            color: "var(--stayo-ink-muted)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>
      {open && <div className="flex flex-col gap-3 border-t px-3 py-3">{children}</div>}
    </div>
  );
}

function CoverPicker({
  label,
  value,
  busy,
  onPick,
  onClear,
}: {
  label: string;
  value: string;
  busy: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-[var(--radius-card)] border p-2.5"
      style={{ borderColor: "var(--stayo-border)" }}
    >
      <div
        className="size-12 shrink-0 overflow-hidden rounded-[var(--radius-control)] border"
        style={{ borderColor: "var(--stayo-border)" }}
      >
        <img src={fallbackCover} alt="" className="size-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm" style={{ color: "var(--stayo-ink)" }}>
          {label}
        </p>
        <p className="truncate text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
          {busy ? "Enviando…" : value ? "Imagem enviada" : "Sem foto — usamos a imagem padrão"}
        </p>
      </div>
      {value ? (
        <Button type="button" variant="outline" size="sm" onClick={onClear}>
          Remover
        </Button>
      ) : (
        <label className="cursor-pointer text-sm" style={{ color: "var(--stayo-forest)" }}>
          <span className="inline-flex items-center gap-1.5">
            <ImagePlus className="size-4" />
            Adicionar
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onPick(file);
              event.target.value = "";
            }}
          />
        </label>
      )}
    </div>
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

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
        style={{ ...surface, color: "var(--stayo-ink)" }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ConditionSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <span style={{ color: "var(--stayo-ink-muted)" }}>{label}</span>
      <strong className="text-right font-medium" style={{ color: "var(--stayo-ink)" }}>
        {value}
      </strong>
    </div>
  );
}

function formatBrazilianPhone(value: string): string {
  const digits = value
    .replace(/\D/g, "")
    .replace(/^55(?=\d{10,11}$)/, "")
    .slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCurrencyInput(value: string): string {
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed)) return "Não informado";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parsed);
}
