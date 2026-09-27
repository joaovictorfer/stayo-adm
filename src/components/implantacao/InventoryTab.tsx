import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Package, Pencil, Plus, RotateCcw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { adminApi } from "../../lib/api/queries";
import {
  deriveInventoryState,
  filterInventory,
  hasOpenInventoryDuplicate,
  type InventoryFilter,
  type InventoryItem,
  type InventoryPriority,
} from "../../lib/inventory";
import type { AuditEvent } from "../../types/audit";

const FILTERS: Array<{ id: InventoryFilter; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "faltando", label: "Faltando" },
  { id: "resolvidos", label: "Resolvidos" },
  { id: "bloqueadores", label: "Bloqueadores" },
];
const PRESETS = [
  ["Lareira", "Sala"],
  ["Ar condicionado", "Geral"],
  ["Cama", "Quarto"],
  ["Sofá", "Sala"],
  ["TV sala", "Sala"],
  ["TV quarto 01", "Quarto 01"],
  ["TV quarto 02", "Quarto 02"],
  ["Churrasqueira", "Área externa"],
  ["Kit churrasco", "Área externa"],
  ["Utensílios", "Cozinha"],
] as const;
const priorityLabels = { baixa: "Baixa", media: "Média", alta: "Alta" } as const;
const emptyForm = {
  module: "enxoval" as "enxoval" | "faltante",
  name: "",
  room: "",
  size: "",
  required_qty: 1,
  existing_qty: 0,
  priority: "media" as InventoryPriority,
  responsible: "stayo",
  blocks_readiness: false,
  notes: "",
};

export function InventoryTab({ implementationId }: { implementationId: string }) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<InventoryFilter>("todos");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [unblockReason, setUnblockReason] = useState("");
  const [dismissItem, setDismissItem] = useState<InventoryItem | null>(null);
  const [dismissReason, setDismissReason] = useState("");
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
      return data as unknown as InventoryItem[];
    },
  });
  const items = useMemo(() => query.data ?? [], [query.data]);
  const states = useMemo(() => items.map(deriveInventoryState), [items]);
  const visible = useMemo(() => filterInventory(items, filter), [items, filter]);
  const counts = {
    todos: states.length,
    faltando: states.filter((s) => !s.resolved).length,
    resolvidos: states.filter((s) => s.resolved).length,
    bloqueadores: states.filter((s) => s.blocker).length,
  };
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["supply_items", implementationId] });
  const audit = (event: AuditEvent, item: InventoryItem, metadata: Record<string, unknown> = {}) =>
    adminApi.audit.log({
      actorId: null,
      event,
      entityType: "implementation",
      entityId: implementationId,
      metadata: { item: item.id, name: item.name, room: item.room, ...metadata },
    });

  const save = useMutation({
    mutationFn: async () => {
      const room = form.room.trim() || "Geral";
      if (hasOpenInventoryDuplicate(items, form.name, room, editing?.id))
        throw new Error(`“${form.name.trim()}” em ${room} já está no inventário.`);
      const removingBlocker = Boolean(editing?.blocks_readiness && !form.blocks_readiness);
      if (removingBlocker && unblockReason.trim().length < 5)
        throw new Error("Informe uma justificativa para retirar o bloqueio.");
      const payload = {
        implementation_id: implementationId,
        module: form.module,
        name: form.name.trim(),
        room,
        size: form.size.trim() || null,
        required_qty: Math.max(1, Number(form.required_qty) || 1),
        existing_qty: form.module === "faltante" ? 0 : Math.max(0, Number(form.existing_qty) || 0),
        priority: form.priority,
        responsible: form.responsible.trim() || null,
        blocks_readiness: form.blocks_readiness,
        notes: form.notes.trim() || null,
        status: editing?.status ?? "pendente",
        updated_at: new Date().toISOString(),
      };
      if (editing && removingBlocker) {
        await audit("supply.blocker_removed", editing, { reason: unblockReason.trim() });
      }
      const result = editing
        ? await supabase
            .from("implementation_supply_items")
            .update(payload as never)
            .eq("id", editing.id)
        : await supabase
            .from("implementation_supply_items")
            .insert([{ ...payload, display_order: items.length + 1 } as never]);
      if (result.error) throw result.error;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success(editing ? "Item atualizado" : "Item adicionado");
      setFormOpen(false);
      setEditing(null);
      setForm(emptyForm);
      setFormError(null);
      setUnblockReason("");
    },
    onError: (error: unknown) =>
      setFormError(error instanceof Error ? error.message : "Não foi possível salvar o item."),
  });
  const patch = useMutation({
    mutationFn: async ({
      item,
      values,
      event,
      reason,
    }: {
      item: InventoryItem;
      values: Partial<InventoryItem>;
      event: AuditEvent;
      reason?: string;
    }) => {
      await audit(event, item, { reason: reason ?? null, patch: values });
      const { error } = await supabase
        .from("implementation_supply_items")
        .update({ ...values, updated_at: new Date().toISOString() } as never)
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: async (_, input) => {
      await invalidate();
      toast.success(
        input.event === "supply.reopened"
          ? "Item reaberto"
          : input.event === "supply.dismissed"
            ? "Item dispensado"
            : "Item resolvido",
      );
      setDismissItem(null);
      setDismissReason("");
    },
    onError: (error: unknown) =>
      toast.error("Não foi possível atualizar", {
        description: error instanceof Error ? error.message : undefined,
      }),
  });

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setUnblockReason("");
    setFormOpen(true);
  };
  const openEdit = (item: InventoryItem) => {
    setEditing(item);
    setForm({
      module: item.module === "faltante" ? "faltante" : "enxoval",
      name: item.name,
      room: item.room ?? "",
      size: item.size ?? "",
      required_qty: item.required_qty,
      existing_qty: item.existing_qty,
      priority: item.priority,
      responsible: item.responsible ?? "",
      blocks_readiness: item.blocks_readiness,
      notes: item.notes ?? "",
    });
    setFormError(null);
    setUnblockReason("");
    setFormOpen(true);
  };
  const resolve = (item: InventoryItem) =>
    patch.mutate({
      item,
      values:
        deriveInventoryState(item).origin === "inventory"
          ? { existing_qty: item.required_qty, status: "instalado" }
          : { status: "instalado" },
      event: "supply.resolved",
    });
  const reopen = (item: InventoryItem) =>
    patch.mutate({
      item,
      values:
        deriveInventoryState(item).origin === "inventory"
          ? { existing_qty: Math.max(0, item.required_qty - 1), status: "pendente" }
          : { status: "pendente" },
      event: "supply.reopened",
    });

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[var(--stayo-ink)]">Inventário</h2>
          <p className="mt-1 text-xs text-[var(--stayo-ink-muted)]">
            O que o imóvel precisa, o que já possui e as pendências manuais em uma única lista.
          </p>
        </div>
        <Button type="button" className="min-h-11 w-full gap-1.5 sm:w-auto" onClick={openAdd}>
          <Plus className="size-4" /> Adicionar item
        </Button>
      </header>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Filtros do inventário">
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
            className="min-h-14 rounded-[var(--radius-control)] border px-3 py-2 text-left transition"
            style={{
              backgroundColor: filter === id ? "var(--stayo-forest-soft)" : "var(--stayo-surface)",
              borderColor: filter === id ? "var(--stayo-forest)" : "var(--stayo-border)",
            }}
          >
            <span className="block text-xs text-[var(--stayo-ink-muted)]">{label}</span>
            <strong className="text-lg text-[var(--stayo-ink)]">
              {query.isSuccess ? counts[id] : "—"}
            </strong>
          </button>
        ))}
      </div>
      {query.isPending ? (
        <div className="space-y-2" aria-label="Carregando inventário">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-[var(--radius-card)] bg-muted" />
          ))}
        </div>
      ) : query.isError ? (
        <p
          role="alert"
          className="rounded-[var(--radius-card)] border p-4 text-sm text-[var(--stayo-danger)]"
        >
          Não foi possível carregar.{" "}
          <button type="button" className="underline" onClick={() => void query.refetch()}>
            Tentar novamente
          </button>
        </p>
      ) : visible.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed p-8 text-center">
          <Package className="mx-auto size-7 text-[var(--stayo-ink-muted)]" />
          <p className="mt-2 text-sm font-medium">
            {filter === "todos"
              ? "Nenhum item no inventário"
              : `Nenhum item em “${FILTERS.find((f) => f.id === filter)?.label}”`}
          </p>
          {filter === "todos" && (
            <Button type="button" size="sm" className="mt-4" onClick={openAdd}>
              <Plus className="size-4" /> Adicionar primeiro item
            </Button>
          )}
        </div>
      ) : (
        <ul className="grid gap-2" aria-label="Itens do inventário">
          {visible.map(({ item, origin, missingQty, resolved, blocker }) => (
            <li
              key={item.id}
              className="rounded-[var(--radius-card)] border bg-[var(--stayo-surface)] p-4"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="font-semibold">{item.name}</h3>
                    {origin === "manual" && (
                      <span className="rounded-full border px-2 py-0.5 text-[10px] text-[var(--stayo-ink-muted)]">
                        Pendência manual
                      </span>
                    )}
                    {blocker && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
                        <ShieldAlert className="size-3" /> Bloqueador
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[var(--stayo-ink-muted)]">
                    {item.room || "Geral"}
                    {item.size ? ` · ${item.size}` : ""}
                  </p>
                  <p className="mt-2 text-sm">
                    Necessário {item.required_qty} · possui {item.existing_qty}
                  </p>
                  <p
                    className={`mt-0.5 inline-flex items-center gap-1 text-sm font-semibold ${resolved ? "text-[var(--stayo-forest)]" : "text-[var(--stayo-danger)]"}`}
                  >
                    {resolved ? (
                      <CheckCircle2 className="size-4" />
                    ) : (
                      <ShieldAlert className="size-4" />
                    )}
                    {resolved
                      ? item.status === "nao_aplicavel"
                        ? "Dispensado"
                        : "Completo"
                      : `Falta ${missingQty}`}
                  </p>
                  <p className="mt-1 text-xs text-[var(--stayo-ink-muted)]">
                    Prioridade {priorityLabels[item.priority]} ·{" "}
                    {item.responsible || "sem responsável"}
                  </p>
                  {item.notes && (
                    <p className="mt-1 text-xs text-[var(--stayo-ink-muted)]">{item.notes}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 shrink-0"
                  aria-label={`Editar ${item.name}`}
                  onClick={() => openEdit(item)}
                >
                  <Pencil className="size-4" />
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                {resolved ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-10"
                    disabled={patch.isPending}
                    onClick={() => reopen(item)}
                  >
                    <RotateCcw className="size-4" /> Reabrir
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      className="min-h-10"
                      disabled={patch.isPending}
                      onClick={() => resolve(item)}
                    >
                      Resolver
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-10"
                      disabled={patch.isPending}
                      onClick={() => {
                        setDismissItem(item);
                        setDismissReason("");
                      }}
                    >
                      Dispensar
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar item" : "Adicionar item"}</DialogTitle>
            <DialogDescription>
              Registre um item do inventário ou uma pendência manual.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setFormError(null);
              save.mutate();
            }}
          >
            {!editing && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ["enxoval", "Inventário"],
                      ["faltante", "Pendência manual"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={form.module === value}
                      onClick={() => setForm({ ...form, module: value, existing_qty: 0 })}
                      className="min-h-11 rounded-[var(--radius-control)] border px-3 text-sm font-medium"
                      style={{
                        backgroundColor:
                          form.module === value
                            ? "var(--stayo-forest-soft)"
                            : "var(--stayo-surface)",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--stayo-ink-muted)]">
                    Itens frequentes
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {PRESETS.map(([name, room]) => (
                      <button
                        key={`${name}-${room}`}
                        type="button"
                        className="min-h-9 rounded-full border px-3 text-xs"
                        onClick={() =>
                          setForm({ ...form, module: "faltante", name, room, existing_qty: 0 })
                        }
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome *" id="inv-name">
                <Input
                  id="inv-name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Ambiente" id="inv-room">
                <Input
                  id="inv-room"
                  value={form.room}
                  onChange={(e) => setForm({ ...form, room: e.target.value })}
                  placeholder="Geral"
                />
              </Field>
              <Field label="Tamanho / especificação" id="inv-size">
                <Input
                  id="inv-size"
                  value={form.size}
                  onChange={(e) => setForm({ ...form, size: e.target.value })}
                />
              </Field>
              <Field label="Necessário *" id="inv-required">
                <Input
                  id="inv-required"
                  type="number"
                  min={1}
                  required
                  value={form.required_qty}
                  onChange={(e) => setForm({ ...form, required_qty: Number(e.target.value) })}
                />
              </Field>
              <Field label="Possui" id="inv-existing">
                <Input
                  id="inv-existing"
                  type="number"
                  min={0}
                  disabled={form.module === "faltante"}
                  value={form.existing_qty}
                  onChange={(e) => setForm({ ...form, existing_qty: Number(e.target.value) })}
                />
              </Field>
              <Field label="Prioridade" id="inv-priority">
                <select
                  id="inv-priority"
                  className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.priority}
                  onChange={(e) =>
                    setForm({ ...form, priority: e.target.value as InventoryPriority })
                  }
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                </select>
              </Field>
              <Field label="Responsável" id="inv-responsible">
                <Input
                  id="inv-responsible"
                  value={form.responsible}
                  onChange={(e) => setForm({ ...form, responsible: e.target.value })}
                />
              </Field>
              <label className="flex min-h-11 items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={form.blocks_readiness}
                  onChange={(e) => setForm({ ...form, blocks_readiness: e.target.checked })}
                />
                <span className="text-sm font-medium">Marcar como bloqueador do inventário</span>
              </label>
              {editing?.blocks_readiness && !form.blocks_readiness && (
                <Field label="Justificativa para retirar o bloqueio *" id="inv-unblock-reason">
                  <Input
                    id="inv-unblock-reason"
                    value={unblockReason}
                    onChange={(e) => setUnblockReason(e.target.value)}
                  />
                </Field>
              )}
              <Field label="Observações" id="inv-notes">
                <Input
                  id="inv-notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </Field>
            </div>
            {formError && (
              <p role="alert" className="text-sm text-[var(--stayo-danger)]">
                {formError}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={save.isPending || !form.name.trim()}>
                {save.isPending && <Loader2 className="size-4 animate-spin" />} Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(dismissItem)} onOpenChange={(open) => !open && setDismissItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dispensar item</DialogTitle>
            <DialogDescription>
              {dismissItem?.blocks_readiness
                ? "Este item é bloqueador. Informe a justificativa para manter a decisão auditável."
                : "A dispensa ficará registrada no histórico do inventário."}
            </DialogDescription>
          </DialogHeader>
          <Field
            label={dismissItem?.blocks_readiness ? "Justificativa *" : "Motivo (opcional)"}
            id="dismiss-reason"
          >
            <Input
              id="dismiss-reason"
              value={dismissReason}
              onChange={(e) => setDismissReason(e.target.value)}
              autoFocus
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDismissItem(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={
                !dismissItem ||
                patch.isPending ||
                Boolean(dismissItem.blocks_readiness && dismissReason.trim().length < 5)
              }
              onClick={() =>
                dismissItem &&
                patch.mutate({
                  item: dismissItem,
                  values: { status: "nao_aplicavel", blocks_readiness: false },
                  event: "supply.dismissed",
                  ...(dismissReason.trim() ? { reason: dismissReason.trim() } : {}),
                })
              }
            >
              Confirmar dispensa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </label>
  );
}
