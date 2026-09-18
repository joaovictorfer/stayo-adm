import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Calendar, FileText, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  DetailSkeleton,
  ErrorRows,
  Field,
  NotFoundPanel,
  PageHeader,
} from "../components/data/ListStates";
import { IndicatorCard } from "../components/patterns/IndicatorCard";
import { LinkedField } from "../components/patterns/LinkedField";
import { Timeline, type TimelineEntry } from "../components/patterns/Timeline";
import {
  deleteOwnerAttachment,
  getAttachmentSignedUrl,
  isAttachmentsAvailable,
  listOwnerAttachments,
  uploadOwnerAttachment,
} from "../lib/api/attachments";
import { ownerNotesStore } from "../lib/api/local-store";
import {
  adminApi,
  contractsListQuery,
  ownerNoteQuery,
  ownerQuery,
  ownerTasksQuery,
  payoutsListQuery,
  propertiesListQuery,
  reservationsListQuery,
  serviceInvoicesListQuery,
} from "../lib/api/queries";
import { formatMoney } from "../lib/format";
import type { OwnerLifecycleStatus, OwnerRecord, OwnerTaskStatus } from "../types/admin";
import type { Contract, Reservation, ServiceInvoice } from "../types/core";

const lifecycleLabels: Record<OwnerLifecycleStatus, string> = {
  prospect: "Prospect",
  ativo: "Ativo",
  inativo: "Inativo",
};

const surface = { backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" };

export const Route = createFileRoute("/proprietarios/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe do proprietário — Stayo Admin" },
      { name: "description", content: "Dados de contato de um proprietário Stayo." },
      { property: "og:title", content: "Detalhe do proprietário — Stayo Admin" },
      { property: "og:description", content: "Dados de contato de um proprietário Stayo." },
    ],
  }),
  component: OwnerDetailPage,
});

function OwnerDetailPage() {
  const { id } = Route.useParams();
  const query = useQuery(ownerQuery(id));
  const propertiesQuery = useQuery(propertiesListQuery());
  const contractsQuery = useQuery(contractsListQuery());
  const payoutsQuery = useQuery(payoutsListQuery());
  const invoicesQuery = useQuery(serviceInvoicesListQuery());
  const reservationsQuery = useQuery(reservationsListQuery());
  const owner = query.data;

  const properties = useMemo(
    () => (propertiesQuery.data?.data ?? []).filter((p) => p.ownerId === id),
    [propertiesQuery.data, id],
  );
  const contracts = useMemo(
    () => (contractsQuery.data?.data ?? []).filter((c) => c.ownerId === id),
    [contractsQuery.data, id],
  );
  const payouts = useMemo(
    () => (payoutsQuery.data?.data ?? []).filter((p) => p.ownerId === id),
    [payoutsQuery.data, id],
  );
  const invoices = useMemo(
    () => (invoicesQuery.data?.data ?? []).filter((i) => i.ownerId === id),
    [invoicesQuery.data, id],
  );
  const propertyIds = useMemo(() => new Set(properties.map((p) => p.id)), [properties]);
  const reservations = useMemo(
    () => (reservationsQuery.data?.data ?? []).filter((r) => propertyIds.has(r.propertyId)),
    [reservationsQuery.data, propertyIds],
  );
  const upcomingReservations = useMemo(() => {
    const now = Date.now();
    return reservations
      .filter((r) => Date.parse(r.checkin) >= now)
      .sort((a, b) => Date.parse(a.checkin) - Date.parse(b.checkin));
  }, [reservations]);

  const totalPayouts = payouts.reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const pendingInvoices = invoices.filter((i) => !i.paidAt);
  const totalPendingInvoices = pendingInvoices.reduce((sum, i) => sum + i.total, 0);

  const timeline = useMemo(
    () => buildOwnerTimeline({ contracts, invoices, reservations }),
    [contracts, invoices, reservations],
  );

  return (
    <>
      <PageHeader title={owner?.name ?? "Proprietário"}>
        <Link
          to="/proprietarios"
          className="text-sm underline"
          style={{ color: "var(--stayo-ink-muted)" }}
        >
          Voltar para proprietários
        </Link>
      </PageHeader>

      {query.isPending ? (
        <DetailSkeleton />
      ) : query.isError ? (
        <ErrorRows onRetry={() => void query.refetch()} />
      ) : !owner ? (
        <NotFoundPanel message="Proprietário não encontrado" />
      ) : (
        <div className="flex flex-col gap-4">
          <OwnerContactPanel owner={owner} />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="ID" value={owner.id} />
            <Field label="Criado em" value={owner.createdAt} />
            <Field label="Atualizado em" value={owner.updatedAt} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <IndicatorCard
              icon={Wallet}
              label="Total repassado"
              value={payoutsQuery.isPending ? "…" : (formatMoney(totalPayouts) ?? "—")}
            />
            <IndicatorCard
              icon={FileText}
              label="Faturas pendentes"
              value={
                invoicesQuery.isPending
                  ? "…"
                  : `${pendingInvoices.length} · ${formatMoney(totalPendingInvoices) ?? "—"}`
              }
              tone={pendingInvoices.length > 0 ? "warning" : "neutral"}
            />
            <IndicatorCard
              icon={Calendar}
              label="Próximas reservas"
              value={reservationsQuery.isPending ? "…" : upcomingReservations.length}
            />
          </div>

          <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
            <h2
              className="mb-3 text-sm"
              style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
            >
              Imóveis vinculados
            </h2>
            {propertiesQuery.isPending ? (
              <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                Carregando...
              </p>
            ) : properties.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                Nenhum imóvel vinculado a este proprietário ainda.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {properties.map((p) => (
                  <li key={p.id}>
                    <LinkedField to="/imoveis/$id" id={p.id} label={p.name} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
            <h2
              className="mb-3 text-sm"
              style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
            >
              Contratos
            </h2>
            {contractsQuery.isPending ? (
              <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                Carregando...
              </p>
            ) : contracts.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                Nenhum contrato vinculado a este proprietário ainda.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {contracts.map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    <LinkedField to="/contratos/$id" id={c.id} label={c.code} />
                    <span style={{ color: "var(--stayo-ink-muted)" }}>{c.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
            <h2
              className="mb-3 text-sm"
              style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
            >
              Próximas reservas
            </h2>
            {reservationsQuery.isPending ? (
              <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                Carregando...
              </p>
            ) : upcomingReservations.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                Nenhuma reserva futura nos imóveis deste proprietário.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {upcomingReservations.map((r) => {
                  const property = properties.find((p) => p.id === r.propertyId);
                  return (
                    <li key={r.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <LinkedField
                        to="/reservas/$id"
                        id={r.id}
                        label={property?.name ?? r.propertyId}
                      />
                      <span style={{ color: "var(--stayo-ink-muted)" }}>
                        {r.checkin} → {r.checkout}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
            <h2
              className="mb-3 text-sm"
              style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
            >
              Linha do tempo
            </h2>
            {contractsQuery.isPending || invoicesQuery.isPending || reservationsQuery.isPending ? (
              <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                Carregando...
              </p>
            ) : (
              <Timeline entries={timeline} />
            )}
          </div>

          <OwnerTasksPanel ownerId={id} />

          <OwnerAttachmentsPanel ownerId={id} />

          <OwnerNotesPanel ownerId={id} />
        </div>
      )}
    </>
  );
}

function buildOwnerTimeline(data: {
  contracts: Contract[];
  invoices: ServiceInvoice[];
  reservations: Reservation[];
}): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const contract of data.contracts) {
    if (contract.signedAt) {
      entries.push({
        id: `contract-${contract.id}`,
        label: `Contrato ${contract.code} assinado`,
        timestamp: contract.signedAt,
      });
    }
  }

  for (const invoice of data.invoices) {
    if (invoice.issuedAt) {
      entries.push({
        id: `invoice-issued-${invoice.id}`,
        label: `Fatura ${invoice.code} emitida — ${invoice.title}`,
        timestamp: invoice.issuedAt,
      });
    }
    if (invoice.paidAt) {
      entries.push({
        id: `invoice-paid-${invoice.id}`,
        label: `Fatura ${invoice.code} paga`,
        timestamp: invoice.paidAt,
      });
    }
  }

  for (const reservation of data.reservations) {
    entries.push({
      id: `res-${reservation.id}`,
      label: `Reserva ${reservation.externalId ?? reservation.id}: check-in ${reservation.checkin} → check-out ${reservation.checkout}`,
      timestamp: reservation.checkin,
    });
  }

  return entries.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

/** Dados de contato do proprietário — editáveis (cadastro rápido, completado depois). */
function OwnerContactPanel({ owner }: { owner: OwnerRecord }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: owner.name,
    phone: owner.phone ?? "",
    email: owner.email ?? "",
    document: owner.document ?? "",
  });

  useEffect(() => {
    setForm({
      name: owner.name,
      phone: owner.phone ?? "",
      email: owner.email ?? "",
      document: owner.document ?? "",
    });
  }, [owner]);

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["owners", "detail", owner.id] }),
      queryClient.invalidateQueries({ queryKey: ["owners", "list"] }),
    ]);

  const save = useMutation({
    mutationFn: () =>
      adminApi.owners.update(owner.id, {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        document: form.document.trim() || null,
      }),
    onSuccess: async () => {
      await invalidate();
      setEditing(false);
    },
  });

  const changeLifecycle = useMutation({
    mutationFn: (lifecycleStatus: OwnerLifecycleStatus) =>
      adminApi.owners.update(owner.id, { lifecycleStatus }),
    onSuccess: () => invalidate(),
  });

  return (
    <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2
          className="text-sm"
          style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
        >
          Dados de contato
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={owner.lifecycleStatus}
            onChange={(e) => changeLifecycle.mutate(e.target.value as OwnerLifecycleStatus)}
            disabled={changeLifecycle.isPending}
            className="rounded-[var(--radius-control)] border px-2 py-1 text-xs disabled:opacity-60"
            style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink)" }}
          >
            {(Object.keys(lifecycleLabels) as OwnerLifecycleStatus[]).map((s) => (
              <option key={s} value={s}>
                {lifecycleLabels[s]}
              </option>
            ))}
          </select>
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs underline"
              style={{ color: "var(--stayo-ink-muted)" }}
            >
              Editar
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <ContactField
            label="Nome"
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
          />
          <ContactField
            label="Telefone"
            value={form.phone}
            onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
          />
          <ContactField
            label="E-mail"
            value={form.email}
            onChange={(v) => setForm((f) => ({ ...f, email: v }))}
          />
          <ContactField
            label="CPF/CNPJ"
            value={form.document}
            onChange={(v) => setForm((f) => ({ ...f, document: v }))}
          />
          <div className="flex items-center gap-2 sm:col-span-2">
            <button
              type="button"
              onClick={() => save.mutate()}
              disabled={save.isPending || form.name.trim() === ""}
              className="rounded-[var(--radius-control)] px-3 py-2 text-sm disabled:opacity-60"
              style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
            >
              {save.isPending ? "Salvando..." : "Salvar"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-sm underline"
              style={{ color: "var(--stayo-ink-muted)" }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome" value={owner.name} />
          <Field label="Telefone" value={owner.phone} />
          <Field label="E-mail" value={owner.email} />
          <Field label="CPF/CNPJ" value={owner.document} />
        </div>
      )}
    </div>
  );
}

function ContactField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
        style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink)" }}
      />
    </label>
  );
}

const ownerTaskKindLabels: Record<string, string> = {
  banking_data: "Dado bancário",
  wifi_info: "Wi-Fi",
  regulation_document: "Documento de regularização",
  custom: "Outro",
};

const ownerTaskStatusLabels: Record<OwnerTaskStatus, string> = {
  pending: "Pendente",
  done: "Resolvida",
  dismissed: "Dispensada",
};

/**
 * "Precisamos de você" (Fase 17I) — pendências que o proprietário
 * precisa resolver, visíveis também para ele no portal. Marcar como
 * resolvida é sempre uma ação do time interno confirmando que o dado
 * chegou de verdade — a RLS nem permite o proprietário escrever aqui.
 */
function OwnerTasksPanel({ ownerId }: { ownerId: string }) {
  const queryClient = useQueryClient();
  const query = useQuery(ownerTasksQuery(ownerId));
  const [kind, setKind] = useState("banking_data");
  const [title, setTitle] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["owner-tasks", ownerId] });

  const create = useMutation({
    mutationFn: () =>
      adminApi.ownerTasks.create({
        ownerId,
        implementationId: null,
        kind,
        title: title.trim(),
        description: null,
      }),
    onSuccess: async () => {
      setTitle("");
      await invalidate();
    },
  });

  const updateStatus = useMutation({
    mutationFn: (params: { id: string; status: OwnerTaskStatus }) =>
      adminApi.ownerTasks.updateStatus(params.id, params.status),
    onSuccess: invalidate,
  });

  const tasks = query.data ?? [];
  const pending = tasks.filter((t) => t.status === "pending");

  return (
    <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
      <h2
        className="mb-3 text-sm"
        style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
      >
        Precisamos de você{" "}
        {pending.length > 0 ? `(${pending.length} pendente${pending.length === 1 ? "" : "s"})` : ""}
      </h2>

      {query.isPending ? (
        <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          Carregando...
        </p>
      ) : tasks.length === 0 ? (
        <p className="mb-3 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          Nenhuma pendência registrada.
        </p>
      ) : (
        <ul className="mb-3 divide-y text-sm" style={{ borderColor: "var(--stayo-border)" }}>
          {tasks.map((task) => (
            <li key={task.id} className="flex items-center justify-between gap-2 py-2">
              <div>
                <p>{task.title}</p>
                <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                  {ownerTaskKindLabels[task.kind] ?? task.kind} ·{" "}
                  {ownerTaskStatusLabels[task.status]}
                </p>
              </div>
              {task.status === "pending" && (
                <button
                  type="button"
                  onClick={() => updateStatus.mutate({ id: task.id, status: "done" })}
                  disabled={updateStatus.isPending}
                  className="rounded-[var(--radius-control)] border px-2 py-1 text-xs disabled:opacity-60"
                  style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-forest)" }}
                >
                  Marcar resolvida
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim() === "") return;
          create.mutate();
        }}
      >
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="rounded-[var(--radius-control)] border px-2 py-2 text-sm"
          style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink)" }}
        >
          {Object.entries(ownerTaskKindLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="O que falta?"
          className="min-w-[160px] flex-1 rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
          style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink)" }}
        />
        <button
          type="submit"
          disabled={create.isPending || title.trim() === ""}
          className="rounded-[var(--radius-control)] px-3 py-2 text-sm disabled:opacity-60"
          style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
        >
          {create.isPending ? "Adicionando..." : "Adicionar pendência"}
        </button>
      </form>
    </div>
  );
}

/**
 * Anexos/documentos do proprietário (Fase 17I) — só existe com Supabase
 * configurado (Storage privado real, ver `src/lib/api/attachments.ts`).
 * Sem isso, não há onde guardar o binário de verdade.
 */
function OwnerAttachmentsPanel({ ownerId }: { ownerId: string }) {
  const queryClient = useQueryClient();
  const available = isAttachmentsAvailable();
  const query = useQuery({
    queryKey: ["owner-attachments", ownerId],
    queryFn: () => listOwnerAttachments(ownerId),
    enabled: available,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["owner-attachments", ownerId] });

  const upload = useMutation({
    mutationFn: (file: File) =>
      uploadOwnerAttachment({
        ownerId,
        implementationId: null,
        ownerTaskId: null,
        category: "custom",
        file,
      }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (params: { id: string; storagePath: string }) =>
      deleteOwnerAttachment(params.id, params.storagePath),
    onSuccess: invalidate,
  });

  const download = useMutation({
    mutationFn: (storagePath: string) => getAttachmentSignedUrl(storagePath),
    onSuccess: (url) => window.open(url, "_blank", "noopener,noreferrer"),
  });

  if (!available) {
    return (
      <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
        <h2
          className="mb-1 text-sm"
          style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
        >
          Anexos
        </h2>
        <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          Não disponível sem um projeto Supabase configurado.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
      <h2
        className="mb-3 text-sm"
        style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
      >
        Anexos
      </h2>

      {query.isPending ? (
        <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          Carregando...
        </p>
      ) : (query.data ?? []).length === 0 ? (
        <p className="mb-3 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          Nenhum anexo enviado ainda.
        </p>
      ) : (
        <ul className="mb-3 divide-y text-sm" style={{ borderColor: "var(--stayo-border)" }}>
          {(query.data ?? []).map((att) => (
            <li key={att.id} className="flex items-center justify-between gap-2 py-2">
              <span className="truncate">{att.filename}</span>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => download.mutate(att.storagePath)}
                  className="text-xs underline"
                  style={{ color: "var(--stayo-forest)" }}
                >
                  Baixar
                </button>
                <button
                  type="button"
                  onClick={() => remove.mutate({ id: att.id, storagePath: att.storagePath })}
                  className="text-xs underline"
                  style={{ color: "var(--stayo-danger)" }}
                >
                  Remover
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <input
        type="file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload.mutate(file);
          e.target.value = "";
        }}
        disabled={upload.isPending}
        className="text-sm"
      />
      {upload.isPending && (
        <p className="mt-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
          Enviando...
        </p>
      )}
    </div>
  );
}

/** Nota interna do time — domínio só do Admin, nunca vem/vai do Core. */
function OwnerNotesPanel({ ownerId }: { ownerId: string }) {
  const queryClient = useQueryClient();
  const query = useQuery(ownerNoteQuery(ownerId));
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setDraft(query.data?.content ?? "");
  }, [query.data]);

  const save = useMutation({
    mutationFn: (content: string) => ownerNotesStore.save(ownerId, content),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["owner-notes", ownerId] });
    },
  });

  const dirty = draft !== (query.data?.content ?? "");

  return (
    <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2
          className="text-sm"
          style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
        >
          Notas internas
        </h2>
        {query.data?.updatedAt && (
          <span className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
            Atualizada em {new Date(query.data.updatedAt).toLocaleString("pt-BR")}
          </span>
        )}
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={query.isPending}
        rows={4}
        placeholder="Observações da equipe sobre este proprietário — preferências de contato, histórico, etc."
        className="w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none disabled:opacity-60"
        style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink)" }}
      />
      {dirty && (
        <button
          type="button"
          onClick={() => save.mutate(draft)}
          disabled={save.isPending}
          className="mt-2 rounded-[var(--radius-control)] px-3 py-2 text-sm disabled:opacity-60"
          style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
        >
          {save.isPending ? "Salvando..." : "Salvar"}
        </button>
      )}
    </div>
  );
}
