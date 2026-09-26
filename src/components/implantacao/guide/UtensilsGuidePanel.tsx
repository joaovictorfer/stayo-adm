import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Circle, Loader2, Package, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "../../ui/button";
import { GuideItemEditor, emptyItem, type EditorValue } from "./GuideItemEditor";
import {
  applyGuide,
  deleteGuideItem,
  isGuideReleased,
  listGuide,
  reviewResponse,
  saveGuideItem,
  setGuideReleased,
  signGuideImages,
  uploadGuideImage,
  type ImplementationGuideItem,
} from "../../../lib/api/guides";
import {
  answerLabel,
  classificationLabel,
  matchesFilter,
  rowStatus,
  summarizeGuide,
  type GuideFilter,
} from "../../../lib/guides";

const surface = { backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" };
const muted = { color: "var(--stayo-ink-muted)" };

const toRow = (i: ImplementationGuideItem) => ({
  recommended: i.recommended_quantity,
  answer: i.response?.answer ?? null,
  quantity: i.response?.quantity ?? null,
  review: i.response?.review_status ?? null,
  confirmedQuantity: i.response?.confirmed_quantity ?? null,
});

const FILTERS: Array<{ id: GuideFilter; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "confirmar", label: "A confirmar" },
  { id: "faltando", label: "Faltando" },
  { id: "concluidos", label: "Concluídos" },
  { id: "nao_informados", label: "Não informados" },
];

export function UtensilsGuidePanel({ implementationId }: { implementationId: string }) {
  const qc = useQueryClient();
  const key = ["guide", implementationId];
  const q = useQuery({ queryKey: key, queryFn: () => listGuide(implementationId) });
  const released = useQuery({ queryKey: [...key, "released"], queryFn: () => isGuideReleased(implementationId) });
  const images = useQuery({
    queryKey: [...key, "images", (q.data ?? []).map((i) => i.image_path).join("|")],
    queryFn: () => signGuideImages((q.data ?? []).map((i) => i.image_path ?? "")),
    enabled: Boolean(q.data?.some((i) => i.image_path)),
    staleTime: 30 * 60_000,
  });
  const [category, setCategory] = useState<string | null>(null);
  const [filter, setFilter] = useState<GuideFilter>("todos");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ImplementationGuideItem | "new" | null>(null);
  const [detail, setDetail] = useState<ImplementationGuideItem | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const apply = useMutation({
    mutationFn: () => applyGuide(implementationId),
    onSuccess: (n) => {
      toast.success(n ? `${n} itens aplicados` : "Guia já estava aplicado");
      void invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível aplicar."),
  });
  const release = useMutation({
    mutationFn: (v: boolean) => setGuideReleased(implementationId, v),
    onSuccess: () => void invalidate(),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível alterar."),
  });
  const review = useMutation({
    mutationFn: reviewResponse,
    onSuccess: () => {
      toast.success("Revisão registrada");
      setDetail(null);
      void invalidate();
      void qc.invalidateQueries({ queryKey: ["supply"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível revisar."),
  });

  const items = q.data ?? [];
  const categories = useMemo(() => [...new Set(items.map((i) => i.category))], [items]);
  const activeCategory = category ?? categories[0] ?? null;
  const summary = summarizeGuide(items.filter((i) => i.enabled).map(toRow));
  const visible = items.filter(
    (i) =>
      (search ? i.name.toLowerCase().includes(search.toLowerCase()) : i.category === activeCategory) &&
      matchesFilter(toRow(i), filter),
  );

  if (q.isPending) return <p className="flex items-center gap-2 text-sm" style={muted}><Loader2 className="size-4 animate-spin" /> Carregando guia…</p>;
  if (q.isError)
    return (
      <p role="alert" className="text-sm">
        Não foi possível carregar o guia. <button type="button" className="underline" onClick={() => void q.refetch()}>Tentar novamente</button>
      </p>
    );

  if (!items.length)
    return (
      <div className="flex flex-col items-start gap-3 rounded-[var(--radius-card)] border p-5" style={surface}>
        <Package className="size-6" style={{ color: "var(--stayo-forest)" }} />
        <p className="font-medium">Nenhum item no guia desta implantação.</p>
        <p className="text-sm" style={muted}>Aplique as recomendações da STAYO e personalize depois.</p>
        <div className="flex gap-2">
          <Button className="min-h-11" disabled={apply.isPending} onClick={() => apply.mutate()}>
            {apply.isPending && <Loader2 className="animate-spin" />} Aplicar guia STAYO
          </Button>
          <Button variant="outline" className="min-h-11" onClick={() => setEditing("new")}><Plus /> Item</Button>
        </div>
        {editing && <EditorFor implementationId={implementationId} item={null} categories={categories} imageUrl={null} onClose={() => setEditing(null)} onSaved={invalidate} />}
      </div>
    );

  const imageOf = (i: ImplementationGuideItem) => (i.image_path ? images.data?.[i.image_path] ?? null : null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm" style={muted}>
          <strong style={{ color: "var(--stayo-ink)" }}>{summary.total} recomendações</strong> · {summary.confirmadas} confirmadas · {summary.aConfirmar} a confirmar · {summary.pendentes} pendentes
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="min-h-10" disabled={apply.isPending} onClick={() => apply.mutate()} title="Adiciona itens novos do catálogo sem alterar os já aplicados">
            Atualizar do catálogo
          </Button>
          <Button size="sm" className="min-h-10" onClick={() => setEditing("new")}><Plus /> Item</Button>
        </div>
      </div>
      <label className="flex min-h-12 items-center justify-between gap-3 rounded-[var(--radius-card)] border px-4" style={surface}>
        <span className="text-sm">
          <span className="font-medium">Visível ao proprietário</span>
          <span className="block text-xs" style={muted}>{released.data ? "Aparece no portal com as respostas dele" : "Privado — não aparece no portal"}</span>
        </span>
        <input type="checkbox" role="switch" className="size-5" checked={Boolean(released.data)} disabled={release.isPending || released.isPending} onChange={(e) => release.mutate(e.target.checked)} />
      </label>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Categorias">
        {categories.map((c) => (
          <button key={c} role="tab" aria-selected={!search && c === activeCategory} type="button" onClick={() => { setCategory(c); setSearch(""); }} className="min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium" style={{ ...surface, ...(!search && c === activeCategory ? { backgroundColor: "var(--stayo-forest)", color: "var(--primary-foreground)", borderColor: "var(--stayo-forest)" } : {}) }}>
            {c} <span className="opacity-70">{items.filter((i) => i.category === c).length}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border px-3" style={surface}>
          <Search className="size-4" style={muted} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar item…" className="w-full bg-transparent text-base outline-none" />
        </label>
        <select value={filter} onChange={(e) => setFilter(e.target.value as GuideFilter)} className="min-h-11 rounded-[var(--radius-control)] border px-3 text-sm" style={surface} aria-label="Filtro">
          {FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm" style={muted}>Nenhum item para este filtro.</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-[var(--radius-card)] border" style={surface}>
          {visible.map((i) => {
            const st = rowStatus(toRow(i));
            const img = imageOf(i);
            return (
              <li key={i.id}>
                <button type="button" onClick={() => setDetail(i)} className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-[var(--stayo-bg)]" style={{ opacity: i.enabled ? 1 : 0.5 }}>
                  <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-control)]" style={{ backgroundColor: "var(--stayo-bg)" }}>
                    {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : <Package className="size-5" style={muted} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{i.name}</span>
                    <span className="block truncate text-xs" style={muted}>
                      {i.quantity_text || `${i.recommended_quantity} un.`} · {classificationLabel[i.classification]}
                    </span>
                    <StatusLine item={i} status={st} />
                  </span>
                  <ChevronRight className="size-4 shrink-0" style={muted} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {detail && (
        <DetailSheet
          item={detail}
          imageUrl={imageOf(detail)}
          busy={review.isPending}
          onClose={() => setDetail(null)}
          onEdit={() => { setEditing(detail); setDetail(null); }}
          onReview={(action, quantity) => detail.response && review.mutate({ responseId: detail.response.id, action, ...(quantity != null ? { quantity } : {}) })}
        />
      )}
      {editing && (
        <EditorFor
          implementationId={implementationId}
          item={editing === "new" ? null : editing}
          categories={categories}
          imageUrl={editing !== "new" ? imageOf(editing) : null}
          defaultCategory={activeCategory ?? "Cozinha"}
          onClose={() => setEditing(null)}
          onSaved={invalidate}
        />
      )}
    </div>
  );
}

function StatusLine({ item, status }: { item: ImplementationGuideItem; status: ReturnType<typeof rowStatus> }) {
  const r = item.response;
  if (status === "nao_informado")
    return <span className="mt-0.5 flex items-center gap-1 text-xs" style={muted}><Circle className="size-3" /> Não informado</span>;
  if (status === "confirmar")
    return (
      <span className="mt-0.5 flex items-center gap-1 text-xs font-medium" style={{ color: "var(--stayo-gold)" }}>
        <Circle className="size-3 fill-current" /> Proprietário informou {r?.quantity ?? 0} · confirmar
      </span>
    );
  return (
    <span className="mt-0.5 flex items-center gap-1 text-xs" style={{ color: status === "concluido" ? "var(--stayo-forest)" : "var(--stayo-danger)" }}>
      <Check className="size-3" /> Confirmado {r?.confirmed_quantity ?? 0} de {item.recommended_quantity}
      {status === "faltando" ? " · falta" : ""}
    </span>
  );
}

function DetailSheet({
  item,
  imageUrl,
  busy,
  onClose,
  onEdit,
  onReview,
}: {
  item: ImplementationGuideItem;
  imageUrl: string | null;
  busy: boolean;
  onClose: () => void;
  onEdit: () => void;
  onReview: (action: "confirm" | "correct" | "reject", quantity?: number) => void;
}) {
  const r = item.response;
  const [qty, setQty] = useState(r?.quantity ?? 0);
  const [correcting, setCorrecting] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[color-mix(in_oklab,var(--stayo-ink)_40%,transparent)] sm:items-center" onClick={onClose}>
      <div role="dialog" aria-label={item.name} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl p-5 sm:rounded-2xl" style={{ backgroundColor: "var(--stayo-surface)" }} onClick={(e) => e.stopPropagation()}>
        {imageUrl && <img src={imageUrl} alt="" className="mb-4 h-44 w-full rounded-xl object-cover" />}
        <p className="text-xs" style={muted}>{item.category} · {classificationLabel[item.classification]}</p>
        <h3 className="text-lg font-semibold">{item.name}</h3>
        <p className="text-sm">Recomendado: {item.quantity_text || item.recommended_quantity}</p>
        {item.description && <p className="mt-2 text-sm" style={muted}>{item.description}</p>}
        {item.tip && <p className="mt-2 rounded-lg p-3 text-sm" style={{ backgroundColor: "var(--stayo-forest-soft)" }}><strong>Dica STAYO:</strong> {item.tip}</p>}
        {item.purchase_url && <a href={item.purchase_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm underline">Indicação de compra ↗</a>}

        <div className="mt-4 rounded-xl border p-4" style={surface}>
          <p className="text-sm font-medium">Resposta do proprietário</p>
          {!r || r.answer === "nao_informado" ? (
            <p className="text-sm" style={muted}>Ainda não informado.</p>
          ) : (
            <>
              <p className="text-sm">{answerLabel[r.answer]} · {r.quantity ?? 0} unidade(s)</p>
              <p className="text-xs" style={muted}>
                {r.review_status === "pendente" ? "Aguardando confirmação" : r.review_status === "rejeitado" ? "Rejeitada" : `Confirmado: ${r.confirmed_quantity ?? 0}`}
              </p>
              {correcting && (
                <label className="mt-3 flex items-center gap-2 text-sm">
                  Quantidade correta
                  <input type="number" min={0} value={qty} onChange={(e) => setQty(Math.max(0, Number(e.target.value) || 0))} className="w-24 rounded-md border px-2 py-2" style={surface} />
                </label>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {correcting ? (
                  <Button className="min-h-11" disabled={busy} onClick={() => onReview("correct", qty)}>Salvar correção</Button>
                ) : (
                  <>
                    <Button className="min-h-11" disabled={busy} onClick={() => onReview("confirm")}>{busy && <Loader2 className="animate-spin" />} Confirmar</Button>
                    <Button variant="outline" className="min-h-11" onClick={() => setCorrecting(true)}>Corrigir</Button>
                    <Button variant="ghost" className="min-h-11" disabled={busy} onClick={() => onReview("reject")}>Rejeitar</Button>
                  </>
                )}
              </div>
              <p className="mt-2 text-xs" style={muted}>Confirmar atualiza o inventário oficial (itens faltantes).</p>
            </>
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" className="min-h-11 flex-1" onClick={onEdit}>Editar item</Button>
          <Button variant="ghost" className="min-h-11" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </div>
  );
}

function EditorFor({
  implementationId,
  item,
  categories,
  imageUrl,
  defaultCategory,
  onClose,
  onSaved,
}: {
  implementationId: string;
  item: ImplementationGuideItem | null;
  categories: string[];
  imageUrl: string | null;
  defaultCategory?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initial: EditorValue = item
    ? {
        category: item.category,
        name: item.name,
        recommended_quantity: item.recommended_quantity,
        quantity_text: item.quantity_text,
        description: item.description,
        tip: item.tip,
        purchase_url: item.purchase_url,
        image_path: item.image_path,
        classification: item.classification,
        display_order: item.display_order,
        enabled: item.enabled,
      }
    : emptyItem(defaultCategory);
  return (
    <GuideItemEditor
      open
      onClose={onClose}
      initial={initial}
      categories={[...new Set(["Cozinha", "Quartos", "Banheiros", ...categories])]}
      imageUrl={imageUrl}
      isNew={!item}
      mode="implementation"
      onUpload={(file) => uploadGuideImage("implementations", implementationId, file)}
      onSave={async (v, also) => {
        await saveGuideItem(implementationId, item?.id ?? null, v, also);
        toast.success("Item salvo");
        onSaved();
      }}
      {...(item
        ? {
            onDelete: async () => {
              await deleteGuideItem(item.id);
              onSaved();
            },
          }
        : {})}
    />
  );
}
