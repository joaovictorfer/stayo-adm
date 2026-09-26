import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronLeft, ExternalLink, Loader2, Minus, Package, Plus } from "lucide-react";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { getOwnerGuideImages } from "@/lib/owner-guide.functions";
import { answerLabel, type GuideAnswer } from "@/lib/guides";

interface PortalGuideItem {
  id: string;
  category: string;
  name: string;
  recommendedQuantity: number;
  quantityText: string | null;
  description: string | null;
  tip: string | null;
  purchaseUrl: string | null;
  hasImage: boolean;
  answer: GuideAnswer;
  quantity: number | null;
}

/** Guia de utensílios no portal. Não renderiza nada se não estiver liberado. */
export function OwnerUtensilsGuide({ token }: { token: string }) {
  const qc = useQueryClient();
  const key = ["owner-guide", token];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("owner_guide_resolve", { p_token: token });
      if (error) throw error;
      return (data as { items: PortalGuideItem[] } | null)?.items ?? null;
    },
    retry: 1,
  });
  const fetchImages = useServerFn(getOwnerGuideImages);
  const images = useQuery({
    queryKey: [...key, "images"],
    queryFn: () => fetchImages({ data: { token } }),
    enabled: Boolean(q.data?.some((i) => i.hasImage)),
    staleTime: 30 * 60_000,
  });
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string | null>(null);

  if (!q.data || q.data.length === 0) return null;
  const items = q.data;
  const informed = items.filter((i) => i.answer !== "nao_informado").length;
  const categories = [...new Set(items.map((i) => i.category))];
  const active = category ?? categories[0]!;

  if (!open)
    return (
      <section className="rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface,white)] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--portal-muted,var(--stayo-ink-muted))]">Prepare seu imóvel</p>
        <h3 className="mt-1 text-lg font-semibold">Guia de utensílios</h3>
        <p className="text-sm text-[var(--portal-muted,var(--stayo-ink-muted))]">{informed} de {items.length} itens informados</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--portal-border)]">
          <div className="h-full rounded-full bg-[var(--portal-navy)]" style={{ width: `${(informed / items.length) * 100}%` }} />
        </div>
        <button type="button" onClick={() => setOpen(true)} className="mt-3 min-h-11 rounded-xl bg-[var(--portal-navy)] px-5 text-sm font-medium text-[var(--portal-hero-foreground)]">
          Ver guia
        </button>
      </section>
    );

  return (
    <section className="flex flex-col gap-3">
      <button type="button" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-1 self-start text-sm font-medium text-[var(--portal-navy)]">
        <ChevronLeft className="size-4" /> Voltar
      </button>
      <h3 className="text-lg font-semibold">Guia de utensílios</h3>
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        {categories.map((c) => (
          <button key={c} type="button" role="tab" aria-selected={c === active} onClick={() => setCategory(c)} className={`min-h-10 shrink-0 rounded-full border px-4 text-sm ${c === active ? "border-[var(--portal-navy)] bg-[var(--portal-navy)] text-[var(--portal-hero-foreground)]" : "border-[var(--portal-border)]"}`}>
            {c}
          </button>
        ))}
      </div>
      {items.filter((i) => i.category === active).map((i) => (
        <GuideCard key={i.id} item={i} token={token} imageUrl={images.data?.[i.id] ?? null} onSaved={() => void qc.invalidateQueries({ queryKey: key })} />
      ))}
    </section>
  );
}

function GuideCard({ item, token, imageUrl, onSaved }: { item: PortalGuideItem; token: string; imageUrl: string | null; onSaved: () => void }) {
  const [answer, setAnswer] = useState<GuideAnswer>(item.answer);
  const [qty, setQty] = useState(item.quantity ?? item.recommendedQuantity);
  const dirty = answer !== item.answer || (answer !== "nao_informado" && qty !== item.quantity);
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("owner_guide_save", { p_token: token, p_item_id: item.id, p_answer: answer, p_quantity: answer === "nao_informado" ? null : qty } as never);
      if (error) throw error;
    },
    onSuccess: onSaved,
  });
  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface,white)]">
      <div className="grid h-40 place-items-center bg-[var(--portal-border)]/40">
        {imageUrl ? <img src={imageUrl} alt={item.name} className="h-full w-full object-cover" /> : <Package className="size-8 opacity-40" />}
      </div>
      <div className="flex flex-col gap-2 p-4">
        <h4 className="font-semibold">{item.name}</h4>
        <p className="text-sm font-medium">{item.quantityText || `${item.recommendedQuantity} unidade(s)`}</p>
        {item.description && <p className="text-sm opacity-80">{item.description}</p>}
        {item.tip && (
          <p className="rounded-xl bg-[var(--portal-border)]/40 p-3 text-sm">
            <strong className="block text-xs uppercase tracking-wide">Dica STAYO</strong>
            {item.tip}
          </p>
        )}
        {item.purchaseUrl && (
          <>
            <a href={item.purchaseUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-medium text-[var(--portal-navy)] underline">
              Ver indicação de compra <ExternalLink className="size-4" />
            </a>
            <p className="text-xs opacity-70">Esta é uma referência indicada pela STAYO. Você pode optar por este produto ou por outro equivalente que atenda às especificações.</p>
          </>
        )}
        <p className="mt-1 text-sm font-medium">Sobre este item:</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(answerLabel) as GuideAnswer[]).map((a) => (
            <button key={a} type="button" aria-pressed={answer === a} onClick={() => setAnswer(a)} className={`min-h-11 rounded-full border px-4 text-sm ${answer === a ? "border-[var(--portal-navy)] bg-[var(--portal-navy)] text-[var(--portal-hero-foreground)]" : "border-[var(--portal-border)]"}`}>
              {answerLabel[a]}
            </button>
          ))}
        </div>
        {answer !== "nao_informado" && (
          <div className="flex items-center gap-3">
            <span className="text-sm">Quantos?</span>
            <button type="button" aria-label="Diminuir" onClick={() => setQty((n) => Math.max(0, n - 1))} className="grid size-11 place-items-center rounded-full border border-[var(--portal-border)]"><Minus className="size-4" /></button>
            <span className="w-8 text-center text-lg font-semibold" aria-live="polite">{qty}</span>
            <button type="button" aria-label="Aumentar" onClick={() => setQty((n) => Math.min(999, n + 1))} className="grid size-11 place-items-center rounded-full border border-[var(--portal-border)]"><Plus className="size-4" /></button>
          </div>
        )}
        {dirty && (
          <button type="button" disabled={save.isPending} onClick={() => save.mutate()} className="min-h-11 rounded-xl bg-[var(--portal-navy)] text-sm font-medium text-[var(--portal-hero-foreground)]">
            {save.isPending ? <Loader2 className="mx-auto size-4 animate-spin" /> : "Salvar"}
          </button>
        )}
        {save.isSuccess && !dirty && <p className="flex items-center gap-1 text-xs text-[var(--portal-success)]"><Check className="size-3" /> Salvo</p>}
        {save.isError && <p role="alert" className="text-xs text-[var(--portal-danger)]">Não foi possível salvar. Tente novamente.</p>}
      </div>
    </article>
  );
}
