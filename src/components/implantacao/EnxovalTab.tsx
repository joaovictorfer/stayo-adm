import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Pencil,
  Trash2,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Package,
  Filter,
  Home,
} from "lucide-react";
import { toast } from "sonner";

interface SupplyItem {
  id: string;
  implementation_id: string;
  module: string;
  name: string;
  room: string | null;
  size: string | null;
  required_qty: number;
  existing_qty: number;
  status: string;
  priority: string;
  responsible: string | null;
  blocks_readiness: boolean;
  notes: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface EnxovalTabProps {
  implementationId: string;
  mode?: "inventory" | "missing";
}

type FilterType = "todos" | "bloqueadores" | "comprar" | "resolvidos";

const statusLabels: Record<string, { label: string; class: string }> = {
  pendente: { label: "Pendente", class: "bg-amber-100 text-amber-800 border-amber-300" },
  em_compras: { label: "Em Compras", class: "bg-blue-100 text-blue-800 border-blue-300" },
  comprado: { label: "Comprado", class: "bg-indigo-100 text-indigo-800 border-indigo-300" },
  entregue: { label: "Entregue", class: "bg-purple-100 text-purple-800 border-purple-300" },
  instalado: { label: "Instalado / Concluído", class: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  cancelado: { label: "Cancelado", class: "bg-slate-100 text-slate-600 border-slate-300" },
};

const priorityLabels: Record<string, { label: string; class: string }> = {
  baixa: { label: "Baixa", class: "bg-slate-100 text-slate-700" },
  media: { label: "Média", class: "bg-blue-50 text-blue-700 border-blue-200" },
  alta: { label: "Alta", class: "bg-amber-50 text-amber-700 border-amber-200" },
  urgente: { label: "Urgente", class: "bg-red-50 text-red-700 border-red-200" },
};

export function EnxovalTab({ implementationId, mode = "inventory" }: EnxovalTabProps) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterType>("todos");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SupplyItem | null>(null);

  // State do formulário
  const [formData, setFormData] = useState({
    module: "enxoval" as "enxoval" | "faltante",
    name: "",
    room: "",
    size: "",
    required_qty: 1,
    existing_qty: 0,
    priority: "media",
    responsible: "stayo",
    status: "pendente",
    blocks_readiness: false,
    notes: "",
  });

  // Buscar itens de enxoval da implantação
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["supply_items", implementationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implementation_supply_items")
        .select("*")
        .eq("implementation_id", implementationId)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as SupplyItem[];
    },
  });

  // Mutation para salvar / atualizar item
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        implementation_id: implementationId,
        module: formData.module,
        name: formData.name.trim(),
        room: formData.room.trim() || "Geral",
        size: formData.size.trim() || null,
        required_qty: Number(formData.required_qty) || 0,
        existing_qty: Number(formData.existing_qty) || 0,
        priority: formData.priority as "baixa" | "media" | "alta",
        responsible: formData.responsible.trim() || null,
        status: formData.status as "pendente" | "comprado" | "entregue" | "instalado" | "nao_aplicavel",
        blocks_readiness: formData.blocks_readiness,
        notes: formData.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editingItem) {
        const { error } = await supabase
          .from("implementation_supply_items")
          .update(payload)
          .eq("id", editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("implementation_supply_items")
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingItem ? "Item atualizado!" : "Item adicionado ao enxoval!");
      queryClient.invalidateQueries({ queryKey: ["supply_items", implementationId] });
      handleCloseDialog();
    },
    onError: (err: any) => {
      toast.error(`Erro ao salvar item: ${err.message || err}`);
    },
  });

  // Mutation para deletar item
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("implementation_supply_items")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item removido.");
      queryClient.invalidateQueries({ queryKey: ["supply_items", implementationId] });
    },
    onError: (err: any) => {
      toast.error(`Erro ao remover: ${err.message || err}`);
    },
  });

  const handleOpenAdd = (module: "enxoval" | "faltante" = mode === "missing" ? "faltante" : "enxoval") => {
    setEditingItem(null);
    setFormData({
      module,
      name: "",
      room: "",
      size: "",
      required_qty: 1,
      existing_qty: 0,
      priority: "media",
      responsible: "stayo",
      status: "pendente",
      blocks_readiness: false,
      notes: "",
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (item: SupplyItem) => {
    setEditingItem(item);
    setFormData({
      module: item.module === "faltante" ? "faltante" : "enxoval",
      name: item.name,
      room: item.room || "",
      size: item.size || "",
      required_qty: item.required_qty,
      existing_qty: item.existing_qty,
      priority: item.priority,
      responsible: item.responsible || "",
      status: item.status,
      blocks_readiness: item.blocks_readiness,
      notes: item.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingItem(null);
  };

  // Agrupamento por ambiente
  const inventoryItems = items.filter((item) => item.module === "enxoval");
  const roomGroups = inventoryItems.reduce<Record<string, SupplyItem[]>>((acc, item) => {
    const roomName = item.room || "Geral";
    if (!acc[roomName]) acc[roomName] = [];
    acc[roomName].push(item);
    return acc;
  }, {});

  // Itens Faltantes derivados automaticamente da diferença do enxoval + status
  const isResolved = (item: SupplyItem) =>
    item.status === "instalado" || item.status === "nao_aplicavel" ||
    (item.module === "enxoval" && item.existing_qty >= item.required_qty);

  const isMissing = (item: SupplyItem) => !isResolved(item) && (
    item.module === "faltante" || item.existing_qty < item.required_qty
  );

  const missingItems = items.filter(isMissing);

  const filteredMissingItems = items.filter((item) => {
    if (filter === "bloqueadores") {
      return isMissing(item) && item.blocks_readiness;
    }
    if (filter === "comprar") {
      return isMissing(item) && (item.status === "em_compras" || item.status === "pendente");
    }
    if (filter === "resolvidos") {
      return isResolved(item);
    }
    // "todos"
    return isMissing(item);
  });

  // Métricas rápidas
  const totalItemsCount = inventoryItems.length;
  const totalRequiredQty = inventoryItems.reduce((acc, i) => acc + i.required_qty, 0);
  const totalExistingQty = inventoryItems.reduce((acc, i) => acc + i.existing_qty, 0);
  const blockerCount = items.filter((i) => i.blocks_readiness && i.existing_qty < i.required_qty).length;
  const progressPercent = totalRequiredQty > 0 ? Math.round((totalExistingQty / totalRequiredQty) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      {mode === "inventory" && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total de Itens</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-semibold text-slate-900">{totalItemsCount}</span>
            <span className="text-xs text-slate-500">{totalExistingQty} / {totalRequiredQty} peças</span>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Itens Faltantes</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-semibold text-amber-600">{missingItems.length}</span>
            <span className="text-xs text-slate-500">em pendência</span>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Bloqueadores</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-semibold text-red-600">{blockerCount}</span>
            <span className="text-xs text-slate-500">impedem prontidão</span>
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Cobertura do Enxoval</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-semibold text-emerald-600">{progressPercent}%</span>
            <span className="text-xs text-slate-500">concluído</span>
          </div>
        </div>
      </div>}

      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{mode === "inventory" ? "Inventário necessário por ambiente" : "Itens faltantes"}</h2>
          <p className="mt-1 text-xs text-slate-500">{mode === "inventory" ? "Informe o necessário e o que o imóvel já possui." : "Lista automática do enxoval, somada aos itens manuais."}</p>
        </div>
        <Button onClick={() => handleOpenAdd()} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          {mode === "inventory" ? "Adicionar item" : "Adicionar item manual"}
        </Button>
      </div>

      {mode === "inventory" && (
        <QuickAddRow implementationId={implementationId} />
      )}

      {/* CONTEÚDO 1: INVENTÁRIO POR AMBIENTE */}
      {mode === "inventory" && (
        <div className="space-y-6">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-slate-500">Carregando itens de enxoval...</div>
          ) : Object.keys(roomGroups).length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <Package className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-2 text-sm font-medium text-slate-700">Nenhum item cadastrado no enxoval.</p>
              <p className="text-xs text-slate-500 mt-1">Clique em "Novo Item de Enxoval" para adicionar itens aos ambientes.</p>
               <Button onClick={() => handleOpenAdd("enxoval")} size="sm" className="mt-4 gap-1">
                <Plus className="h-4 w-4" /> Adicionar primeiro item
              </Button>
            </div>
          ) : (
            Object.entries(roomGroups).map(([roomName, roomItems]) => {
              const roomTotalReq = roomItems.reduce((a, i) => a + i.required_qty, 0);
              const roomTotalExist = roomItems.reduce((a, i) => a + i.existing_qty, 0);
              const roomDone = roomTotalExist >= roomTotalReq;

              return (
                <div key={roomName} className="rounded-lg border bg-white shadow-sm overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between border-b bg-slate-50/80 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4 text-slate-600" />
                      <h3 className="font-semibold text-slate-800 text-sm">{roomName}</h3>
                      <span className="text-xs text-slate-500">({roomItems.length} tipos de itens)</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-medium text-slate-600">
                        Qtd: {roomTotalExist} / {roomTotalReq}
                      </span>
                      {roomDone ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Completo
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                          <AlertCircle className="mr-1 h-3 w-3" /> Pendente
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="divide-y">
                    {roomItems.map((item) => {
                      const statusConfig = statusLabels[item.status] || { label: item.status, class: "bg-slate-100" };
                      const prioConfig = priorityLabels[item.priority] || { label: item.priority, class: "bg-slate-100" };

                      return (
                        <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm hover:bg-slate-50/50 transition-colors">
                          <div className="space-y-1 min-w-[200px] flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900">{item.name}</span>
                              {item.size && <span className="text-xs text-slate-500">({item.size})</span>}
                              {item.blocks_readiness && (
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px]">
                                  <ShieldAlert className="mr-1 h-3 w-3" /> Bloqueia prontidão
                                </Badge>
                              )}
                            </div>
                            {item.notes && <p className="text-xs text-slate-500">{item.notes}</p>}
                          </div>

                          <div className="flex flex-wrap items-center gap-4">
                             <div className="text-xs text-right">
                               <span className="text-slate-500 block">Inventário</span>
                               <span className="font-semibold text-slate-800">Necessário {item.required_qty} · possui {item.existing_qty}</span>
                               <span className="block text-[11px] text-slate-500">{item.existing_qty >= item.required_qty ? "Completo" : `Falta ${item.required_qty - item.existing_qty}`}</span>
                            </div>

                            <div className="text-xs text-right min-w-[90px]">
                              <span className="text-slate-500 block">Responsável</span>
                              <span className="capitalize text-slate-700">{item.responsible || "-"}</span>
                            </div>

                            <Badge variant="outline" className={`${prioConfig.class} text-[11px]`}>
                              {prioConfig.label}
                            </Badge>

                            <Badge variant="outline" className={`${statusConfig.class} text-[11px]`}>
                              {statusConfig.label}
                            </Badge>

                            <div className="flex items-center gap-1 border-l pl-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-slate-900"
                                onClick={() => handleOpenEdit(item)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => {
                                  if (confirm(`Remover ${item.name}?`)) {
                                    deleteMutation.mutate(item.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* CONTEÚDO 2: ITENS FALTANTES E FILTROS */}
      {mode === "missing" && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-slate-50 p-3 text-xs">
            <div className="flex items-center gap-1.5 text-slate-600 font-medium mr-2">
              <Filter className="h-3.5 w-3.5" /> Filtros:
            </div>
            {(
              [
                 { key: "todos", label: "Todos" },
                { key: "bloqueadores", label: "Bloqueadores" },
                 { key: "comprar", label: "Comprar" },
                { key: "resolvidos", label: "Resolvidos" },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-3 py-1 font-medium transition-colors ${
                  filter === f.key
                    ? "bg-slate-800 text-white"
                    : "bg-white text-slate-600 border hover:bg-slate-100"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Tabela Solicitada */}
          <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-[220px]">Item</TableHead>
                  <TableHead className="text-center">Quantidade</TableHead>
                  <TableHead>Ambiente</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="text-center">Bloqueia?</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMissingItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-slate-500">
                      Nenhum item encontrado para este filtro.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMissingItems.map((item) => {
                    const statusConfig = statusLabels[item.status] || { label: item.status, class: "bg-slate-100" };
                    const prioConfig = priorityLabels[item.priority] || { label: item.priority, class: "bg-slate-100" };
                    const missingQty = Math.max(0, item.required_qty - item.existing_qty);

                    return (
                      <TableRow key={item.id} className="hover:bg-slate-50/60">
                        <TableCell className="font-medium text-slate-900">
                          <div>{item.name}</div>
                          {item.size && <div className="text-xs text-slate-500">Tamanho: {item.size}</div>}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-semibold text-amber-700">{item.existing_qty} / {item.required_qty}</span>
                          {missingQty > 0 && (
                            <span className="block text-[11px] text-slate-500">(faltam {missingQty})</span>
                          )}
                        </TableCell>
                        <TableCell>{item.room || "Geral"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${prioConfig.class} text-[11px]`}>
                            {prioConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize text-slate-700">{item.responsible || "-"}</TableCell>
                        <TableCell className="text-center">
                          {item.blocks_readiness ? (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px]">
                              Sim
                            </Badge>
                          ) : (
                            <span className="text-xs text-slate-400">Não</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${statusConfig.class} text-[11px]`}>
                            {statusConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-600 hover:text-slate-900"
                            onClick={() => handleOpenEdit(item)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* MODAL / DIALOG DE CADASTRO E EDIÇÃO */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
             <DialogTitle>{editingItem ? "Editar item" : formData.module === "faltante" ? "Adicionar item manual" : "Novo item de enxoval"}</DialogTitle>
            <DialogDescription>
               {formData.module === "faltante" ? "Inclua somente uma falta que não nasce do inventário." : "Preencha o necessário e o que já existe no ambiente."}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
            className="space-y-4 py-2"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="name">Nome do Item *</Label>
                <Input
                  id="name"
                  required
                  placeholder="Ex: Jogo de Lençol Casal 200 Fios"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="room">Ambiente</Label>
                <Input
                  id="room"
                  placeholder="Ex: Quarto 1, Suíte, Cozinha"
                  value={formData.room}
                  onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="size">Tamanho / Especificação</Label>
                <Input
                  id="size"
                  placeholder="Ex: Queen, Solteiro, 50x70cm"
                  value={formData.size}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="required_qty">Quantidade Necessária *</Label>
                <Input
                  id="required_qty"
                  type="number"
                  min={1}
                  required
                  value={formData.required_qty}
                  onChange={(e) => setFormData({ ...formData, required_qty: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="existing_qty">Quantidade Existente</Label>
                <Input
                  id="existing_qty"
                  type="number"
                  min={0}
                  value={formData.existing_qty}
                  onChange={(e) => setFormData({ ...formData, existing_qty: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="priority">Prioridade</Label>
                <select
                  id="priority"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="responsible">Responsável</Label>
                <Input
                  id="responsible"
                  placeholder="Ex: stayo, proprietario"
                  value={formData.responsible}
                  onChange={(e) => setFormData({ ...formData, responsible: e.target.value })}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="status">Status do Item</Label>
                <select
                  id="status"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="pendente">Pendente</option>
                  <option value="comprado">Comprado</option>
                  <option value="entregue">Entregue</option>
                  <option value="instalado">Instalado / Concluído</option>
                   <option value="nao_aplicavel">Não aplicável</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2 sm:col-span-2">
                <input
                  type="checkbox"
                  id="blocks_readiness"
                  checked={formData.blocks_readiness}
                  onChange={(e) => setFormData({ ...formData, blocks_readiness: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-700"
                />
                <Label htmlFor="blocks_readiness" className="cursor-pointer text-xs font-medium text-slate-700">
                  Este item bloqueia a prontidão da implantação se estiver ausente
                </Label>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="notes">Observações</Label>
                <Input
                  id="notes"
                  placeholder="Cor, fornecedor ou detalhes adicionais..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} className="bg-emerald-700 text-white hover:bg-emerald-800">
                {saveMutation.isPending ? "Salvando..." : "Salvar Item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Inclusão rápida em linha, um item por vez, sem sair da tela. */
function QuickAddRow({ implementationId }: { implementationId: string }) {
  const queryClient = useQueryClient();
  const [row, setRow] = useState({ name: "", room: "", required: "1", existing: "0" });
  const nameRef = useRef<HTMLInputElement>(null);
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("implementation_supply_items").insert([
        {
          implementation_id: implementationId,
          module: "enxoval",
          name: row.name.trim(),
          room: row.room.trim() || "Geral",
          required_qty: Number(row.required) || 0,
          existing_qty: Number(row.existing) || 0,
          priority: "media" as const,
          responsible: "stayo",
          status: "pendente" as const,
          blocks_readiness: false,
        },
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      setRow((r) => ({ ...r, name: "", required: "1", existing: "0" }));
      void queryClient.invalidateQueries({ queryKey: ["supply_items", implementationId] });
      nameRef.current?.focus();
    },
    onError: (e: unknown) =>
      toast.error("Item não salvo", {
        description: e instanceof Error ? e.message : "O que você digitou continua no campo.",
      }),
  });
  const submit = () => {
    if (!row.name.trim() || add.isPending) return;
    add.mutate();
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="grid gap-2 rounded-lg border bg-white p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_90px_90px_auto] sm:items-end"
    >
      <label className="text-xs font-medium text-slate-600">
        Item
        <Input ref={nameRef} value={row.name} onChange={(e) => setRow({ ...row, name: e.target.value })} placeholder="Ex.: Toalha de banho" className="mt-1" />
      </label>
      <label className="text-xs font-medium text-slate-600">
        Ambiente
        <Input value={row.room} onChange={(e) => setRow({ ...row, room: e.target.value })} placeholder="Ex.: Suíte" className="mt-1" />
      </label>
      <label className="text-xs font-medium text-slate-600">
        Necessário
        <Input inputMode="numeric" value={row.required} onChange={(e) => setRow({ ...row, required: e.target.value.replace(/\D/g, "") })} className="mt-1" />
      </label>
      <label className="text-xs font-medium text-slate-600">
        Já tem
        <Input inputMode="numeric" value={row.existing} onChange={(e) => setRow({ ...row, existing: e.target.value.replace(/\D/g, "") })} className="mt-1" />
      </label>
      <Button type="submit" size="sm" className="h-9 gap-1" disabled={!row.name.trim() || add.isPending}>
        <Plus className="h-4 w-4" /> {add.isPending ? "Salvando…" : "Adicionar"}
      </Button>
    </form>
  );
}
