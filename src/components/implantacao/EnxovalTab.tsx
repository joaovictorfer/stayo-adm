import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Package,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  inventoryMissingQuantity,
  inventoryOriginLabel,
  inventoryStateLabel,
  isInventoryBlocker,
  isInventoryMissing,
  isInventoryResolved,
  matchesInventoryFilter,
  type InventoryFilter,
} from "../../lib/inventory-state";

type SupplyModule = "enxoval" | "faltante";
type SupplyStatus = "pendente" | "comprado" | "entregue" | "instalado" | "nao_aplicavel";
type SupplyPriority = "baixa" | "media" | "alta";

interface SupplyItem {
  id: string;
  implementation_id: string;
  module: SupplyModule;
  name: string;
  room: string | null;
  size: string | null;
  required_qty: number;
  existing_qty: number;
  status: SupplyStatus;
  priority: SupplyPriority;
  responsible: string | null;
  blocks_readiness: boolean;
  notes: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface InventoryForm {
  module: SupplyModule;
  name: string;
  room: string;
  size: string;
  required_qty: number;
  existing_qty: number;
  status: SupplyStatus;
  priority: SupplyPriority;
  responsible: string;
  blocks_readiness: boolean;
  notes: string;
}

const emptyForm: InventoryForm = {
  module: "enxoval",
  name: "",
  room: "",
  size: "",
  required_qty: 1,
  existing_qty: 0,
  status: "pendente",
  priority: "media",
  responsible: "stayo",
  blocks_readiness: false,
  notes: "",
};

const filterLabels: Array<{ id: InventoryFilter; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "faltando", label: "Faltando" },
  { id: "resolvidos", label: "Resolvidos" },
  { id: "bloqueadores", label: "Bloqueadores" },
];

const statusLabels: Record<SupplyStatus, string> = {
  pendente: "Pendente",
  comprado: "Comprado",
  entregue: "Entregue",
  instalado: "Instalado",
  nao_aplicavel: "Não aplicável",
};

const priorityLabels: Record<SupplyPriority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

const normalizedKey = (name: string, room: string | null) =>
  `${name.trim().toLocaleLowerCase("pt-BR")}|${(room?.trim() || "Geral").toLocaleLowerCase("pt-BR")}`;

export function EnxovalTab({ implementationId }: { implementationId: string }) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<InventoryFilter>("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SupplyItem | null>(null);
  const [form, setForm] = useState<InventoryForm>(emptyForm);

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

  const items = useMemo(() => query.data ?? [], [query.data]);
  const visibleItems = useMemo(
    () => items.filter((item) => matchesInventoryFilter(item, filter)),
    [filter, items],
  );

  const groupedItems = useMemo(() => {
    const groups = new Map<string, SupplyItem[]>();
    for (const item of visibleItems) {
      const room = item.room?.trim() || "Geral";
      groups.set(room, [...(groups.get(room) ?? []), item]);
    }
    return [...groups.entries()];
  }, [visibleItems]);

  const counts = useMemo(
    () => ({
      todos: items.length,
      faltando: items.filter(isInventoryMissing).length,
      resolvidos: items.filter(isInventoryResolved).length,
      bloqueadores: items.filter(isInventoryBlocker).length,
    }),
    [items],
  );

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["supply_items", implementationId] });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
    setForm(emptyForm);
  };

  const openAdd = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (item: SupplyItem) => {
    setEditingItem(item);
    setForm({
      module: item.module,
      name: item.name,
      room: item.room ?? "",
      size: item.size ?? "",
      required_qty: item.required_qty,
      existing_qty: item.existing_qty,
      status: item.status,
      priority: item.priority,
      responsible: item.responsible ?? "",
      blocks_readiness: item.blocks_readiness,
      notes: item.notes ?? "",
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const name = form.name.trim();
      if (!name) throw new Error("Informe o nome do item.");

      const room = form.room.trim() || "Geral";
      const duplicate = items.find(
        (item) =>
          item.id !== editingItem?.id &&
          normalizedKey(item.name, item.room) === normalizedKey(name, room),
      );
      if (duplicate) {
        throw new Error(
          `Já existe “${duplicate.name}” em ${duplicate.room || "Geral"}. Edite o item existente.`,
        );
      }

      const payload = {
        implementation_id: implementationId,
        module: form.module,
        name,
        room,
        size: form.size.trim() || null,
        required_qty: Math.max(0, Number(form.required_qty) || 0),
        existing_qty: Math.max(0, Number(form.existing_qty) || 0),
        status: form.status,
        priority: form.priority,
        responsible: form.responsible.trim() || null,
        blocks_readiness: form.blocks_readiness,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editingItem) {
        const { error } = await supabase
          .from("implementation_supply_items")
          .update(payload)
          .eq("id", editingItem.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("implementation_supply_items").insert([
        {
          ...payload,
          display_order: items.length + 1,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success(editingItem ? "Item atualizado" : "Item adicionado");
      await invalidate();
      closeDialog();
    },
    onError: (error: unknown) => {
      toast.error("Não foi possível salvar", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (item: SupplyItem) => {
      const { error } = await supabase
        .from("implementation_supply_items")
        .delete()
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Item removido");
      await invalidate();
      closeDialog();
    },
    onError: (error: unknown) => {
      toast.error("Não foi possível remover", {
        description: error instanceof Error ? error.message : "Tente novamente.",
      });
    },
  });

  const handleDelete = () => {
    if (!editingItem || typeof window === "undefined") return;
    if (!window.confirm(`Remover “${editingItem.name}” do inventário?`)) return;
    deleteMutation.mutate(editingItem);
  };

  return (
    <div className="flex flex-col gap-4" data-testid="inventory-domain">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-950">Inventário</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
            Um único lugar para registrar o que o imóvel precisa, o que já possui e o que ainda
            falta.
          </p>
        </div>
        <Button type="button" size="sm" className="w-full gap-1.5 sm:w-auto" onClick={openAdd}>
          <Plus className="size-4" aria-hidden="true" />
          Adicionar item
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:max-w-xl">
        <Metric label="Itens" value={counts.todos} />
        <Metric label="Faltando" value={counts.faltando} attention={counts.faltando > 0} />
        <Metric label="Bloqueadores" value={counts.bloqueadores} danger={counts.bloqueadores > 0} />
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar inventário">
        {filterLabels.map((option) => {
          const active = filter === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(option.id)}
              className={`min-h-9 rounded-full border px-3 text-xs font-medium transition ${
                active
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              {option.label}
              <span className="ml-1.5 opacity-70">{counts[option.id]}</span>
            </button>
          );
        })}
      </div>

      {query.isPending ? (
        <InventoryMessage title="Carregando inventário…" />
      ) : query.isError ? (
        <InventoryMessage
          title="Não foi possível carregar o inventário"
          description="Os dados não foram tratados como uma lista vazia."
          action={
            <Button type="button" size="sm" variant="outline" onClick={() => void query.refetch()}>
              Tentar novamente
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <InventoryMessage
          title="Nenhum item cadastrado"
          description="Adicione o primeiro item para começar a conferência do imóvel."
          action={
            <Button type="button" size="sm" onClick={openAdd}>
              <Plus className="mr-1.5 size-4" aria-hidden="true" /> Adicionar item
            </Button>
          }
        />
      ) : visibleItems.length === 0 ? (
        <InventoryMessage
          title="Nenhum item neste filtro"
          description="Os itens continuam no inventário e podem ser vistos em Todos."
        />
      ) : (
        <div className="space-y-5">
          {groupedItems.map(([room, roomItems]) => (
            <section key={room} aria-labelledby={`inventory-room-${slug(room)}`}>
              <div className="mb-2 flex items-center justify-between gap-3 px-1">
                <h3
                  id={`inventory-room-${slug(room)}`}
                  className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500"
                >
                  {room}
                </h3>
                <span className="text-[11px] text-slate-400">
                  {roomItems.length} {roomItems.length === 1 ? "item" : "itens"}
                </span>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                {roomItems.map((item, index) => (
                  <InventoryRow
                    key={item.id}
                    item={item}
                    divided={index > 0}
                    onEdit={() => openEdit(item)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}
      >
        <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-xl overflow-y-auto rounded-2xl sm:w-full">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar item" : "Adicionar item"}</DialogTitle>
            <DialogDescription>
              Necessário e possui definem automaticamente se o item está faltando.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-1 sm:grid-cols-2">
            <Field className="sm:col-span-2" label="Nome">
              <Input
                autoFocus
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Ex.: Cafeteira"
              />
            </Field>

            <Field label="Ambiente">
              <Input
                value={form.room}
                onChange={(event) =>
                  setForm((current) => ({ ...current, room: event.target.value }))
                }
                placeholder="Ex.: Cozinha"
              />
            </Field>

            <Field label="Tamanho / variação">
              <Input
                value={form.size}
                onChange={(event) =>
                  setForm((current) => ({ ...current, size: event.target.value }))
                }
                placeholder="Opcional"
              />
            </Field>

            <Field label="Necessário">
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                value={form.required_qty}
                onChange={(event) =>
                  setForm((current) => ({ ...current, required_qty: Number(event.target.value) }))
                }
              />
            </Field>

            <Field label="Possui">
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                value={form.existing_qty}
                onChange={(event) =>
                  setForm((current) => ({ ...current, existing_qty: Number(event.target.value) }))
                }
              />
            </Field>

            <Field label="Estado operacional">
              <select
                className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({ ...current, status: event.target.value as SupplyStatus }))
                }
              >
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Prioridade">
              <select
                className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                value={form.priority}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    priority: event.target.value as SupplyPriority,
                  }))
                }
              >
                {Object.entries(priorityLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Origem interna">
              <select
                className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
                value={form.module}
                onChange={(event) =>
                  setForm((current) => ({ ...current, module: event.target.value as SupplyModule }))
                }
              >
                <option value="enxoval">Inventário</option>
                <option value="faltante">Pendência manual</option>
              </select>
            </Field>

            <Field label="Responsável">
              <Input
                value={form.responsible}
                onChange={(event) =>
                  setForm((current) => ({ ...current, responsible: event.target.value }))
                }
                placeholder="Ex.: stayo"
              />
            </Field>

            <label className="sm:col-span-2 flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                checked={form.blocks_readiness}
                onChange={(event) =>
                  setForm((current) => ({ ...current, blocks_readiness: event.target.checked }))
                }
                className="size-4"
              />
              <span>
                <strong className="block text-slate-800">Bloqueia prontidão</strong>
                <span className="text-xs text-slate-500">
                  Use quando a falta impede a ativação do imóvel.
                </span>
              </span>
            </label>

            <Field className="sm:col-span-2" label="Observações">
              <textarea
                rows={3}
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
                className="w-full resize-y rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Opcional"
              />
            </Field>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {editingItem ? (
              <Button
                type="button"
                variant="ghost"
                className="text-red-700 hover:bg-red-50 hover:text-red-800"
                disabled={deleteMutation.isPending || saveMutation.isPending}
                onClick={handleDelete}
              >
                <Trash2 className="mr-1.5 size-4" aria-hidden="true" /> Remover
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={saveMutation.isPending || !form.name.trim()}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? "Salvando…" : "Salvar item"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InventoryRow({
  item,
  divided,
  onEdit,
}: {
  item: SupplyItem;
  divided: boolean;
  onEdit: () => void;
}) {
  const missing = inventoryMissingQuantity(item);
  const resolved = isInventoryResolved(item);
  const blocker = isInventoryBlocker(item);

  return (
    <button
      type="button"
      onClick={onEdit}
      className={`group grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50 ${
        divided ? "border-t border-slate-100" : ""
      }`}
      aria-label={`Editar ${item.name}`}
    >
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <strong className="truncate text-sm font-semibold text-slate-900">{item.name}</strong>
          {item.size ? <span className="text-xs text-slate-400">{item.size}</span> : null}
          {blocker ? (
            <Badge variant="outline" className="border-red-200 bg-red-50 text-[10px] text-red-700">
              <ShieldAlert className="mr-1 size-3" aria-hidden="true" /> Bloqueador
            </Badge>
          ) : null}
        </span>
        <span className="mt-1 block text-xs text-slate-500">
          Necessário {item.required_qty} · possui {item.existing_qty}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
          <span>{inventoryOriginLabel(item.module)}</span>
          <span aria-hidden="true">·</span>
          <span>{statusLabels[item.status]}</span>
          {item.responsible ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{item.responsible}</span>
            </>
          ) : null}
        </span>
      </span>

      <span className="flex items-center gap-2 self-center">
        <span
          className={`text-right text-xs font-semibold ${
            resolved ? "text-emerald-700" : blocker ? "text-red-700" : "text-amber-700"
          }`}
        >
          {resolved ? (
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="size-3.5" aria-hidden="true" /> Completo
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <AlertCircle className="size-3.5" aria-hidden="true" /> {inventoryStateLabel(item)}
            </span>
          )}
          {!resolved && missing === 0 ? <span className="sr-only">Pendente</span> : null}
        </span>
        <Pencil
          className="hidden size-3.5 text-slate-300 group-hover:text-slate-500 sm:block"
          aria-hidden="true"
        />
        <ChevronRight className="size-4 text-slate-300 sm:hidden" aria-hidden="true" />
      </span>
    </button>
  );
}

function Metric({
  label,
  value,
  attention = false,
  danger = false,
}: {
  label: string;
  value: number;
  attention?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <span className="block truncate text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
        {label}
      </span>
      <strong
        className={`mt-0.5 block text-lg ${
          danger ? "text-red-700" : attention ? "text-amber-700" : "text-slate-900"
        }`}
      >
        {value}
      </strong>
    </div>
  );
}

function InventoryMessage({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center">
      <Package className="mx-auto size-7 text-slate-300" aria-hidden="true" />
      <strong className="mt-3 block text-sm text-slate-800">{title}</strong>
      {description ? (
        <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs text-slate-600">{label}</Label>
      {children}
    </div>
  );
}

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .toLowerCase();
}
