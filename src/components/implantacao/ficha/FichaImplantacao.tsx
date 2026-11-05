import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  ChevronRight,
  ExternalLink,
  FileCheck2,
  Filter,
  ImageIcon,
  Loader2,
  MoreHorizontal,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { FieldLinkDialog, FieldTabletButton } from "@/components/field/FieldLinkDialog";
import { ChevronDown, Minus } from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InventoryRow } from "./InventoryRow";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InventoryDetailLayout } from "../guide/InventoryDetailLayout";
import { InventoryItemDetails } from "../guide/InventoryItemDetails";
import { InventorySubmissionsReview } from "../guide/InventorySubmissionsReview";
import { GuidePanel, GuideSummary } from "../guide/GuidePanel";
import { MissingItemsTab } from "../MissingItemsTab";
import {
  addInventoryItem,
  duplicateInventoryItem,
  guidedInventoryQuery,
  ensureGuidedInventorySnapshot,
  replicateBedroomItems,
  replicateBathroomItems,
  removeInventoryItem,
  setInventoryAnswer,
  setInventoryCount,
  setInventorySubanswer,
  updateInventoryDetails,
} from "../../../lib/api/guided-inventory";
import { inventorySubItemsFor, mergeSubAnswer, subAnswerFor } from "@/lib/inventory-subitems";
import { signGuideImages } from "../../../lib/api/guides";
import { inventoryReferenceFor, loadInventoryReferenceMedia } from "@/lib/api/inventory-reference-media";
import { inventorySubmissionsQuery } from "../../../lib/api/owner-inventory";
import {
  inventoryConditionLabel,
  type InventoryAnswer,
  type InventoryCondition,
  type InventoryRoom,
  type InventorySnapshotItem,
} from "../../../lib/guided-inventory";

const muted = { color: "var(--stayo-ink-muted)" };
const navy = { color: "var(--stayo-navy)" };
const border = { borderColor: "var(--stayo-border)" };
const display = { fontFamily: "Outfit, var(--stayo-font-ui), sans-serif", letterSpacing: "-0.01em", color: "var(--stayo-navy)" };
const iconCircle = { backgroundColor: "var(--ficha-icon-bg)", color: "var(--ficha-icon-fg)" };

export type InventoryRoomSlot = ((tab: string, items: InventorySnapshotItem[], renderItem: (item: InventorySnapshotItem, extra?: ReactNode, installation?: boolean, subFields?: Record<string, ReactNode>) => ReactNode) => ReactNode) & {
  /** Banheiros sociais e lavabos como abas próprias (banheiroN / lavaboN). Suítes ficam dentro do quarto. */
  bathTabs?: Array<{ id: string; label: string }>;
  roomKeys?: Record<string, string[]>;
};

const QUARTO_CATEGORY = /^Quarto (\d+)$/;
const BANHEIRO_CATEGORY = /^Banheiro (\d+)$/;
const roomTabsFor = (bedrooms: number, bathTabs?: Array<{ id: string; label: string }>): Array<{ id: string; label: string }> => [
  { id: "cozinha", label: "Cozinha" },
  { id: "sala", label: "Sala" },
  ...Array.from({ length: Math.max(1, bedrooms) }, (_, i) => ({ id: `quarto${i + 1}`, label: `Quarto ${i + 1}` })),
  ...(bathTabs ?? [{ id: "banheiro1", label: "Banheiro" }]),
  { id: "lavanderia", label: "Lavanderia" },
  { id: "outros", label: "Outros" },
];
const inRoom = (i: InventorySnapshotItem, r: string) => {
  if (r.startsWith("quarto")) {
    if (i.room !== "quartos") return false;
    const m = i.category ? QUARTO_CATEGORY.exec(i.category) : null;
    return (m ? Number(m[1]) : 1) === Number(r.slice(6));
  }
  if (r.startsWith("banheiro")) {
    if (i.room !== "banheiros") return false;
    if (i.category && /^Lavabo \d+$/.test(i.category)) return false;
    const m = i.category ? BANHEIRO_CATEGORY.exec(i.category) : null;
    return (m ? Number(m[1]) : 1) === Number(r.slice(8) || 1);
  }
  if (r.startsWith("lavabo")) return i.room === "banheiros" && i.category === `Lavabo ${r.slice(6)}`;
  if (r === "outros") return i.room === "outros" || i.room === "externa";
  return i.room === r;
};
const persisted = (r: string): InventoryRoom =>
  r.startsWith("quarto") ? "quartos" : r.startsWith("banheiro") || r.startsWith("lavabo") ? "banheiros" : (r as InventoryRoom);
const quartoCategory = (r: string) =>
  r.startsWith("quarto") && r !== "quarto1" ? `Quarto ${r.slice(6)}`
  : r.startsWith("banheiro") && r !== "banheiro1" ? `Banheiro ${r.slice(8)}`
  : r.startsWith("lavabo") ? `Lavabo ${r.slice(6)}` : undefined;

type Extra = { quantity_text: string | null; tip: string | null; image_path: string | null; purchase_url: string | null; description: string | null; recommended_quantity: number | null };

function when(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `hoje ${time}`;
  if (d.toDateString() === y.toDateString()) return "ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
const safeUrl = (u?: string | null) => (u && /^https:\/\//i.test(u) ? u : null);

export type ImplTab = "inventario" | "enxoval" | "faltantes" | "checklist";

export function FichaImplantacao({
  implementationId,
  checklist,
  checklistPending,
  more,
  wrapInventory,
  onOpenPortal,
}: {
  /** Envolve o inventário: recebe o render do inventário e entrega o conteúdo extra por aba. */
  wrapInventory?: (inventory: (slot?: InventoryRoomSlot) => ReactNode) => ReactNode;
  implementationId: string;
  checklist: ReactNode;
  checklistPending: number;
  more: ReactNode;
  onOpenPortal: () => void;
}) {
  const [tab, setTab] = useState<ImplTab>("inventario");
  const [adding, setAdding] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const inv = useQuery(guidedInventoryQuery(implementationId));
  const subs = useQuery(inventorySubmissionsQuery(implementationId));
  const items = (inv.data ?? []).filter((i) => i.enabled);
  const answered = items.filter((i) => i.inventory_answer).length;
  const missing = items.filter((i) => i.inventory_answer === "nao_tenho").length;
  const pendingReview = (subs.data ?? []).filter((s) => s.status === "enviado");

  const tabs: Array<{ id: ImplTab; label: string }> = [
    { id: "inventario", label: "Inventário" },
    { id: "enxoval", label: "Enxoval" },
    { id: "faltantes", label: "Itens faltantes" },
    { id: "checklist", label: "Checklist" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold sm:text-[1.75rem]" style={display}>Implantação</h2>
          <p className="hidden text-sm sm:block sm:text-base" style={muted}>Conferência e preparação do imóvel para operação.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setTab("inventario");
            setAdding(true);
          }}
          className="flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium sm:px-5"
          style={{ backgroundColor: "var(--stayo-navy)", color: "var(--admin-surface, #fff)" }}
        >
          <Plus className="size-4" /> <span className="hidden sm:inline">Adicionar item</span>
        </button>
      </div>

      <nav className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:gap-x-1 sm:border-b sm:px-0 sm:pb-0" style={border} role="tablist" aria-label="Áreas da implantação">
        {tabs.map((t) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.id)}
              className={`min-h-10 shrink-0 whitespace-nowrap rounded-full border px-4 text-[var(--stayo-navy)] text-sm sm:-mb-px sm:min-h-11 sm:rounded-none sm:border-0 sm:border-b-[3px] ${on ? "max-sm:bg-[var(--stayo-navy)] max-sm:text-[var(--admin-surface,#fff)]" : "max-sm:bg-white"}`}
              style={{ borderColor: on ? "var(--ficha-icon-fg)" : "var(--stayo-border)", fontWeight: on ? 600 : 400 }}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="order-2 min-w-0 lg:order-1">
          {tab === "inventario" ? (
            (() => {
              const inv = (slot?: InventoryRoomSlot) => (
                <InventoryWorkspace
                  implementationId={implementationId}
                  adding={adding}
                  setAdding={setAdding}
                  reviewing={reviewing}
                  pendingReviewIds={new Set(pendingReview.map((s) => s.item_id).filter((x): x is string => !!x))}
                  roomSlot={slot}
                />
              );
              return wrapInventory ? wrapInventory(inv) : inv();
            })()
          ) : tab === "faltantes" ? (
            <Surface>
              <MissingSlot implementationId={implementationId} />
            </Surface>
          ) : tab === "enxoval" ? (
            <Surface>
              <EnxovalSlot implementationId={implementationId} />
            </Surface>
          ) : (
            <Surface>{checklist}</Surface>
          )}
          <div className="mt-4">{more}</div>
        </div>

        <aside className="order-1 flex flex-col gap-4 lg:order-2">
          <section className="rounded-xl border bg-white px-3 py-2 sm:px-5 sm:py-3" style={border}>
            <div className="hidden items-center gap-3 border-b pb-3 pt-1 sm:flex" style={border}>
              <span className="grid size-9 place-items-center rounded-full" style={iconCircle}>
                <FileCheck2 className="size-4" />
              </span>
              <h3 className="text-lg font-semibold" style={display}>Resumo da implantação</h3>
            </div>
            {[
              { label: "Inventário", value: inv.data ? `${answered} respondidos` : "—", go: "inventario" as ImplTab },
              { label: "Faltantes", value: inv.data ? `${missing} ${missing === 1 ? "item" : "itens"}` : "—", go: "faltantes" as ImplTab },
              { label: "Checklist", value: checklistPending ? `${checklistPending} pendências` : "Sem pendências", go: "checklist" as ImplTab },
              { label: "Enxoval", value: <GuideSummary implementationId={implementationId} guideType="enxoval" />, go: "enxoval" as ImplTab },
            ].map((r, idx, arr) => (
              <button
                key={r.label}
                type="button"
                onClick={() => setTab(r.go)}
                className={`grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 text-left text-sm ${idx < arr.length - 1 ? "border-b" : ""}`}
                style={border}
              >
                <span className="font-medium" style={navy}>{r.label}</span>
                <span className="truncate text-xs sm:text-sm" style={muted}>{r.value}</span>
                <ChevronRight className="size-4" style={navy} />
              </button>
            ))}
          </section>

          <section className="rounded-xl border bg-white px-4 py-3 sm:px-5" style={border}>
            <div className="flex items-start gap-3">
              <ExternalLink className="mt-1 size-5 shrink-0" style={navy} />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold" style={display}>Portal do proprietário</h3>
                <p className="text-sm" style={muted}>Acesso e liberações</p>
              </div>
              <button type="button" onClick={onOpenPortal} className="flex items-center gap-1 text-sm underline underline-offset-2" style={{ color: "var(--stayo-navy)" }}>
                Abrir Portal <ExternalLink className="size-3.5" />
              </button>
            </div>
            {pendingReview.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setTab("inventario");
                  setReviewing((v) => !v);
                }}
                className="mt-3 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm"
                style={{ backgroundColor: "var(--ficha-pending-bg)" }}
              >
                <AlertCircle className="size-5 shrink-0" style={{ color: "var(--ficha-pending-fg)" }} />
                <span className="flex-1" style={navy}>
                  {pendingReview.length} {pendingReview.length === 1 ? "alteração aguarda" : "alterações aguardam"} revisão
                </span>
                <span className="underline underline-offset-2" style={navy}>{reviewing ? "Fechar" : "Revisar"}</span>
                <ChevronRight className="size-4" style={navy} />
              </button>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function Surface({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-white p-4 sm:p-5" style={border}>
      {children}
    </section>
  );
}

function MissingSlot({ implementationId }: { implementationId: string }) {
  return <MissingItemsTab implementationId={implementationId} />;
}
function EnxovalSlot({ implementationId }: { implementationId: string }) {
  return <GuidePanel implementationId={implementationId} guideType="enxoval" />;
}

export function InventoryWorkspace({
  implementationId,
  adding,
  setAdding,
  reviewing,
  pendingReviewIds,
  roomSlot,
}: {
  implementationId: string;
  adding: boolean;
  setAdding: (v: boolean) => void;
  reviewing: boolean;
  pendingReviewIds: Set<string>;
  roomSlot?: InventoryRoomSlot | undefined;
}) {
  const qc = useQueryClient();
  const query = guidedInventoryQuery(implementationId);
  const q = useQuery(query);
  const [room, setRoom] = useState("cozinha");
  const bedroomsQ = useQuery({
    queryKey: ["implementation-bedrooms", implementationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implementation_projects")
        .select("bedrooms")
        .eq("id", implementationId)
        .maybeSingle();
      if (error) throw error;
      return (data as { bedrooms: number | null } | null)?.bedrooms ?? null;
    },
    staleTime: 60_000,
  });
  const ROOMS = roomTabsFor(bedroomsQ.data ?? 2, roomSlot?.bathTabs);
  const socialBaths = Math.max(1, ROOMS.filter((r) => r.id.startsWith("banheiro")).length);
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const detailExtras = useRef(new Map<string, ReactNode>());
  const [newName, setNewName] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newCondition, setNewCondition] = useState<InventoryCondition | "">("");
  const [subDetail, setSubDetail] = useState<{ label: string; parentId: string; key: string } | null>(null);
  const [failed, setFailed] = useState<{ item: InventorySnapshotItem; answer: InventoryAnswer | null } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: query.queryKey });
  // Copiar o catálogo para a implantação é uma escrita: só por ação explícita.
  const applySnapshot = useMutation({
    mutationFn: async () => {
      await ensureGuidedInventorySnapshot(implementationId);
      await replicateBedroomItems(implementationId, Math.max(1, bedroomsQ.data ?? 1));
      await replicateBathroomItems(implementationId, socialBaths);
    },
    onSuccess: async () => {
      await refresh();
      await qc.invalidateQueries({ queryKey: ["guided-inventory-extras", implementationId] });
    },
  });

  const referenceMedia = useQuery({ queryKey: ["inventory-reference-media"], queryFn: loadInventoryReferenceMedia, staleTime: 30 * 60_000 });
  const extras = useQuery({
    queryKey: ["guided-inventory-extras", implementationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implementation_guide_items")
        .select("id, image_path, purchase_url, description, recommended_quantity, quantity_text, tip")
        .eq("implementation_id", implementationId)
        .eq("guide_type", "inventario");
      if (error) throw error;
      const rows = (data ?? []) as Array<Extra & { id: string }>;
      const signed = await signGuideImages(rows.map((r) => r.image_path).filter((p): p is string => !!p)).catch(() => ({}) as Record<string, string>);
      return Object.fromEntries(rows.map((r) => [r.id, { ...r, url: r.image_path ? signed[r.image_path] ?? null : null }])) as Record<string, Extra & { url: string | null }>;
    },
    staleTime: 30 * 60 * 1000,
  });

  const answer = useMutation({
    mutationFn: (v: { item: InventorySnapshotItem; answer: InventoryAnswer | null }) => setInventoryAnswer(v.item, implementationId, v.answer),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: query.queryKey });
      const prev = qc.getQueryData<InventorySnapshotItem[]>(query.queryKey);
      qc.setQueryData<InventorySnapshotItem[]>(query.queryKey, (old) =>
        (old ?? []).map((i) => (i.id === v.item.id ? { ...i, inventory_answer: v.answer, inventory_source: "equipe", inventory_updated_at: new Date().toISOString() } : i)),
      );
      return { prev };
    },
    onError: (_e, v, ctx) => {
      if (ctx?.prev) qc.setQueryData(query.queryKey, ctx.prev);
      setFailed(v);
    },
    onSuccess: () => setFailed(null),
  });

  // Toques rápidos são serializados para não gravar fora de ordem.
  const count = useMutation({
    scope: { id: `inventory-count-${implementationId}` },
    mutationFn: (v: { item: InventorySnapshotItem; qty: number }) => setInventoryCount(v.item, implementationId, v.qty),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: query.queryKey });
      qc.setQueryData<InventorySnapshotItem[]>(query.queryKey, (old) =>
        (old ?? []).map((i) =>
          i.id === v.item.id
            ? { ...i, inventory_answer: v.qty > 0 ? "tenho" : "nao_tenho", inventory_quantity: v.qty > 0 ? v.qty : null, inventory_source: "equipe", inventory_updated_at: new Date().toISOString() }
            : i,
        ),
      );
    },
    onError: (_e, v) => {
      toast.error(`Não salvou “${v.item.name}”. Tente de novo.`);
      void refresh();
    },
  });
  const currentQty = (id: string) => {
    const it = qc.getQueryData<InventorySnapshotItem[]>(query.queryKey)?.find((x) => x.id === id);
    return it?.inventory_answer === "tenho" ? Math.max(1, it.inventory_quantity ?? 1) : 0;
  };
  const bump = (i: InventorySnapshotItem, delta: number) => count.mutate({ item: i, qty: Math.max(0, currentQty(i.id) + delta) });

  const subanswer = useMutation({
    mutationFn: (v: { item: InventorySnapshotItem; subKey: string; answer: "tenho" | "nao_tenho" | null }) =>
      setInventorySubanswer(v.item, implementationId, v.subKey, v.answer),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: query.queryKey });
      const prev = qc.getQueryData<InventorySnapshotItem[]>(query.queryKey);
      qc.setQueryData<InventorySnapshotItem[]>(query.queryKey, (old) =>
        (old ?? []).map((i) => (i.id === v.item.id ? { ...i, inventory_subanswers: mergeSubAnswer(i.inventory_subanswers, v.subKey, v.answer) } : i)),
      );
      return { prev };
    },
    onError: (_e, v, ctx) => {
      if (ctx?.prev) qc.setQueryData(query.queryKey, ctx.prev);
    },
  });

  const add = useMutation({
    mutationFn: (name: string) => addInventoryItem(implementationId, persisted(room), name, 1000 + (q.data?.length ?? 0), quartoCategory(room), {
      inventory_quantity: newQuantity ? Number(newQuantity) : null,
      inventory_brand: newBrand.trim() || null,
      inventory_condition: newCondition || null,
      inventory_internal_notes: newNotes.trim() || null,
    }),
    onSuccess: async () => {
      setNewName("");
      setNewQuantity("");
      setNewBrand("");
      setNewNotes("");
      setNewCondition("");
      setAdding(false);
      await refresh();
      await qc.invalidateQueries({ queryKey: ["guided-inventory-extras", implementationId] });
    },
  });

  const items = useMemo(() => (q.data ?? []).filter((i) => i.enabled), [q.data]);
  const rooms = ROOMS.map((r) => ({ ...r, items: items.filter((i) => i.inventory_room_key && roomSlot?.roomKeys ? roomSlot.roomKeys[r.id]?.includes(i.inventory_room_key) === true : inRoom(i, r.id)) }));
  const roomItems = (rooms.find((r) => r.id === room)?.items ?? [])
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .filter((i) => !onlyOpen || !i.inventory_answer || pendingReviewIds.has(i.id));
  const total = items.length;
  const answered = items.filter((i) => i.inventory_answer).length;
  const missing = items.filter((i) => i.inventory_answer === "nao_tenho").length;
  const roomAll = rooms.find((r) => r.id === room)?.items ?? [];
  const roomDone = roomAll.filter((i) => i.inventory_answer).length;
  const detailItem = items.find((i) => i.id === detail) ?? null;
  const itemMedia = (i: InventorySnapshotItem) => {
    const reference = inventoryReferenceFor(i.name, referenceMedia.data);
    const snapshot = extras.data?.[i.id];
    return {
      ...snapshot,
      url: reference.url ?? snapshot?.url,
      description: reference.description ?? snapshot?.description,
      quantity_text: reference.quantity_text ?? snapshot?.quantity_text,
      tip: reference.tip ?? snapshot?.tip ?? i.tip,
    };
  };
  const detailMedia = detailItem ? itemMedia(detailItem) : null;
  const bedroomCount = Math.max(1, bedroomsQ.data ?? 1);
  const emptyBedrooms = ROOMS.filter((r) => r.id.startsWith("quarto") && r.id !== "quarto1" && Number(r.id.slice(6)) <= bedroomCount)
    .filter((r) => !items.some((i) => inRoom(i, r.id))).length;
  const catalogCount = useQuery({
    queryKey: ["inventory-catalog-count"],
    queryFn: async () => {
      const { count, error } = await supabase.from("guide_catalog_items").select("id", { count: "exact", head: true }).eq("guide_type", "inventario").eq("active", true);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 5 * 60_000,
  });
  const fromCatalog = new Set((q.data ?? []).map((i) => i.catalog_item_id).filter(Boolean)).size;
  const newFromGuide = Math.max(0, (catalogCount.data ?? 0) - fromCatalog);
  const needsSync = (q.data?.length ?? 0) > 0 && (newFromGuide > 0 || emptyBedrooms > 0);

  const renderItem = (i: InventorySnapshotItem, extra?: ReactNode, installation = false, subFields?: Record<string, ReactNode>) => {
          detailExtras.current.set(i.id, extra ?? null);
          for (const [key, fields] of Object.entries(subFields ?? {})) detailExtras.current.set(`${i.id}:${key}`, fields);
          const openDetail = () => { setDetail(i.id); };
          const ex = itemMedia(i);
          const who = i.inventory_source === "proprietario" ? "Proprietário" : "STAYO";
          const meta = i.inventory_answer ? [who, when(i.inventory_updated_at)].filter(Boolean).join(" · ") : "Ainda não respondido";
          const review = pendingReviewIds.has(i.id);
          const a = i.inventory_answer;
          return (
            <InventoryRow key={i.id} name={i.name} image={ex?.url} onOpen={openDetail}
              onTap={installation ? undefined : () => bump(i, 1)}
              group={inventorySubItemsFor(i.name).length > 0}
              meta={inventorySubItemsFor(i.name).length ? `Grupo · ${inventorySubItemsFor(i.name).length} itens` : <>{installation ? meta : a === "tenho" ? `Tem ${Math.max(1, i.inventory_quantity ?? 1)}` : a === "nao_tenho" ? "Não tem" : "Toque para contar"}{a === "nao_aplica" ? " · N/A" : ""}{review ? " · Revisar" : ""}</>}
              actions={<>
                {installation ? <>
                  <AnswerBtn kind="no" on={a === "nao_tenho"} onClick={() => answer.mutate({ item: i, answer: a === "nao_tenho" ? null : "nao_tenho" })} />
                  <AnswerBtn kind="yes" on={a === "tenho"} onClick={() => { answer.mutate({ item: i, answer: "tenho" }); openDetail(); }} />
                </> : a === "tenho" ? (
                  <div className="flex items-center gap-1 rounded-full border-2 p-0.5" style={{ borderColor: "var(--stayo-navy)" }}>
                    <button type="button" aria-label={`Diminuir ${i.name}`} onClick={() => bump(i, -1)} className="grid size-10 place-items-center rounded-full active:scale-90 transition-transform" style={navy}><Minus className="size-4" /></button>
                    <span className="min-w-6 text-center text-base font-semibold tabular-nums" style={navy} aria-live="polite">{Math.max(1, i.inventory_quantity ?? 1)}</span>
                    <button type="button" aria-label={`Aumentar ${i.name}`} onClick={() => bump(i, 1)} className="grid size-10 place-items-center rounded-full active:scale-90 transition-transform" style={{ backgroundColor: "var(--stayo-navy)", color: "var(--admin-surface, #fff)" }}><Plus className="size-4" /></button>
                  </div>
                ) : <>
                  <AnswerBtn kind="no" on={a === "nao_tenho"} onClick={() => answer.mutate({ item: i, answer: a === "nao_tenho" ? null : "nao_tenho" })} />
                  <button type="button" aria-label={`Tem ${i.name}`} onClick={() => bump(i, 1)} className="grid size-11 shrink-0 place-items-center rounded-full border-2 active:scale-90 transition-transform" style={{ borderColor: "var(--stayo-navy)", ...navy }}><Plus className="size-5" /></button>
                </>}
                <DropdownMenu>
                  <DropdownMenuTrigger className="hidden h-11 w-9 shrink-0 place-items-center rounded-lg sm:grid" style={{ ...border, ...navy }} aria-label={`Mais ações para ${i.name}`}>
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => answer.mutate({ item: i, answer: a === "nao_aplica" ? null : "nao_aplica" })}>
                      {a === "nao_aplica" ? "Remover N/A" : "Não se aplica (N/A)"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => openDetail()}>Observação</DropdownMenuItem>
                    {installation && <DropdownMenuItem onSelect={() => openDetail()}>Marca e instalador</DropdownMenuItem>}
                    {safeUrl(ex?.purchase_url) && (
                      <DropdownMenuItem asChild>
                        <a href={safeUrl(ex?.purchase_url)!} target="_blank" rel="noopener noreferrer">Onde comprar</a>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onSelect={() => openDetail()}>Detalhes</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>}
              >
              {inventorySubItemsFor(i.name).length > 0 && (
                <ul className="col-span-full ml-2 list-none border-l border-border pl-2 sm:ml-7 sm:pl-3">
                  {inventorySubItemsFor(i.name).map((s) => {
                    const sa = subAnswerFor(i.inventory_subanswers, s.key);
                    const media = inventoryReferenceFor(s.label, referenceMedia.data);
                    return (
                      <InventoryRow key={s.key} name={s.label} image={media.url} meta={sa ? "STAYO" : "Ainda não respondido"} onOpen={() => setSubDetail({ label: s.label, parentId: i.id, key: s.key })} actions={<>
                          <AnswerBtn kind="no" on={sa === "nao_tenho"} onClick={() => subanswer.mutate({ item: i, subKey: s.key, answer: sa === "nao_tenho" ? null : "nao_tenho" })} />
                          <AnswerBtn kind="yes" on={sa === "tenho"} onClick={() => subanswer.mutate({ item: i, subKey: s.key, answer: sa === "tenho" ? null : "tenho" })} />
                      </>} />
                    );
                  })}
                </ul>
              )}
            </InventoryRow>
          );
  };

  if (q.isPending)
    return (
      <Surface>
        <p className="flex items-center gap-2 text-sm" style={muted} role="status">
          <Loader2 className="size-4 animate-spin" /> Carregando inventário…
        </p>
      </Surface>
    );
  if (q.isError)
    return (
      <Surface>
        <p className="text-sm font-medium" style={navy}>Não foi possível abrir o inventário.</p>
        <button className="mt-2 flex items-center gap-1 text-sm underline" style={navy} onClick={() => void q.refetch()}>
          <RotateCcw className="size-4" /> Tentar de novo
        </button>
      </Surface>
    );

  return (
    <section className="rounded-xl border bg-white" style={border}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-4 pt-4 sm:px-5">
        <div className="min-w-0">
          <h3 className="text-xl font-semibold" style={display}>Inventário do imóvel</h3>
          <p className="text-sm" style={muted}>
            <b style={navy}>{answered}</b> respondidos · {missing} faltando · {total - answered} pendentes
          </p>
        </div>
        <div className="flex items-center gap-2">
        <FieldTabletButton implementationId={implementationId} />
        <FieldLinkDialog implementationId={implementationId} />
        <button
          type="button"
          onClick={() => setOnlyOpen((v) => !v)}
          aria-pressed={onlyOpen}
          aria-label="Mostrar só itens pendentes"
          className="grid size-10 place-items-center rounded-lg border"
          style={{ ...border, ...navy, backgroundColor: onlyOpen ? "var(--ficha-icon-bg)" : undefined }}
        >
          <Filter className="size-4" />
        </button>
        </div>
      </div>

      {reviewing && (
        <div className="px-4 pt-3 sm:px-5">
          <InventorySubmissionsReview implementationId={implementationId} items={items} />
        </div>
      )}

      {needsSync && (
        <div className="mx-4 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm sm:mx-5" style={{ backgroundColor: "var(--ficha-subtle)", ...navy }}>
          <span>
            {[newFromGuide > 0 && `${newFromGuide} ${newFromGuide === 1 ? "item novo" : "itens novos"} do guia de utensílios`, emptyBedrooms > 0 && `${emptyBedrooms} ${emptyBedrooms === 1 ? "quarto sem itens" : "quartos sem itens"}`].filter(Boolean).join(" · ")}
          </span>
          <button type="button" disabled={applySnapshot.isPending} onClick={() => applySnapshot.mutate()} className="h-9 rounded-lg px-3 font-medium disabled:opacity-50" style={{ backgroundColor: "var(--stayo-navy)", color: "var(--admin-surface, #fff)" }}>
            {applySnapshot.isPending ? "Atualizando…" : "Completar inventário"}
          </button>
        </div>
      )}

      {failed && (
        <p className="flex items-center gap-2 px-5 pt-3 text-xs" role="alert" style={{ color: "var(--stayo-danger, #b42318)" }}>
          Não salvou “{failed.item.name}”.
          <button className="underline" onClick={() => answer.mutate(failed)}>Tentar de novo</button>
        </p>
      )}

      <div className="mt-3 space-y-2 px-3 pb-3 sm:px-4" aria-label="Ambientes">
        {rooms.map((r) => {
          const on = r.id === room;
          const done = r.items.filter((i) => i.inventory_answer).length;
          const pct = r.items.length ? Math.round((done / r.items.length) * 100) : 0;
          return (
            <div key={r.id} className="overflow-hidden rounded-xl border" style={{ ...border, backgroundColor: on ? "var(--ficha-subtle)" : undefined }}>
              <button
                type="button"
                aria-expanded={on}
                onClick={() => { setRoom(on ? "" : r.id); setDetail(null); }}
                className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors active:scale-[0.995]"
                style={navy}
              >
                <ChevronDown className={cn("size-5 shrink-0 transition-transform duration-200", on ? "rotate-0" : "-rotate-90")} />
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold">{r.label}</span>
                  <span className="mt-1 block h-1.5 w-full max-w-48 overflow-hidden rounded-full" style={{ backgroundColor: "var(--stayo-border)" }}>
                    <span className="block h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: "var(--stayo-navy)" }} />
                  </span>
                </span>
                <span className="shrink-0 rounded-full px-2.5 py-0.5 text-sm tabular-nums" style={on ? iconCircle : { backgroundColor: "var(--ficha-subtle)", ...navy }}>
                  {done}/{r.items.length}
                </span>
              </button>
              {on && (
                <div className="border-t bg-white animate-in fade-in slide-in-from-top-1 duration-200" style={border}>
                  <ul className="px-2 sm:px-3">
                    {roomItems.length === 0 && !roomSlot && (
                      <li className="px-2 py-6 text-center text-sm" style={muted}>
                        {onlyOpen ? "Nada pendente neste ambiente." : "Nenhum item neste ambiente ainda."}
                        {(q.data?.length ?? 0) === 0 && (
                          <button type="button" className="mt-2 block w-full font-medium underline" disabled={applySnapshot.isPending} onClick={() => applySnapshot.mutate()}>
                            {applySnapshot.isPending ? "Carregando…" : "Carregar itens do guia"}
                          </button>
                        )}
                      </li>
                    )}
                    {roomSlot ? roomSlot(room, roomItems, renderItem) : roomItems.map((i) => renderItem(i))}
                  </ul>
                  <div className="flex items-center justify-end gap-3 border-t border-border px-4 py-3">
                    <Button variant="outline" onClick={() => { setNewName(""); add.reset(); setAdding(true); }}><Plus className="size-4" /> Adicionar item</Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader><DialogTitle>Adicionar item</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (newName.trim()) add.mutate(newName.trim()); }}>
            <label className="block space-y-2 text-sm font-medium">Ambiente<Input value={ROOMS.find((r) => r.id === room)?.label ?? room} readOnly className="h-11 bg-muted text-muted-foreground" /></label>
            <label className="block space-y-2 text-sm font-medium">Nome do item<Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={room === "outros" ? "Ex.: coleção de livros" : "Ex.: máquina de café"} maxLength={120} aria-label="Nome do novo item" /></label>
            <details className="rounded-lg border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">Detalhes opcionais</summary>
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-2 text-sm">Quantidade<Input type="number" min="0" step="1" className="h-11" value={newQuantity} onChange={(e) => setNewQuantity(e.target.value)} /></label>
                  <label className="block space-y-2 text-sm">Marca<Input className="h-11" maxLength={120} value={newBrand} onChange={(e) => setNewBrand(e.target.value)} /></label>
                </div>
                <label className="block space-y-2 text-sm">Estado<select className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm" value={newCondition} onChange={(e) => setNewCondition(e.target.value as InventoryCondition | "")}><option value="">Não informado</option>{(["bom", "atencao", "danificado"] as const).map((value) => <option key={value} value={value}>{inventoryConditionLabel[value]}</option>)}</select></label>
                <label className="block space-y-2 text-sm">Observação interna<Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} className="min-h-20" maxLength={2000} /></label>
              </div>
            </details>
            {add.isError && <p role="alert" className="text-sm text-destructive">Não foi possível adicionar. Tente novamente.</p>}
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button><Button type="submit" disabled={!newName.trim() || add.isPending}>{add.isPending ? "Adicionando…" : "Adicionar"}</Button></div>
          </form>
        </DialogContent>
      </Dialog>
      <InventoryDetailLayout open={!!subDetail} onOpenChange={(open) => { if (!open) setSubDetail(null); }} name={subDetail?.label ?? "Item"} media={subDetail ? inventoryReferenceFor(subDetail.label, referenceMedia.data) : undefined}>
          {subDetail && (() => {
            const media = inventoryReferenceFor(subDetail.label, referenceMedia.data);
            const parent = items.find((item) => item.id === subDetail.parentId);
            const selected = subAnswerFor(parent?.inventory_subanswers, subDetail.key);
            return <div className="mt-4 space-y-4">
              {parent && <div className="flex gap-2" role="radiogroup" aria-label={`Resposta para ${subDetail.label}`}><AnswerBtn kind="no" on={selected === "nao_tenho"} onClick={() => subanswer.mutate({ item: parent, subKey: subDetail.key, answer: selected === "nao_tenho" ? null : "nao_tenho" })} /><AnswerBtn kind="yes" on={selected === "tenho"} onClick={() => subanswer.mutate({ item: parent, subKey: subDetail.key, answer: selected === "tenho" ? null : "tenho" })} /></div>}
              {detailExtras.current.get(`${subDetail.parentId}:${subDetail.key}`)}
            </div>;
          })()}
      </InventoryDetailLayout>

      <div className="flex items-center gap-4 border-t px-4 py-3 text-sm sm:px-5" style={border}>
        <span className="shrink-0" style={muted}>
          {ROOMS.find((r) => r.id === room)?.label} · <b style={navy}>{roomDone}</b> de {roomAll.length} respondidos
        </span>
        <div className="h-2 max-w-80 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: "var(--ficha-subtle)" }}>
          <div className="h-full rounded-full" style={{ width: `${roomAll.length ? (roomDone / roomAll.length) * 100 : 0}%`, backgroundColor: "var(--ficha-icon-fg)" }} />
        </div>
      </div>

      <InventoryDetailLayout open={!!detailItem} onOpenChange={(o) => { if (!o) setDetail(null); }} name={detailItem?.name ?? "Item"} media={detailMedia ?? undefined}>
        {detailItem && <div className="space-y-4">
                {safeUrl(extras.data?.[detailItem.id]?.purchase_url) && (
                  <a href={safeUrl(extras.data?.[detailItem.id]?.purchase_url) ?? undefined} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm underline underline-offset-2" style={navy}>
                    <ExternalLink className="size-4" /> Onde comprar
                  </a>
                )}
                {pendingReviewIds.has(detailItem.id) && (
                  <p className="text-xs" style={{ color: "var(--ficha-pending-fg)" }}>Alterado pelo proprietário · aguardando revisão</p>
                )}
                {detailExtras.current.get(detailItem.id)}
                <InventoryItemDetails
                  item={detailItem}
                  onClose={() => setDetail(null)}
                  onSave={async (d) => {
                    await updateInventoryDetails(detailItem.id, implementationId, d);
                    await refresh();
                  }}
                  onDuplicate={async () => {
                    const copy = await duplicateInventoryItem(detailItem, detailItem.display_order + 1);
                    await refresh();
                    setDetail(copy.id);
                  }}
                  onRemove={async () => {
                    await removeInventoryItem(detailItem.id, implementationId);
                    await refresh();
                  }}
                />
                <div className="flex items-center justify-between gap-3 pt-1 text-[11px]" style={muted}>
                  <span className="min-w-0 truncate">
                    {detailItem.inventory_answer
                      ? `${detailItem.inventory_source === "proprietario" ? "Proprietário" : "STAYO"}${detailItem.inventory_updated_at ? ` · ${new Date(detailItem.inventory_updated_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}` : ""}${detailItem.inventory_review_status === "revisado_stayo" ? " · revisado" : ""}`
                      : "Ainda não respondido"}
                  </span>
                  <button type="button" className="shrink-0 rounded-full border px-3 py-1 text-xs" style={{ borderColor: "var(--stayo-border)", ...navy }} onClick={() => answer.mutate({ item: detailItem, answer: detailItem.inventory_answer === "nao_aplica" ? null : "nao_aplica" })}>
                    {detailItem.inventory_answer === "nao_aplica" ? "Remover N/A" : "Não se aplica"}
                  </button>
                </div>
        </div>}
      </InventoryDetailLayout>
    </section>
  );
}

export function AnswerBtn({ kind, on, onClick }: { kind: "no" | "yes"; on: boolean; onClick: () => void }) {
  const yes = kind === "yes";
  const style = on
    ? yes
      ? { backgroundColor: "var(--ficha-icon-fg)", color: "var(--admin-surface, #fff)", borderColor: "var(--ficha-icon-fg)" }
      : { backgroundColor: "var(--stayo-danger)", color: "var(--admin-surface, #fff)", borderColor: "var(--stayo-danger)" }
    : { borderColor: "var(--stayo-border)", color: yes ? "var(--ficha-icon-fg)" : "var(--stayo-danger)", backgroundColor: "var(--admin-surface, #fff)" };
  return (
    <Button variant="outline" key={String(on)} type="button" role="radio" aria-checked={on} aria-label={yes ? "Sim, tem" : "Não tem"} title={yes ? "Sim" : "Não"} onClick={onClick} className={cn("grid size-11 shrink-0 place-items-center rounded-full border-2 p-0 transition-colors", on ? "admin-answer-pop" : "opacity-70 hover:opacity-100")} style={style}>
      {yes ? <Check className="size-5" strokeWidth={3} /> : <X className="size-5" strokeWidth={3} />}
    </Button>
  );
}

function SubAnswerBtn({ kind, on, onClick }: { kind: "no" | "yes"; on: boolean; onClick: () => void }) {
  return <AnswerBtn kind={kind} on={on} onClick={onClick} />;
}
