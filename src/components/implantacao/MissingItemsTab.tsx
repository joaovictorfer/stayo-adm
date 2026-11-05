import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminApi } from "../../lib/api/queries";
import type { AuditEvent } from "../../types/audit";

/**
 * Itens faltantes: combina faltas derivadas do enxoval (necessário > existente)
 * com itens manuais (module = "faltante") da mesma tabela, sem duplicar o
 * mesmo item (mesmo nome + ambiente). Inclusão e edição acontecem na própria
 * lista. Dispensar um bloqueador ou retirar o bloqueio exige justificativa,
 * registrada na auditoria antes da alteração.
 */

type SupplyStatus = "pendente" | "comprado" | "entregue" | "instalado" | "nao_aplicavel";
type Priority = "baixa" | "media" | "alta";

interface SupplyItem {
  id: string;
  module: string;
  name: string;
  room: string | null;
  size: string | null;
  required_qty: number;
  existing_qty: number;
  status: SupplyStatus;
  priority: Priority;
  responsible: string | null;
  blocks_readiness: boolean;
  notes: string | null;
}

type Origin = "enxoval" | "manual" | "ambos";
interface Row {
  key: string;
  primary: SupplyItem;
  items: SupplyItem[];
  origin: Origin;
  missingQty: number;
  blocks: boolean;
  resolved: boolean;
}

type FilterType = "todos" | "bloqueadores" | "comprar" | "resolvidos";
export type SupplyPresetFilter = "comprar" | "sem_responsavel" | "instalacao";

const statusLabels: Record<SupplyStatus, string> = {
  pendente: "Pendente",
  comprado: "Comprado",
  entregue: "Entregue",
  instalado: "Resolvido",
  nao_aplicavel: "Dispensado",
};
const priorityLabels: Record<Priority, string> = { baixa: "Baixa", media: "Média", alta: "Alta" };
const originLabels: Record<Origin, string> = {
  enxoval: "Do enxoval",
  manual: "Manual",
  ambos: "Enxoval + manual",
};

const norm = (v: string | null | undefined) =>
  (v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
const keyOf = (name: string, room: string | null) => `${norm(name)}|${norm(room || "Geral")}`;

const isClosed = (i: SupplyItem) => i.status === "instalado" || i.status === "nao_aplicavel";
const enxovalMissing = (i: SupplyItem) => i.module === "enxoval" && i.existing_qty < i.required_qty;

function buildRows(items: SupplyItem[]): Row[] {
  const groups = new Map<string, SupplyItem[]>();
  for (const item of items) {
    const relevant =
      item.module === "faltante" ||
      enxovalMissing(item) ||
      (item.module === "enxoval" && isClosed(item) && item.existing_qty < item.required_qty);
    if (!relevant) continue;
    const k = keyOf(item.name, item.room);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return [...groups.entries()].map(([key, group]) => {
    const open = group.filter((i) => !isClosed(i));
    const pool = open.length ? open : group;
    const enx = pool.filter((i) => i.module === "enxoval");
    const man = pool.filter((i) => i.module === "faltante");
    const primary = enx[0] ?? man[0]!;
    const missingQty = enx.length
      ? enx.reduce((a, i) => a + Math.max(0, i.required_qty - i.existing_qty), 0)
      : man.reduce((a, i) => a + i.required_qty, 0);
    return {
      key,
      primary,
      items: group,
      origin: enx.length && man.length ? "ambos" : enx.length ? "enxoval" : "manual",
      missingQty,
      blocks: open.some((i) => i.blocks_readiness),
      resolved: open.length === 0,
    };
  });
}

/** Itens fixos da implantação: sempre visíveis; só entram na lista quando ativados. */
const PRESET_ITEMS: { name: string; room: string }[] = [
  { name: "Lareira", room: "Sala" },
  { name: "Ar condicionado", room: "Geral" },
  { name: "Cama", room: "Quarto" },
  { name: "Sofá", room: "Sala" },
  { name: "TV sala", room: "Sala" },
  { name: "TV quarto 01", room: "Quarto 01" },
  { name: "TV quarto 02", room: "Quarto 02" },
  { name: "Churrasqueira", room: "Área externa" },
  { name: "Kit churrasco", room: "Área externa" },
  { name: "Utensílios", room: "Cozinha" },
];

const emptyDraft = {
  name: "",
  qty: "1",
  room: "",
  priority: "media" as Priority,
  responsible: "stayo",
  blocks: false,
  size: "",
  notes: "",
};

const control =
  "h-9 w-full rounded-md border border-input bg-white px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function MissingItemsTab({ implementationId, preset }: { implementationId: string; preset?: SupplyPresetFilter | undefined }) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterType>("todos");
  const [draft, setDraft] = useState(emptyDraft);
  const [showDetails, setShowDetails] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [dismissKey, setDismissKey] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const query = useQuery({
    queryKey: ["supply_items", implementationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implementation_supply_items")
        .select("*")
        .eq("implementation_id", implementationId)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as SupplyItem[];
    },
  });
  const rows = useMemo(() => buildRows(query.data ?? []), [query.data]);
  const openRows = rows.filter((r) => !r.resolved);
  const counts = {
    todos: openRows.length,
    bloqueadores: openRows.filter((r) => r.blocks).length,
    comprar: openRows.filter((r) => r.items.some((i) => !isClosed(i) && i.status === "pendente"))
      .length,
    resolvidos: rows.length - openRows.length,
  };
  const visible = rows.filter((r) =>
    preset === "comprar"
      ? !r.resolved && r.items.some((i) => !isClosed(i) && i.status === "pendente")
      : preset === "sem_responsavel"
        ? !r.resolved && r.items.some((i) => !isClosed(i) && !i.responsible)
        : preset === "instalacao"
          ? !r.resolved && r.items.some((i) => i.status === "comprado" || i.status === "entregue")
          : filter === "resolvidos"
      ? r.resolved
      : filter === "bloqueadores"
        ? !r.resolved && r.blocks
        : filter === "comprar"
          ? !r.resolved && r.items.some((i) => !isClosed(i) && i.status === "pendente")
          : !r.resolved,
  );

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["supply_items", implementationId] });
  const audit = (event: AuditEvent, metadata: Record<string, unknown>) =>
    adminApi.audit.log({
      actorId: null,
      event,
      entityType: "implementation",
      entityId: implementationId,
      metadata,
    });

  const create = useMutation({
    mutationFn: async (d: typeof emptyDraft) => {
      const { error } = await supabase.from("implementation_supply_items").insert([
        {
          implementation_id: implementationId,
          module: "faltante",
          name: d.name.trim(),
          room: d.room.trim() || "Geral",
          size: d.size.trim() || null,
          required_qty: Math.max(1, Number(d.qty) || 1),
          existing_qty: 0,
          priority: d.priority,
          responsible: d.responsible.trim() || null,
          status: "pendente",
          blocks_readiness: d.blocks,
          notes: d.notes.trim() || null,
          display_order: (query.data?.length ?? 0) + 1,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: async () => {
      setDraft((d) => ({
        ...emptyDraft,
        room: d.room,
        priority: d.priority,
        responsible: d.responsible,
      }));
      setAddError(null);
      toast.success("Item adicionado");
      await invalidate();
      nameRef.current?.focus({ preventScroll: true });
    },
    onError: (err: unknown) =>
      setAddError(
        `Não foi possível salvar: ${err instanceof Error ? err.message : "tente de novo"}. O que você digitou continua aqui.`,
      ),
  });

  const commit = () => {
    if (!draft.name.trim() || create.isPending) return;
    const k = keyOf(draft.name, draft.room.trim() || "Geral");
    const dup = rows.find((r) => r.key === k && !r.resolved);
    if (dup) {
      setAddError(
        `"${dup.primary.name}" em ${dup.primary.room || "Geral"} já está na lista (${originLabels[dup.origin].toLowerCase()}). Edite o item existente.`,
      );
      return;
    }
    create.mutate(draft);
  };

  const patchItems = useMutation({
    mutationFn: async (input: {
      row: Row;
      patch: Partial<SupplyItem>;
      auditEvent?: AuditEvent | undefined;
      reason?: string | undefined;
    }) => {
      const ids = input.row.items
        .filter((i) => (input.patch.status === "pendente" ? true : !isClosed(i)))
        .map((i) => i.id);
      if (input.auditEvent) {
        await audit(input.auditEvent, {
          items: ids,
          name: input.row.primary.name,
          room: input.row.primary.room,
          wasBlocker: input.row.blocks,
          reason: input.reason ?? null,
          patch: input.patch,
        });
      }
      const { error } = await supabase
        .from("implementation_supply_items")
        .update({ ...(input.patch as Record<string, unknown>), updated_at: new Date().toISOString() } as never)
        .in("id", ids.length ? ids : input.row.items.map((i) => i.id));
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
    },
    onError: (err: unknown) =>
      toast.error("Não foi possível salvar", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  const togglePreset = useMutation({
    mutationFn: async (preset: { name: string; room: string }) => {
      const k = keyOf(preset.name, preset.room);
      const existing = rows.find((r) => r.key === k);
      if (existing && !existing.resolved) {
        const manual = existing.items.filter((i) => i.module === "faltante" && !isClosed(i));
        const removable = manual.filter((i) => i.status === "pendente");
        if (removable.length !== manual.length || manual.length === 0) {
          throw new Error(
            `"${preset.name}" já tem andamento. Use Resolver ou Dispensar na lista abaixo.`,
          );
        }
        const { error } = await supabase
          .from("implementation_supply_items")
          .delete()
          .in("id", removable.map((i) => i.id));
        if (error) throw error;
        return;
      }
      if (existing?.resolved) {
        // Reativa: volta o item manual fechado para pendente.
        const manual = existing.items.filter((i) => i.module === "faltante");
        if (manual.length) {
          const { error } = await supabase
            .from("implementation_supply_items")
            .update({ status: "pendente", updated_at: new Date().toISOString() } as never)
            .in("id", manual.map((i) => i.id));
          if (error) throw error;
          return;
        }
      }
      const { error } = await supabase.from("implementation_supply_items").insert([
        {
          implementation_id: implementationId,
          module: "faltante",
          name: preset.name,
          room: preset.room,
          required_qty: 1,
          existing_qty: 0,
          priority: "media",
          responsible: "stayo",
          status: "pendente",
          blocks_readiness: false,
          display_order: (query.data?.length ?? 0) + 1,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (err: unknown) =>
      toast.error("Não foi possível atualizar o item", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });

  const activePresetKeys = new Set(rows.filter((r) => !r.resolved).map((r) => r.key));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-[var(--stayo-ink)]">Itens faltantes</h2>
        <p className="text-xs text-[var(--stayo-ink-muted)]">
          Faltas do enxoval somadas aos itens manuais. O mesmo item aparece uma vez só.
        </p>
      </div>

      {/* Itens fixos: ative apenas os que estão faltando */}
      <div className="rounded-lg border bg-white p-3">
        <p className="text-[11px] font-medium text-[var(--stayo-ink-muted)]">
          Itens do imóvel — ative só os que estão faltando
        </p>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Itens fixos">
          {PRESET_ITEMS.map((p) => {
            const active = activePresetKeys.has(keyOf(p.name, p.room));
            return (
              <button
                key={p.name}
                type="button"
                aria-pressed={active}
                disabled={togglePreset.isPending}
                onClick={() => togglePreset.mutate(p)}
                className={`min-h-9 rounded-full border px-3 text-xs font-medium transition-colors ${
                  active
                    ? "border-[var(--stayo-forest)] bg-[var(--stayo-forest)] text-white"
                    : "bg-white text-[var(--stayo-ink-muted)] hover:bg-slate-50"
                }`}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtros">
        {(
          [
            ["todos", "Todos"],
            ["bloqueadores", "Bloqueadores"],
            ["comprar", "Comprar"],
            ["resolvidos", "Resolvidos"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={filter === k}
            onClick={() => setFilter(k)}
            className={`min-h-9 rounded-full border px-3 text-xs font-medium transition-colors ${
              filter === k
                ? "border-[var(--stayo-forest)] bg-[var(--stayo-forest)] text-white"
                : "bg-white text-[var(--stayo-ink-muted)] hover:bg-slate-50"
            }`}
          >
            {label} <span className="opacity-70">{query.isSuccess ? counts[k] : ""}</span>
          </button>
        ))}
      </div>

      {/* Linha de inclusão */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          commit();
        }}
        className="rounded-lg border bg-emerald-50/40 p-3"
        aria-label="Adicionar item faltante"
      >
        <div className="grid gap-2 md:grid-cols-[minmax(0,2fr)_72px_minmax(0,1fr)_110px_minmax(0,1fr)_auto_auto] md:items-end">
          <label className="text-[11px] font-medium text-[var(--stayo-ink-muted)]">
            Item
            <Input
              ref={nameRef}
              value={draft.name}
              placeholder="Ex.: Ferro de passar"
              onChange={(e) => {
                setDraft({ ...draft, name: e.target.value });
                setAddError(null);
              }}
              className="mt-1 h-9 bg-white"
            />
          </label>
          <label className="text-[11px] font-medium text-[var(--stayo-ink-muted)]">
            Qtd.
            <Input
              type="number"
              min={1}
              value={draft.qty}
              onChange={(e) => setDraft({ ...draft, qty: e.target.value })}
              className="mt-1 h-9 bg-white"
            />
          </label>
          <label className="text-[11px] font-medium text-[var(--stayo-ink-muted)]">
            Ambiente
            <Input
              value={draft.room}
              placeholder="Geral"
              onChange={(e) => {
                setDraft({ ...draft, room: e.target.value });
                setAddError(null);
              }}
              className="mt-1 h-9 bg-white"
            />
          </label>
          <label className="text-[11px] font-medium text-[var(--stayo-ink-muted)]">
            Prioridade
            <select
              value={draft.priority}
              onChange={(e) => setDraft({ ...draft, priority: e.target.value as Priority })}
              className={`${control} mt-1`}
            >
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
            </select>
          </label>
          <label className="text-[11px] font-medium text-[var(--stayo-ink-muted)]">
            Responsável
            <Input
              value={draft.responsible}
              onChange={(e) => setDraft({ ...draft, responsible: e.target.value })}
              className="mt-1 h-9 bg-white"
            />
          </label>
          <label className="flex min-h-9 items-center gap-2 text-xs font-medium text-[var(--stayo-ink)]">
            <input
              type="checkbox"
              checked={draft.blocks}
              onChange={(e) => setDraft({ ...draft, blocks: e.target.checked })}
              className="size-4"
            />
            Bloqueia
          </label>
          <Button
            type="submit"
            className="h-9 gap-1.5"
            disabled={!draft.name.trim() || create.isPending}
          >
            {create.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            Adicionar
          </Button>
        </div>
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          aria-expanded={showDetails}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--stayo-ink-muted)] underline"
        >
          {showDetails ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          Mais detalhes
        </button>
        {showDetails && (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="text-[11px] font-medium text-[var(--stayo-ink-muted)]">
              Tamanho / especificação
              <Input
                value={draft.size}
                onChange={(e) => setDraft({ ...draft, size: e.target.value })}
                className="mt-1 h-9 bg-white"
              />
            </label>
            <label className="text-[11px] font-medium text-[var(--stayo-ink-muted)]">
              Observações
              <Input
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                className="mt-1 h-9 bg-white"
              />
            </label>
          </div>
        )}
        {addError && (
          <p role="alert" className="mt-2 text-xs text-[var(--stayo-danger)]">
            {addError}
          </p>
        )}
      </form>

      {query.isPending ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : query.isError ? (
        <p className="rounded-lg border p-4 text-sm text-[var(--stayo-danger)]">
          Não foi possível carregar os itens.{" "}
          <button type="button" className="underline" onClick={() => void query.refetch()}>
            Tentar de novo
          </button>
        </p>
      ) : visible.length === 0 ? (
        <p className="rounded-lg border bg-white p-6 text-center text-sm text-[var(--stayo-ink-muted)]">
          {filter === "resolvidos"
            ? "Nenhum item resolvido ainda."
            : "Nenhum item faltante neste filtro."}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border bg-white">
          {visible.map((row) => (
            <MissingRow
              key={row.key}
              row={row}
              editing={editingKey === row.key}
              dismissing={dismissKey === row.key}
              pending={patchItems.isPending}
              onEdit={() => setEditingKey(editingKey === row.key ? null : row.key)}
              onDismissToggle={() => setDismissKey(dismissKey === row.key ? null : row.key)}
              onPatch={(patch, auditEvent, reason) =>
                patchItems.mutateAsync({ row, patch, auditEvent, reason }).then(() => {
                  if (auditEvent === "supply.dismissed") setDismissKey(null);
                })
              }
              onCloseEdit={() => setEditingKey(null)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function MissingRow({
  row,
  editing,
  dismissing,
  pending,
  onEdit,
  onDismissToggle,
  onPatch,
  onCloseEdit,
}: {
  row: Row;
  editing: boolean;
  dismissing: boolean;
  pending: boolean;
  onEdit: () => void;
  onDismissToggle: () => void;
  onPatch: (patch: Partial<SupplyItem>, auditEvent?: AuditEvent, reason?: string) => Promise<void>;
  onCloseEdit: () => void;
}) {
  const item = row.primary;
  const [edit, setEdit] = useState(() => ({
    name: item.name,
    qty: String(item.required_qty),
    room: item.room ?? "",
    priority: item.priority,
    responsible: item.responsible ?? "",
    status: item.status,
    blocks: row.blocks,
    size: item.size ?? "",
    notes: item.notes ?? "",
    reason: "",
  }));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const unblocking = row.blocks && !edit.blocks;
  const blockReason =
    row.origin === "manual"
      ? "Marcado pela equipe como bloqueador"
      : `Faltam ${row.missingQty} no enxoval`;

  const saveEdit = async () => {
    if (unblocking && edit.reason.trim().length < 5) {
      setError("Explique por que o item deixa de bloquear a prontidão.");
      return;
    }
    setError(null);
    const patch: Partial<SupplyItem> = {
      room: edit.room.trim() || "Geral",
      priority: edit.priority,
      responsible: edit.responsible.trim() || null,
      status: edit.status,
      blocks_readiness: edit.blocks,
      size: edit.size.trim() || null,
      notes: edit.notes.trim() || null,
    };
    if (row.origin === "manual") {
      patch.name = edit.name.trim() || item.name;
      patch.required_qty = Math.max(1, Number(edit.qty) || 1);
    }
    try {
      await onPatch(
        patch,
        unblocking ? "supply.blocker_removed" : undefined,
        edit.reason.trim() || undefined,
      );
      toast.success("Item atualizado");
      onCloseEdit();
    } catch (err) {
      setError(`Não foi possível salvar: ${err instanceof Error ? err.message : "tente de novo"}.`);
    }
  };

  return (
    <li className="p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-[var(--stayo-ink)]">{item.name}</span>
            <span className="rounded-full border px-2 py-0.5 text-[10px] text-[var(--stayo-ink-muted)]">
              {originLabels[row.origin]}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">
              {row.resolved
                ? statusLabels[
                    row.items.some((i) => i.status === "instalado") ? "instalado" : "nao_aplicavel"
                  ]
                : statusLabels[item.status]}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--stayo-ink-muted)]">
            {row.missingQty > 0 ? `Faltam ${row.missingQty}` : `${item.required_qty} un.`} ·{" "}
            {item.room || "Geral"} · Prioridade {priorityLabels[item.priority] ?? item.priority} ·{" "}
            {item.responsible || "sem responsável"}
            {item.size ? ` · ${item.size}` : ""}
          </p>
          {row.blocks && !row.resolved && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[var(--stayo-danger)]">
              <ShieldAlert className="size-3.5" /> Bloqueia a prontidão · {blockReason}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-start justify-end gap-1.5">
          {row.resolved ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                void onPatch({ status: "pendente" }, "supply.reopened").catch(() => undefined)
              }
            >
              <RotateCcw className="size-3.5" /> Reabrir
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  void onPatch({ status: "instalado" }, "supply.resolved")
                    .then(() => toast.success("Item resolvido"))
                    .catch(() => undefined)
                }
              >
                Resolver
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onDismissToggle}
                aria-expanded={dismissing}
              >
                Dispensar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onEdit}
                aria-expanded={editing}
                aria-label={`Editar ${item.name}`}
              >
                <Pencil className="size-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {dismissing && !row.resolved && (
        <div className="mt-3 rounded-md border bg-amber-50/60 p-3">
          <label className="text-xs font-medium text-[var(--stayo-ink)]">
            {row.blocks ? "Justificativa (obrigatória: item bloqueador)" : "Motivo (opcional)"}
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 h-9 bg-white"
              autoFocus
            />
          </label>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              disabled={pending || (row.blocks && reason.trim().length < 5)}
              onClick={() =>
                void onPatch(
                  { status: "nao_aplicavel" },
                  "supply.dismissed",
                  reason.trim() || undefined,
                )
                  .then(() => {
                    setReason("");
                    toast.success("Item dispensado e registrado");
                  })
                  .catch(() => undefined)
              }
            >
              Confirmar dispensa
            </Button>
            <Button size="sm" variant="ghost" onClick={onDismissToggle}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {editing && (
        <div className="mt-3 grid gap-2 rounded-md border bg-slate-50/60 p-3 sm:grid-cols-2 lg:grid-cols-4">
          {row.origin === "manual" ? (
            <>
              <label className="text-[11px] font-medium text-[var(--stayo-ink-muted)]">
                Item
                <Input
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                  className="mt-1 h-9 bg-white"
                />
              </label>
              <label className="text-[11px] font-medium text-[var(--stayo-ink-muted)]">
                Quantidade
                <Input
                  type="number"
                  min={1}
                  value={edit.qty}
                  onChange={(e) => setEdit({ ...edit, qty: e.target.value })}
                  className="mt-1 h-9 bg-white"
                />
              </label>
            </>
          ) : (
            <p className="text-xs text-[var(--stayo-ink-muted)] sm:col-span-2">
              Nome e quantidade vêm do enxoval. Ajuste-os na aba Enxoval.
            </p>
          )}
          <label className="text-[11px] font-medium text-[var(--stayo-ink-muted)]">
            Ambiente
            <Input
              value={edit.room}
              onChange={(e) => setEdit({ ...edit, room: e.target.value })}
              className="mt-1 h-9 bg-white"
            />
          </label>
          <label className="text-[11px] font-medium text-[var(--stayo-ink-muted)]">
            Prioridade
            <select
              value={edit.priority}
              onChange={(e) => setEdit({ ...edit, priority: e.target.value as Priority })}
              className={`${control} mt-1`}
            >
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
            </select>
          </label>
          <label className="text-[11px] font-medium text-[var(--stayo-ink-muted)]">
            Responsável
            <Input
              value={edit.responsible}
              onChange={(e) => setEdit({ ...edit, responsible: e.target.value })}
              className="mt-1 h-9 bg-white"
            />
          </label>
          <label className="text-[11px] font-medium text-[var(--stayo-ink-muted)]">
            Status
            <select
              value={edit.status}
              onChange={(e) => setEdit({ ...edit, status: e.target.value as SupplyStatus })}
              className={`${control} mt-1`}
            >
              <option value="pendente">Pendente (comprar)</option>
              <option value="comprado">Comprado</option>
              <option value="entregue">Entregue</option>
            </select>
          </label>
          <label className="text-[11px] font-medium text-[var(--stayo-ink-muted)]">
            Tamanho
            <Input
              value={edit.size}
              onChange={(e) => setEdit({ ...edit, size: e.target.value })}
              className="mt-1 h-9 bg-white"
            />
          </label>
          <label className="text-[11px] font-medium text-[var(--stayo-ink-muted)]">
            Observações
            <Input
              value={edit.notes}
              onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
              className="mt-1 h-9 bg-white"
            />
          </label>
          <label className="flex min-h-9 items-center gap-2 text-xs font-medium text-[var(--stayo-ink)] sm:col-span-2">
            <input
              type="checkbox"
              checked={edit.blocks}
              onChange={(e) => setEdit({ ...edit, blocks: e.target.checked })}
              className="size-4"
            />
            Bloqueia a prontidão
          </label>
          {unblocking && (
            <label className="text-[11px] font-medium text-[var(--stayo-danger)] sm:col-span-2 lg:col-span-4">
              Justificativa para retirar o bloqueio (fica registrada)
              <Input
                value={edit.reason}
                onChange={(e) => setEdit({ ...edit, reason: e.target.value })}
                className="mt-1 h-9 bg-white"
              />
            </label>
          )}
          {error && (
            <p
              role="alert"
              className="text-xs text-[var(--stayo-danger)] sm:col-span-2 lg:col-span-4"
            >
              {error}
            </p>
          )}
          <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
            <Button size="sm" disabled={pending} onClick={() => void saveEdit()}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
            <Button size="sm" variant="ghost" onClick={onCloseEdit}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
