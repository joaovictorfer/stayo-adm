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
import { useMemo, useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { InventoryItemDetails } from "../guide/InventoryItemDetails";
import { InventorySubmissionsReview } from "../guide/InventorySubmissionsReview";
import { GuidePanel, GuideSummary } from "../guide/GuidePanel";
import { MissingItemsTab } from "../MissingItemsTab";
import {
  addInventoryItem,
  duplicateInventoryItem,
  guidedInventoryQuery,
  ensureGuidedInventorySnapshot,
  removeInventoryItem,
  setInventoryAnswer,
  updateInventoryDetails,
} from "../../../lib/api/guided-inventory";
import { signGuideImages } from "../../../lib/api/guides";
import { inventorySubmissionsQuery } from "../../../lib/api/owner-inventory";
import {
  inventoryConditionLabel,
  type InventoryAnswer,
  type InventoryRoom,
  type InventorySnapshotItem,
} from "../../../lib/guided-inventory";

const muted = { color: "var(--stayo-ink-muted)" };
const navy = { color: "var(--stayo-navy)" };
const border = { borderColor: "var(--stayo-border)" };
const display = { fontFamily: "Outfit, var(--stayo-font-ui), sans-serif", letterSpacing: "-0.01em", color: "var(--stayo-navy)" };
const iconCircle = { backgroundColor: "var(--ficha-icon-bg)", color: "var(--ficha-icon-fg)" };

const ROOMS: Array<{ id: string; label: string }> = [
  { id: "cozinha", label: "Cozinha" },
  { id: "sala", label: "Sala" },
  { id: "quarto1", label: "Quarto 1" },
  { id: "quarto2", label: "Quarto 2" },
  { id: "banheiro", label: "Banheiro" },
  { id: "lavanderia", label: "Lavanderia" },
  { id: "outros", label: "Outros" },
];
const inRoom = (i: InventorySnapshotItem, r: string) => {
  if (r === "quarto1") return i.room === "quartos" && i.category !== "Quarto 2";
  if (r === "quarto2") return i.room === "quartos" && i.category === "Quarto 2";
  if (r === "banheiro") return i.room === "banheiros";
  if (r === "outros") return i.room === "outros" || i.room === "externa";
  return i.room === r;
};
const persisted = (r: string): InventoryRoom =>
  r === "quarto1" || r === "quarto2" ? "quartos" : r === "banheiro" ? "banheiros" : (r as InventoryRoom);

type Extra = { image_path: string | null; purchase_url: string | null; description: string | null; recommended_quantity: number | null };

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
  onOpenPortal,
}: {
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
          <h2 className="text-2xl font-semibold sm:text-[1.75rem]" style={display}>Implantação</h2>
          <p className="text-sm sm:text-base" style={muted}>Conferência e preparação do imóvel para operação.</p>
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

      <nav className="flex gap-1 overflow-x-auto border-b" style={border} role="tablist" aria-label="Áreas da implantação">
        {tabs.map((t) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.id)}
              className="-mb-px shrink-0 border-b-[3px] px-4 py-2.5 text-sm"
              style={{ ...navy, borderColor: on ? "var(--ficha-icon-fg)" : "transparent", fontWeight: on ? 600 : 400 }}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="order-2 min-w-0 lg:order-1">
          {tab === "inventario" ? (
            <InventoryWorkspace
              implementationId={implementationId}
              adding={adding}
              setAdding={setAdding}
              reviewing={reviewing}
              pendingReviewIds={new Set(pendingReview.map((s) => s.item_id).filter((x): x is string => !!x))}
            />
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
          <section className="rounded-xl border bg-white px-4 py-3 sm:px-5" style={border}>
            <div className="flex items-center gap-3 border-b pb-3 pt-1" style={border}>
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
                className={`grid min-h-12 w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 text-left text-sm ${idx < arr.length - 1 ? "border-b" : ""}`}
                style={border}
              >
                <span className="font-medium" style={navy}>{r.label}</span>
                <span className="text-sm" style={muted}>{r.value}</span>
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
}: {
  implementationId: string;
  adding: boolean;
  setAdding: (v: boolean) => void;
  reviewing: boolean;
  pendingReviewIds: Set<string>;
}) {
  const qc = useQueryClient();
  const query = guidedInventoryQuery(implementationId);
  const q = useQuery(query);
  const [room, setRoom] = useState("cozinha");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [failed, setFailed] = useState<{ item: InventorySnapshotItem; answer: InventoryAnswer | null } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: query.queryKey });
  // Copiar o catálogo para a implantação é uma escrita: só por ação explícita.
  const applySnapshot = useMutation({
    mutationFn: () => ensureGuidedInventorySnapshot(implementationId),
    onSuccess: async () => {
      await refresh();
      await qc.invalidateQueries({ queryKey: ["guided-inventory-extras", implementationId] });
    },
  });

  const extras = useQuery({
    queryKey: ["guided-inventory-extras", implementationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implementation_guide_items")
        .select("id, image_path, purchase_url, description, recommended_quantity")
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

  const add = useMutation({
    mutationFn: (name: string) => addInventoryItem(implementationId, persisted(room), name, 1000 + (q.data?.length ?? 0), room === "quarto2" ? "Quarto 2" : undefined),
    onSuccess: async () => {
      setNewName("");
      setAdding(false);
      await refresh();
      await qc.invalidateQueries({ queryKey: ["guided-inventory-extras", implementationId] });
    },
  });

  const items = useMemo(() => (q.data ?? []).filter((i) => i.enabled), [q.data]);
  const rooms = ROOMS.map((r) => ({ ...r, items: items.filter((i) => inRoom(i, r.id)) })).filter((r) => r.items.length > 0 || r.id === room);
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

      {reviewing && (
        <div className="px-4 pt-3 sm:px-5">
          <InventorySubmissionsReview implementationId={implementationId} items={items} />
        </div>
      )}

      <div className="mt-3 flex gap-1 overflow-x-auto border-b px-4 sm:px-5" style={border} role="tablist" aria-label="Ambientes">
        {rooms.map((r) => {
          const on = r.id === room;
          return (
            <button
              key={r.id}
              role="tab"
              aria-selected={on}
              onClick={() => {
                setRoom(r.id);
                setDetail(null);
              }}
              className="-mb-px flex shrink-0 items-center gap-2 border-b-[3px] px-3 py-2.5 text-sm"
              style={{ ...navy, borderColor: on ? "var(--ficha-icon-fg)" : "transparent", fontWeight: on ? 600 : 400 }}
            >
              {r.label}
              <span className="rounded-full px-2 text-xs" style={on ? iconCircle : { backgroundColor: "var(--ficha-subtle)", ...navy }}>
                {r.items.length}
              </span>
            </button>
          );
        })}
      </div>

      {failed && (
        <p className="flex items-center gap-2 px-5 pt-3 text-xs" role="alert" style={{ color: "var(--stayo-danger, #b42318)" }}>
          Não salvou “{failed.item.name}”.
          <button className="underline" onClick={() => answer.mutate(failed)}>Tentar de novo</button>
        </p>
      )}

      <ul className="px-2 sm:px-3">
        {roomItems.length === 0 && (
          <li className="px-2 py-6 text-center text-sm" style={muted}>
            {onlyOpen ? "Nada pendente neste ambiente." : "Nenhum item neste ambiente ainda."}
            {(q.data?.length ?? 0) === 0 && (
              <button
                type="button"
                className="mt-2 block w-full font-medium underline"
                disabled={applySnapshot.isPending}
                onClick={() => applySnapshot.mutate()}
              >
                {applySnapshot.isPending ? "Carregando…" : "Carregar itens do guia"}
              </button>
            )}
          </li>
        )}
        {roomItems.map((i) => {
          const ex = extras.data?.[i.id];
          const who = i.inventory_source === "proprietario" ? "Proprietário" : "STAYO";
          const meta = i.inventory_answer ? [who, when(i.inventory_updated_at)].filter(Boolean).join(" · ") : "Ainda não respondido";
          const review = pendingReviewIds.has(i.id);
          const a = i.inventory_answer;
          return (
            <li key={i.id} className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 border-b px-2 py-2.5 last:border-b-0 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto]" style={border} data-testid="inventory-row">
              <button type="button" onClick={() => setDetail(i.id)} className="size-12 overflow-hidden rounded-lg sm:size-14" style={{ backgroundColor: "var(--ficha-subtle)" }} aria-label={`Detalhes de ${i.name}`}>
                {ex?.url ? <img src={ex.url} alt="" loading="lazy" className="size-full object-cover" /> : <ImageIcon className="m-auto size-5" style={muted} />}
              </button>
              <button type="button" onClick={() => setDetail(i.id)} className="min-w-0 text-left">
                <span className="block truncate font-semibold" style={navy}>{i.name}</span>
                <span className="flex flex-wrap items-center gap-x-2 text-xs sm:text-sm" style={muted}>
                  <span className="truncate">{meta}</span>
                  {a === "nao_aplica" && <span>· N/A</span>}
                  {review && (
                    <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: "var(--ficha-pending-bg)", color: "var(--ficha-pending-fg)" }}>
                      <span className="size-1.5 rounded-full" style={{ backgroundColor: "var(--ficha-pending-fg)" }} /> Alterado pelo proprietário · Revisar
                    </span>
                  )}
                </span>
              </button>
              <div className="col-span-2 flex items-center gap-2 sm:col-span-1" role="radiogroup" aria-label={`Resposta para ${i.name}`}>
                <AnswerBtn kind="no" on={a === "nao_tenho"} onClick={() => answer.mutate({ item: i, answer: a === "nao_tenho" ? null : "nao_tenho" })} />
                <AnswerBtn kind="yes" on={a === "tenho"} onClick={() => answer.mutate({ item: i, answer: a === "tenho" ? null : "tenho" })} />
                <DropdownMenu>
                  <DropdownMenuTrigger className="grid h-10 w-11 shrink-0 place-items-center rounded-lg border bg-white" style={{ ...border, ...navy }} aria-label={`Mais ações para ${i.name}`}>
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => answer.mutate({ item: i, answer: a === "nao_aplica" ? null : "nao_aplica" })}>
                      {a === "nao_aplica" ? "Remover N/A" : "Não se aplica (N/A)"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setDetail(i.id)}>Observação</DropdownMenuItem>
                    {safeUrl(ex?.purchase_url) && (
                      <DropdownMenuItem asChild>
                        <a href={safeUrl(ex?.purchase_url)!} target="_blank" rel="noopener noreferrer">Onde comprar</a>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onSelect={() => setDetail(i.id)}>Detalhes</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          );
        })}
      </ul>

      {adding && (
        <form
          className="flex gap-2 border-t px-4 py-3 sm:px-5"
          style={border}
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) add.mutate(newName.trim());
          }}
        >
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={`Novo item em ${ROOMS.find((r) => r.id === room)?.label}`}
            maxLength={120}
            className="h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm"
            style={border}
            aria-label="Nome do novo item"
          />
          <button type="submit" disabled={!newName.trim() || add.isPending} className="h-10 rounded-lg px-4 text-sm font-medium disabled:opacity-50" style={{ backgroundColor: "var(--stayo-navy)", color: "var(--admin-surface, #fff)" }}>
            Adicionar
          </button>
          <button type="button" onClick={() => setAdding(false)} className="h-10 px-2 text-sm" style={muted}>Cancelar</button>
        </form>
      )}

      <div className="flex items-center gap-4 border-t px-4 py-3 text-sm sm:px-5" style={border}>
        <span className="shrink-0" style={muted}>
          {ROOMS.find((r) => r.id === room)?.label} · <b style={navy}>{roomDone}</b> de {roomAll.length} respondidos
        </span>
        <div className="h-2 max-w-80 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: "var(--ficha-subtle)" }}>
          <div className="h-full rounded-full" style={{ width: `${roomAll.length ? (roomDone / roomAll.length) * 100 : 0}%`, backgroundColor: "var(--ficha-icon-fg)" }} />
        </div>
      </div>

      <Sheet open={!!detailItem} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {detailItem && (
            <>
              <SheetHeader>
                <SheetTitle style={display}>{detailItem.name}</SheetTitle>
              </SheetHeader>
              <div className="mt-3 space-y-4 text-sm">
                <div className="aspect-[4/3] overflow-hidden rounded-xl" style={{ backgroundColor: "var(--ficha-subtle)" }}>
                  {extras.data?.[detailItem.id]?.url ? (
                    <img src={extras.data[detailItem.id]!.url!} alt={detailItem.name} className="size-full object-cover" />
                  ) : (
                    <ImageIcon className="m-auto mt-20 size-8" style={muted} />
                  )}
                </div>
                {(detailItem.tip || extras.data?.[detailItem.id]?.description) && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide" style={muted}>Recomendação STAYO</p>
                    <p style={navy}>{extras.data?.[detailItem.id]?.description || detailItem.tip}</p>
                  </div>
                )}
                {(detailItem.inventory_quantity != null || detailItem.inventory_brand || detailItem.inventory_condition) && (
                  <p style={navy}>
                    {[
                      detailItem.inventory_quantity != null ? `${detailItem.inventory_quantity} un.` : null,
                      detailItem.inventory_brand,
                      detailItem.inventory_condition ? inventoryConditionLabel[detailItem.inventory_condition] : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                {safeUrl(extras.data?.[detailItem.id]?.purchase_url) && (
                  <a href={safeUrl(extras.data?.[detailItem.id]?.purchase_url)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 underline underline-offset-2" style={navy}>
                    <ExternalLink className="size-4" /> Onde comprar
                  </a>
                )}
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide" style={muted}>Histórico</p>
                  <p style={navy}>
                    {detailItem.inventory_answer
                      ? `${detailItem.inventory_source === "proprietario" ? "Proprietário" : "STAYO"}${detailItem.inventory_updated_at ? ` · ${new Date(detailItem.inventory_updated_at).toLocaleString("pt-BR")}` : ""}${detailItem.inventory_review_status === "revisado_stayo" ? " · revisado pela STAYO" : ""}`
                      : "Ainda não respondido"}
                  </p>
                  {pendingReviewIds.has(detailItem.id) && (
                    <p className="mt-1 text-xs" style={{ color: "var(--ficha-pending-fg)" }}>Alterado pelo proprietário · aguardando revisão</p>
                  )}
                </div>
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
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function AnswerBtn({ kind, on, onClick }: { kind: "no" | "yes"; on: boolean; onClick: () => void }) {
  const yes = kind === "yes";
  const style = on
    ? yes
      ? { backgroundColor: "var(--ficha-icon-fg)", color: "var(--admin-surface, #fff)", borderColor: "var(--ficha-icon-fg)" }
      : { backgroundColor: "var(--ficha-no-bg)", color: "var(--ficha-no-fg)", borderColor: "var(--ficha-no-border)" }
    : { ...border, ...navy, backgroundColor: "var(--admin-surface, #fff)" };
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onClick} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium sm:w-24 sm:flex-none" style={style}>
      {yes ? <Check className="size-4" /> : <X className="size-4" />} {yes ? "Sim" : "Não"}
    </button>
  );
}
