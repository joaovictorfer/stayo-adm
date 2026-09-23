/**
 * Planilha de enxoval: linhas editáveis (Ambiente · Item · Quantidade ·
 * Fornecedor), catálogo global que memoriza cada item cadastrado e sugere
 * o preenchimento automático, documentos de compra (proposta, fatura,
 * nota fiscal) em bucket privado e dados de pagamento. Alterações de
 * etapa e anexos alimentam a linha do tempo por trigger no banco.
 */

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileText, Loader2, Paperclip, Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";

export const STAYO_PIX_KEY = "67.217.149/0001-06";

const STAGES = [
  { value: "em_analise", label: "Em análise", class: "bg-slate-100 text-slate-700" },
  { value: "proposta", label: "Proposta", class: "bg-blue-100 text-blue-800" },
  { value: "fechamento", label: "Fechamento", class: "bg-amber-100 text-amber-800" },
  {
    value: "aguardando_servico",
    label: "Aguardando serviço",
    class: "bg-indigo-100 text-indigo-800",
  },
  { value: "concluido", label: "Concluído", class: "bg-emerald-100 text-emerald-800" },
] as const;

const DOC_KINDS = [
  { value: "proposta", label: "Proposta" },
  { value: "fatura", label: "Fatura" },
  { value: "nota_fiscal", label: "Nota fiscal" },
  { value: "contrato", label: "Contrato" },
  { value: "outro", label: "Outro" },
] as const;

interface SupplyRow {
  id: string;
  room: string | null;
  name: string;
  required_qty: number;
  supplier: string | null;
  size: string | null;
  unit_cost: number | null;
  procurement_stage: string;
  payment_target: string;
  payee_name: string | null;
  pix_key: string | null;
  pix_hidden: boolean;
  module: string;
}

interface CatalogRow {
  id: string;
  name: string;
  room: string | null;
  supplier: string | null;
  size: string | null;
  unit_cost: number | null;
  usage_count: number;
}

interface DocRow {
  id: string;
  kind: string;
  filename: string;
  storage_path: string;
  size_bytes: number;
  created_at: string;
}

interface SupplySheetProps {
  implementationId: string;
}

export function SupplySheet({ implementationId }: SupplySheetProps) {
  const queryClient = useQueryClient();
  const [docsItem, setDocsItem] = useState<SupplyRow | null>(null);
  const [payItem, setPayItem] = useState<SupplyRow | null>(null);
  const [draft, setDraft] = useState({ room: "", name: "", qty: "1", supplier: "" });
  const [suggestOpen, setSuggestOpen] = useState(false);

  const itemsQuery = useQuery({
    queryKey: ["supply_items", implementationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implementation_supply_items")
        .select(
          "id, room, name, required_qty, supplier, size, unit_cost, procurement_stage, payment_target, payee_name, pix_key, pix_hidden, module",
        )
        .eq("implementation_id", implementationId)
        .order("room", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as SupplyRow[];
    },
  });

  const catalogQuery = useQuery({
    queryKey: ["supply_catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supply_catalog_items")
        .select("id, name, room, supplier, size, unit_cost, usage_count")
        .order("usage_count", { ascending: false })
        .limit(400);
      if (error) throw error;
      return (data ?? []) as unknown as CatalogRow[];
    },
  });

  const docCountsQuery = useQuery({
    queryKey: ["supply_docs_count", implementationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supply_item_documents")
        .select("supply_item_id")
        .eq("implementation_id", implementationId);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of (data ?? []) as { supply_item_id: string }[]) {
        counts[row.supply_item_id] = (counts[row.supply_item_id] ?? 0) + 1;
      }
      return counts;
    },
  });

  const items = itemsQuery.data ?? [];
  const catalog = catalogQuery.data ?? [];
  const docCounts = docCountsQuery.data ?? {};

  const rooms = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) if (item.room) set.add(item.room);
    for (const entry of catalog) if (entry.room) set.add(entry.room);
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [items, catalog]);

  const suppliers = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) if (item.supplier) set.add(item.supplier);
    for (const entry of catalog) if (entry.supplier) set.add(entry.supplier);
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [items, catalog]);

  const suggestions = useMemo(() => {
    const term = draft.name.trim().toLowerCase();
    if (term.length < 2) return [];
    const roomTerm = draft.room.trim().toLowerCase();
    return catalog
      .filter((entry) => entry.name.toLowerCase().includes(term))
      .sort((a, b) => {
        const aRoom = (a.room ?? "").toLowerCase() === roomTerm ? 0 : 1;
        const bRoom = (b.room ?? "").toLowerCase() === roomTerm ? 0 : 1;
        if (aRoom !== bRoom) return aRoom - bRoom;
        return b.usage_count - a.usage_count;
      })
      .slice(0, 6);
  }, [catalog, draft.name, draft.room]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["supply_items", implementationId] });
    void queryClient.invalidateQueries({ queryKey: ["supply_catalog"] });
  };

  const createMutation = useMutation({
    mutationFn: async (payload: {
      room: string;
      name: string;
      qty: number;
      supplier: string;
      size?: string | null;
      unitCost?: number | null;
    }) => {
      const { error } = await supabase.from("implementation_supply_items").insert([
        {
          implementation_id: implementationId,
          module: "enxoval",
          name: payload.name,
          room: payload.room || "Geral",
          size: payload.size ?? null,
          unit_cost: payload.unitCost ?? null,
          required_qty: payload.qty,
          existing_qty: 0,
          status: "pendente",
          priority: "media",
          supplier: payload.supplier || null,
          procurement_stage: "em_analise",
          payment_target: "stayo",
          blocks_readiness: false,
          display_order: items.length,
        } as never,
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft((prev) => ({ room: prev.room, name: "", qty: "1", supplier: "" }));
      invalidate();
    },
    onError: (error: unknown) =>
      toast.error(messageOf(error, "Não foi possível adicionar o item.")),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase
        .from("implementation_supply_items")
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error: unknown) =>
      toast.error(messageOf(error, "Não foi possível salvar a alteração.")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("implementation_supply_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item removido.");
      invalidate();
    },
    onError: (error: unknown) => toast.error(messageOf(error, "Não foi possível remover o item.")),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, SupplyRow[]>();
    for (const item of items) {
      const key = item.room || "Geral";
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [items]);

  const commitDraft = () => {
    const name = draft.name.trim();
    if (!name) return;
    createMutation.mutate({
      room: draft.room.trim(),
      name,
      qty: Number(draft.qty) || 1,
      supplier: draft.supplier.trim(),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <datalist id="supply-rooms">
        {rooms.map((room) => (
          <option key={room} value={room} />
        ))}
      </datalist>
      <datalist id="supply-suppliers">
        {suppliers.map((supplier) => (
          <option key={supplier} value={supplier} />
        ))}
      </datalist>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Planilha de enxoval</h2>
          <p className="text-xs text-slate-500">
            Digite ambiente, item, quantidade e fornecedor. Itens já cadastrados aparecem como
            sugestão.
          </p>
        </div>
        <Badge variant="outline" className="text-[11px]">
          {items.length} {items.length === 1 ? "linha" : "linhas"}
        </Badge>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 font-medium">Ambiente</th>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="w-24 px-3 py-2 font-medium">Qtd.</th>
              <th className="px-3 py-2 font-medium">Fornecedor</th>
              <th className="w-44 px-3 py-2 font-medium">Status</th>
              <th className="w-40 px-3 py-2 font-medium">Pagamento</th>
              <th className="w-28 px-3 py-2 font-medium">Arquivos</th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {itemsQuery.isLoading ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-xs text-slate-500">
                  Carregando planilha...
                </td>
              </tr>
            ) : null}

            {grouped.map(([room, rows]) => (
              <Fragment key={`group-${room}`}>
                <tr className="bg-slate-50/60">
                  <td
                    colSpan={8}
                    className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                  >
                    {room} · {rows.length} {rows.length === 1 ? "item" : "itens"}
                  </td>
                </tr>
                {rows.map((item) => (
                  <SheetRow
                    key={item.id}
                    item={item}
                    docCount={docCounts[item.id] ?? 0}
                    onPatch={(patch) => updateMutation.mutate({ id: item.id, patch })}
                    onDelete={() => deleteMutation.mutate(item.id)}
                    onOpenDocs={() => setDocsItem(item)}
                    onOpenPayment={() => setPayItem(item)}
                  />
                ))}
              </Fragment>
            ))}

            {/* Linha de digitação */}
            <tr className="border-t bg-emerald-50/30">
              <td className="px-2 py-1.5">
                <Input
                  list="supply-rooms"
                  value={draft.room}
                  placeholder="Quarto 01"
                  onChange={(event) => setDraft({ ...draft, room: event.target.value })}
                  className="h-8 border-transparent bg-white text-sm focus-visible:border-input"
                />
              </td>
              <td className="relative px-2 py-1.5">
                <Input
                  value={draft.name}
                  placeholder="Travesseiro"
                  onChange={(event) => {
                    setDraft({ ...draft, name: event.target.value });
                    setSuggestOpen(true);
                  }}
                  onFocus={() => setSuggestOpen(true)}
                  onBlur={() => window.setTimeout(() => setSuggestOpen(false), 150)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitDraft();
                  }}
                  className="h-8 border-transparent bg-white text-sm focus-visible:border-input"
                />
                {suggestOpen && suggestions.length > 0 ? (
                  <div className="absolute left-2 right-2 top-full z-30 mt-1 overflow-hidden rounded-md border bg-white shadow-lg">
                    {suggestions.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition-colors hover:bg-emerald-50"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setSuggestOpen(false);
                          createMutation.mutate({
                            room: draft.room.trim() || entry.room || "Geral",
                            name: entry.name,
                            qty: Number(draft.qty) || 1,
                            supplier: entry.supplier ?? "",
                            size: entry.size,
                            unitCost: entry.unit_cost,
                          });
                        }}
                      >
                        <span className="font-medium text-slate-800">{entry.name}</span>
                        <span className="text-slate-500">
                          {entry.supplier ?? "sem fornecedor"}
                          {entry.room ? ` · ${entry.room}` : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </td>
              <td className="px-2 py-1.5">
                <Input
                  type="number"
                  min={1}
                  value={draft.qty}
                  onChange={(event) => setDraft({ ...draft, qty: event.target.value })}
                  className="h-8 border-transparent bg-white text-sm focus-visible:border-input"
                />
              </td>
              <td className="px-2 py-1.5">
                <Input
                  list="supply-suppliers"
                  value={draft.supplier}
                  placeholder="Fornecedor"
                  onChange={(event) => setDraft({ ...draft, supplier: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitDraft();
                  }}
                  className="h-8 border-transparent bg-white text-sm focus-visible:border-input"
                />
              </td>
              <td colSpan={4} className="px-2 py-1.5">
                <Button
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={commitDraft}
                  disabled={!draft.name.trim() || createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Adicionar linha
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {docsItem ? (
        <DocumentsDialog
          implementationId={implementationId}
          item={docsItem}
          onClose={() => setDocsItem(null)}
          onChanged={() => {
            void queryClient.invalidateQueries({
              queryKey: ["supply_docs_count", implementationId],
            });
          }}
        />
      ) : null}

      {payItem ? (
        <PaymentDialog
          item={payItem}
          onClose={() => setPayItem(null)}
          onSave={(patch) => {
            updateMutation.mutate({ id: payItem.id, patch });
            setPayItem(null);
          }}
        />
      ) : null}
    </div>
  );
}

function SheetRow({
  item,
  docCount,
  onPatch,
  onDelete,
  onOpenDocs,
  onOpenPayment,
}: {
  item: SupplyRow;
  docCount: number;
  onPatch: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
  onOpenDocs: () => void;
  onOpenPayment: () => void;
}) {
  const [room, setRoom] = useState(item.room ?? "");
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(String(item.required_qty));
  const [supplier, setSupplier] = useState(item.supplier ?? "");

  useEffect(() => {
    setRoom(item.room ?? "");
    setName(item.name);
    setQty(String(item.required_qty));
    setSupplier(item.supplier ?? "");
  }, [item.room, item.name, item.required_qty, item.supplier]);

  const stage = STAGES.find((entry) => entry.value === item.procurement_stage) ?? STAGES[0];

  return (
    <tr className="border-t transition-colors hover:bg-slate-50/60">
      <td className="px-2 py-1">
        <Input
          list="supply-rooms"
          value={room}
          onChange={(event) => setRoom(event.target.value)}
          onBlur={() =>
            room.trim() !== (item.room ?? "") && onPatch({ room: room.trim() || "Geral" })
          }
          className="h-8 border-transparent bg-transparent text-sm focus-visible:border-input focus-visible:bg-white"
        />
      </td>
      <td className="px-2 py-1">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => name.trim() && name.trim() !== item.name && onPatch({ name: name.trim() })}
          className="h-8 border-transparent bg-transparent text-sm font-medium focus-visible:border-input focus-visible:bg-white"
        />
      </td>
      <td className="px-2 py-1">
        <Input
          type="number"
          min={0}
          value={qty}
          onChange={(event) => setQty(event.target.value)}
          onBlur={() =>
            Number(qty) !== item.required_qty && onPatch({ required_qty: Number(qty) || 0 })
          }
          className="h-8 border-transparent bg-transparent text-sm focus-visible:border-input focus-visible:bg-white"
        />
      </td>
      <td className="px-2 py-1">
        <Input
          list="supply-suppliers"
          value={supplier}
          placeholder="—"
          onChange={(event) => setSupplier(event.target.value)}
          onBlur={() =>
            supplier.trim() !== (item.supplier ?? "") &&
            onPatch({ supplier: supplier.trim() || null })
          }
          className="h-8 border-transparent bg-transparent text-sm focus-visible:border-input focus-visible:bg-white"
        />
      </td>
      <td className="px-2 py-1">
        <Select
          value={item.procurement_stage}
          onValueChange={(value) => onPatch({ procurement_stage: value })}
        >
          <SelectTrigger className={`h-8 border-transparent text-xs ${stage.class}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STAGES.map((entry) => (
              <SelectItem key={entry.value} value={entry.value} className="text-xs">
                {entry.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-2 py-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-full justify-start gap-1.5 text-xs"
          onClick={onOpenPayment}
        >
          <Wallet className="h-3.5 w-3.5" />
          {item.payment_target === "stayo" ? "Stayo" : item.payee_name || "Terceiro"}
        </Button>
      </td>
      <td className="px-2 py-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-full justify-start gap-1.5 text-xs"
          onClick={onOpenDocs}
        >
          <Paperclip className="h-3.5 w-3.5" />
          {docCount > 0 ? `${docCount}` : "Anexar"}
        </Button>
      </td>
      <td className="px-1 py-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-400 transition-colors hover:text-red-600"
          onClick={onDelete}
          aria-label="Remover item"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}

function PaymentDialog({
  item,
  onClose,
  onSave,
}: {
  item: SupplyRow;
  onClose: () => void;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [target, setTarget] = useState(item.payment_target);
  const [payee, setPayee] = useState(item.payee_name ?? "");
  const [pix, setPix] = useState(item.pix_key ?? "");
  const [hidden, setHidden] = useState(item.pix_hidden);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pagamento · {item.name}</DialogTitle>
          <DialogDescription>Defina para quem o valor deve ser pago.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(["stayo", "terceiro"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTarget(value)}
                className={`rounded-lg border p-3 text-left text-sm transition-all ${
                  target === value
                    ? "border-emerald-500 bg-emerald-50 shadow-sm"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <span className="font-medium text-slate-900">
                  {value === "stayo" ? "Stayo" : "Terceiro"}
                </span>
                <span className="mt-0.5 block text-[11px] text-slate-500">
                  {value === "stayo" ? "Pix no CNPJ da Stayo" : "Fornecedor recebe direto"}
                </span>
              </button>
            ))}
          </div>

          {target === "stayo" ? (
            <div className="rounded-lg border bg-slate-50 p-3 text-sm">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Chave Pix (CNPJ)</p>
              <p className="mt-1 font-semibold text-slate-900">{STAYO_PIX_KEY}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Quem recebe</Label>
                <Input
                  value={payee}
                  onChange={(event) => setPayee(event.target.value)}
                  placeholder="Nome do fornecedor"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Chave Pix</Label>
                <Input
                  value={pix}
                  onChange={(event) => setPix(event.target.value)}
                  placeholder="CNPJ, e-mail ou telefone"
                  disabled={hidden}
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <Checkbox checked={hidden} onCheckedChange={(value) => setHidden(value === true)} />
                Não cadastrar a chave — consta na fatura
              </label>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              onSave({
                payment_target: target,
                payee_name: target === "terceiro" ? payee.trim() || null : null,
                pix_key: target === "terceiro" && !hidden ? pix.trim() || null : null,
                pix_hidden: target === "terceiro" ? hidden : false,
              })
            }
          >
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DocumentsDialog({
  implementationId,
  item,
  onClose,
  onChanged,
}: {
  implementationId: string;
  item: SupplyRow;
  onClose: () => void;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<string>("proposta");
  const [uploading, setUploading] = useState(false);

  const docsQuery = useQuery({
    queryKey: ["supply_docs", item.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supply_item_documents")
        .select("id, kind, filename, storage_path, size_bytes, created_at")
        .eq("supply_item_id", item.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DocRow[];
    },
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["supply_docs", item.id] });
    onChanged();
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const path = `${implementationId}/${item.id}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("supply-documents")
        .upload(path, file);
      if (uploadError) throw uploadError;
      const { error } = await supabase.from("supply_item_documents").insert([
        {
          implementation_id: implementationId,
          supply_item_id: item.id,
          kind,
          storage_path: path,
          filename: file.name,
          mime_type: file.type || "application/octet-stream",
          size_bytes: file.size,
        } as never,
      ]);
      if (error) throw error;
      toast.success("Documento anexado e registrado na linha do tempo.");
      refresh();
    } catch (error) {
      toast.error(messageOf(error, "Não foi possível anexar o documento."));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDownload = async (doc: DocRow) => {
    const { data, error } = await supabase.storage
      .from("supply-documents")
      .createSignedUrl(doc.storage_path, 60);
    if (error || !data) {
      toast.error("Não foi possível abrir o arquivo.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const handleDelete = async (doc: DocRow) => {
    await supabase.storage.from("supply-documents").remove([doc.storage_path]);
    const { error } = await supabase.from("supply_item_documents").delete().eq("id", doc.id);
    if (error) {
      toast.error("Não foi possível remover o documento.");
      return;
    }
    refresh();
  };

  const docs = docsQuery.data ?? [];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Documentos · {item.name}</DialogTitle>
          <DialogDescription>Propostas, faturas e notas fiscais deste item.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="h-9 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOC_KINDS.map((entry) => (
                <SelectItem key={entry.value} value={entry.value} className="text-xs">
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleUpload(file);
            }}
          />
          <Button
            size="sm"
            className="gap-1.5"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Anexar arquivo
          </Button>
        </div>

        <div className="max-h-72 space-y-2 overflow-y-auto">
          {docs.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-xs text-slate-500">
              Nenhum documento anexado ainda.
            </p>
          ) : (
            docs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-2.5 transition-colors hover:bg-slate-50"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-800">{doc.filename}</p>
                    <p className="text-[11px] text-slate-500">
                      {DOC_KINDS.find((entry) => entry.value === doc.kind)?.label ?? doc.kind} ·{" "}
                      {Math.max(1, Math.round(doc.size_bytes / 1024))} KB
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => void handleDownload(doc)}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400 hover:text-red-600"
                    onClick={() => void handleDelete(doc)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function messageOf(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}
