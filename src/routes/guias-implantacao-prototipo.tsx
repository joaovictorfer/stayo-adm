import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  ExternalLink,
  ImagePlus,
  Minus,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  ShoppingBag,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { StayoLogo } from "@/components/brand/StayoLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/guias-implantacao-prototipo")({
  head: () => ({
    meta: [
      { title: "Guia de Enxoval — proposta visual STAYO" },
      { name: "description", content: "Proposta visual do Guia de Enxoval no sistema de Guias STAYO." },
      { property: "og:title", content: "Guia de Enxoval — proposta visual STAYO" },
      { property: "og:description", content: "Proposta visual do Guia de Enxoval no sistema de Guias STAYO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LinenGuidePrototype,
});

type Category = "Cama" | "Banho" | "Cozinha" | "Complementos";
type View = "admin" | "property" | "owner" | "visibility";
type Answer = "unanswered" | "owned" | "buy";

type LinenItem = {
  id: string;
  name: string;
  category: Category;
  recommended: number;
  quantityLabel: string;
  classification: "Essencial" | "Recomendado";
  standard: string;
  description: string;
  tip: string;
  hasReference: boolean;
  answer: Answer;
  ownedQuantity: number | null;
  exclusive?: boolean;
};

const PROPERTY = "Vêneto · A-Verona · 105";
const initialItems: LinenItem[] = [
  {
    id: "toalha-banho",
    name: "Toalha de banho",
    category: "Banho",
    recommended: 6,
    quantityLabel: "6 unidades",
    classification: "Essencial",
    standard: "Tamanho e gramatura a definir",
    description: "Especificação visual de exemplo. Conteúdo técnico ainda não definido pela STAYO.",
    tip: "Dica de exemplo para demonstrar a hierarquia do conteúdo.",
    hasReference: true,
    answer: "owned",
    ownedQuantity: 4,
  },
  {
    id: "jogo-cama",
    name: "Jogo de cama",
    category: "Cama",
    recommended: 3,
    quantityLabel: "3 jogos",
    classification: "Essencial",
    standard: "Medida a definir",
    description: "Exemplo de descrição para validar o detalhe visual do item.",
    tip: "Orientação ilustrativa, sem valor de recomendação oficial.",
    hasReference: false,
    answer: "unanswered",
    ownedQuantity: null,
  },
  {
    id: "pano-copa",
    name: "Pano de copa",
    category: "Cozinha",
    recommended: 4,
    quantityLabel: "4 unidades",
    classification: "Recomendado",
    standard: "Padrão a definir",
    description: "Exemplo de conteúdo para composição da proposta visual.",
    tip: "Dica ilustrativa a ser substituída pelo conteúdo oficial.",
    hasReference: false,
    answer: "buy",
    ownedQuantity: null,
  },
  {
    id: "manta",
    name: "Manta adicional",
    category: "Complementos",
    recommended: 1,
    quantityLabel: "1 unidade",
    classification: "Recomendado",
    standard: "Padrão a definir",
    description: "Item exclusivamente demonstrativo da arquitetura visual.",
    tip: "Conteúdo a definir pela STAYO.",
    hasReference: false,
    answer: "unanswered",
    ownedQuantity: null,
  },
];

const views: Array<{ id: View; label: string }> = [
  { id: "admin", label: "Admin" },
  { id: "property", label: "No imóvel" },
  { id: "owner", label: "Proprietário" },
  { id: "visibility", label: "Visibilidade" },
];

function LinenGuidePrototype() {
  const [view, setView] = useState<View>("admin");
  const [items, setItems] = useState(initialItems);
  const [category, setCategory] = useState<"Todos" | Category>("Todos");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<LinenItem | null>(null);
  const [editing, setEditing] = useState<LinenItem | "new" | null>(null);
  const [guideApplied, setGuideApplied] = useState(false);
  const [quantityItem, setQuantityItem] = useState<LinenItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [utensilsVisible, setUtensilsVisible] = useState(true);
  const [linenVisible, setLinenVisible] = useState(false);

  const shown = useMemo(
    () =>
      items.filter(
        (item) =>
          (category === "Todos" || item.category === category) &&
          item.name.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")),
      ),
    [category, items, query],
  );

  const saveAnswer = (id: string, answer: Answer, ownedQuantity: number | null = null) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, answer, ownedQuantity } : item)));
    setSavedId(id);
    window.setTimeout(() => setSavedId((current) => (current === id ? null : current)), 1600);
  };

  const chooseOwned = (item: LinenItem) => {
    if (item.recommended === 1) return saveAnswer(item.id, "owned", 1);
    setQuantity(item.ownedQuantity ?? Math.min(item.recommended, 2));
    setQuantityItem(item);
  };

  return (
    <main className="min-h-dvh bg-[var(--portal-background,#f5f7f5)] text-[var(--portal-foreground,var(--stayo-ink))]">
      <div className="border-b border-[var(--portal-border)] bg-[var(--portal-surface)]">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <StayoLogo variant="green" className="h-7 w-auto" />
          <p className="hidden text-xs font-semibold uppercase text-[var(--portal-muted)] sm:block">Protótipo visual · sem dados oficiais</p>
        </div>
      </div>

      <nav className="sticky top-0 z-20 border-b border-[var(--portal-border)] bg-[var(--portal-background,#f5f7f5)]/95 backdrop-blur" aria-label="Vistas do protótipo">
        <div className="hide-scrollbar mx-auto flex w-full max-w-6xl gap-2 overflow-x-auto px-4 py-3 md:px-8">
          {views.map((item) => (
            <Button key={item.id} size="sm" variant={view === item.id ? "default" : "outline"} className="min-h-10 shrink-0 rounded-full px-4" onClick={() => setView(item.id)}>
              {item.label}
            </Button>
          ))}
        </div>
      </nav>

      <div className="mx-auto w-full max-w-6xl px-4 py-6 pb-[max(2rem,env(safe-area-inset-bottom))] md:px-8 md:py-10">
        <DemoNotice />
        {view === "admin" && (
          <AdminCatalog items={shown} category={category} query={query} onCategory={setCategory} onQuery={setQuery} onDetail={setDetail} onEdit={setEditing} />
        )}
        {view === "property" && (
          <PropertyGuide applied={guideApplied} items={items} linenVisible={linenVisible} onApply={() => setGuideApplied(true)} onEmpty={() => setGuideApplied(true)} onVisibility={setLinenVisible} onEdit={setEditing} />
        )}
        {view === "owner" && (
          <OwnerGuide items={items} category={category} query={query} savedId={savedId} onCategory={setCategory} onQuery={setQuery} onOwned={chooseOwned} onBuy={(item) => saveAnswer(item.id, "buy")} onDetail={setDetail} />
        )}
        {view === "visibility" && (
          <VisibilityPanel utensils={utensilsVisible} linen={linenVisible} onUtensils={setUtensilsVisible} onLinen={setLinenVisible} />
        )}
      </div>

      {detail && <DetailSheet item={detail} onClose={() => setDetail(null)} onEdit={() => { setEditing(detail); setDetail(null); }} />}
      {editing && <EditorSheet item={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {quantityItem && (
        <QuantitySheet item={quantityItem} quantity={quantity} onQuantity={setQuantity} onClose={() => setQuantityItem(null)} onSave={() => { saveAnswer(quantityItem.id, "owned", quantity); setQuantityItem(null); }} />
      )}
    </main>
  );
}

function DemoNotice() {
  return (
    <div className="mb-6 flex items-center gap-2 rounded-lg border border-[var(--portal-border)] bg-[var(--portal-surface)] px-3 py-2 text-xs font-medium text-[var(--portal-muted)]">
      <Package className="size-4 shrink-0" /> Exemplo visual — conteúdo a definir
    </div>
  );
}

function AdminCatalog({ items, category, query, onCategory, onQuery, onDetail, onEdit }: { items: LinenItem[]; category: "Todos" | Category; query: string; onCategory: (value: "Todos" | Category) => void; onQuery: (value: string) => void; onDetail: (item: LinenItem) => void; onEdit: (item: LinenItem | "new") => void }) {
  return (
    <section>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="text-2xl font-semibold text-[var(--portal-navy)] md:text-3xl">Guia de enxoval</h1><p className="mt-1 text-sm text-[var(--portal-muted)]">Catálogo visual de recomendações STAYO.</p></div>
        <Button className="h-11 w-full rounded-lg sm:w-auto" onClick={() => onEdit("new")}><Plus /> Adicionar item</Button>
      </header>
      <GuideControls category={category} query={query} onCategory={onCategory} onQuery={onQuery} />
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => <AdminItemCard key={item.id} item={item} onOpen={() => onDetail(item)} />)}
      </ul>
    </section>
  );
}

function GuideControls({ category, query, onCategory, onQuery }: { category: "Todos" | Category; query: string; onCategory: (value: "Todos" | Category) => void; onQuery: (value: string) => void }) {
  const categories = ["Todos", "Cama", "Banho", "Cozinha", "Complementos"] as const;
  return (
    <div className="mt-6 space-y-3">
      <label className="flex min-h-12 items-center gap-3 rounded-lg border border-[var(--portal-border)] bg-[var(--portal-surface)] px-4 md:max-w-md"><Search className="size-4 text-[var(--portal-muted)]" /><input className="min-w-0 flex-1 bg-transparent text-base outline-none" value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Buscar item..." aria-label="Buscar item de enxoval" /></label>
      <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">{categories.map((value) => <Button key={value} size="sm" variant={category === value ? "default" : "outline"} className="min-h-10 shrink-0 rounded-full px-4" onClick={() => onCategory(value)}>{value}</Button>)}</div>
    </div>
  );
}

function AdminItemCard({ item, onOpen }: { item: LinenItem; onOpen: () => void }) {
  return (
    <li><button type="button" onClick={onOpen} className="grid w-full grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-lg border border-[var(--portal-border)] bg-[var(--portal-surface)] p-2 text-left transition hover:border-[var(--portal-success)]">
      <ItemVisual item={item} className="aspect-square rounded-md" />
      <span className="min-w-0"><span className="block font-semibold text-[var(--portal-navy)]">{item.name}</span><span className="mt-1 block text-sm text-[var(--portal-muted)]">Recomendado: {item.quantityLabel}</span><span className="mt-2 inline-flex rounded-full bg-[var(--portal-surface-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--portal-navy)]">{item.classification}</span></span>
      <ChevronRight className="size-4 text-[var(--portal-muted)]" />
    </button></li>
  );
}

function PropertyGuide({ applied, items, linenVisible, onApply, onEmpty, onVisibility, onEdit }: { applied: boolean; items: LinenItem[]; linenVisible: boolean; onApply: () => void; onEmpty: () => void; onVisibility: (value: boolean) => void; onEdit: (item: LinenItem | "new") => void }) {
  if (!applied) return (
    <section className="mx-auto max-w-2xl"><p className="text-xs font-semibold uppercase text-[var(--portal-muted)]">Implantação · {PROPERTY}</p><h1 className="mt-2 text-2xl font-semibold text-[var(--portal-navy)]">Guia de enxoval</h1>
      <div className="mt-6 rounded-lg border border-[var(--portal-border)] bg-[var(--portal-surface)] p-6 text-center"><Package className="mx-auto size-8 text-[var(--portal-success)]" /><h2 className="mt-3 font-semibold">Nenhum guia aplicado ainda.</h2><p className="mt-2 text-sm text-[var(--portal-muted)]">O catálogo oficial de enxoval ainda não foi definido.</p><Button className="mt-5 h-11 w-full sm:w-auto" disabled>Aplicar guia padrão STAYO</Button><p className="mt-2 text-xs text-[var(--portal-muted)]">Conteúdo a definir</p><Button variant="ghost" className="mt-2 h-11" onClick={onEmpty}>Começar vazio</Button></div>
      <Button variant="outline" className="mt-4 h-11 w-full" onClick={onApply}>Visualizar cópia demonstrativa</Button>
    </section>
  );
  return (
    <section><p className="text-xs font-semibold uppercase text-[var(--portal-muted)]">Implantação · {PROPERTY}</p><div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-semibold text-[var(--portal-navy)]">Guia de enxoval</h1><p className="mt-1 text-sm text-[var(--portal-muted)]">{items.length} itens nesta cópia demonstrativa</p></div><Button className="h-11" onClick={() => onEdit("new")}><Plus /> Adicionar item</Button></div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"><ul className="space-y-3">{items.map((item) => <li key={item.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[var(--portal-border)] bg-[var(--portal-surface)] p-2"><ItemVisual item={item} className="aspect-square rounded-md" /><div className="min-w-0"><p className="font-semibold text-[var(--portal-navy)]">{item.name}</p><p className="text-sm text-[var(--portal-muted)]">Recomendado: {item.quantityLabel}</p><p className="mt-1 text-xs font-medium text-[var(--portal-muted)]">{item.answer === "owned" ? `Proprietário: já possui ${item.ownedQuantity ?? ""}` : item.answer === "buy" ? "Proprietário: vai comprar" : "Ainda não informado"}</p></div><Button size="icon" variant="ghost" aria-label={`Editar ${item.name}`} onClick={() => onEdit(item)}><ChevronRight /></Button></li>)}</ul>
        <aside className="h-fit rounded-lg border border-[var(--portal-border)] bg-[var(--portal-surface)] p-5 lg:sticky lg:top-24"><h2 className="font-semibold text-[var(--portal-navy)]">Portal do proprietário</h2><p className="mt-1 text-sm text-[var(--portal-muted)]">Controle exclusivo do Guia de Enxoval.</p><VisibilityToggle label="Guia de enxoval" value={linenVisible} onChange={onVisibility} /></aside></div>
    </section>
  );
}

function OwnerGuide({ items, category, query, savedId, onCategory, onQuery, onOwned, onBuy, onDetail }: { items: LinenItem[]; category: "Todos" | Category; query: string; savedId: string | null; onCategory: (value: "Todos" | Category) => void; onQuery: (value: string) => void; onOwned: (item: LinenItem) => void; onBuy: (item: LinenItem) => void; onDetail: (item: LinenItem) => void }) {
  const visible = items.filter((item) => (category === "Todos" || item.category === category) && item.name.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")));
  const answered = items.filter((item) => item.answer !== "unanswered").length;
  return (
    <section className="mx-auto max-w-[390px]"><Button variant="ghost" className="-ml-3 min-h-11"><ArrowLeft /> Voltar</Button><p className="mt-4 text-xs font-semibold uppercase text-[var(--portal-muted)]">Prepare seu imóvel</p><h1 className="mt-1 text-2xl font-semibold text-[var(--portal-navy)]">Enxoval</h1><p className="mt-1 text-sm text-[var(--portal-muted)]">{answered} de {items.length} itens respondidos</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--portal-border)]"><div className="h-full rounded-full bg-[var(--portal-success)]" style={{ width: `${(answered / items.length) * 100}%` }} /></div>
      <GuideControls category={category} query={query} onCategory={onCategory} onQuery={onQuery} />
      <ul className="mt-5 space-y-4">{visible.map((item) => <li key={item.id} className="overflow-hidden rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface)] shadow-sm"><ItemVisual item={item} className="aspect-[16/9]" /><div className="p-4"><div className="flex items-start justify-between gap-2"><div><h2 className="font-semibold text-[var(--portal-navy)]">{item.name}</h2><p className="mt-1 text-sm text-[var(--portal-muted)]">Recomendado: {item.quantityLabel}</p><p className="mt-1 text-xs text-[var(--portal-muted)]">{item.standard}</p></div>{item.answer !== "unanswered" && <span className="shrink-0 rounded-full bg-[var(--portal-success-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--portal-success)]">{item.answer === "owned" ? "Já possui" : "Vai comprar"}</span>}</div><div className="mt-4 grid grid-cols-2 gap-2"><Button variant={item.answer === "owned" ? "default" : "outline"} className="h-12 px-2" onClick={() => onOwned(item)}><Check /> Já tenho</Button><Button variant={item.answer === "buy" ? "default" : "outline"} className="h-12 px-2" onClick={() => onBuy(item)}><ShoppingBag /> Vou comprar</Button></div><div className="mt-2 flex items-center justify-between"><Button variant="ghost" className="-ml-3" onClick={() => onDetail(item)}>Ver detalhes</Button>{savedId === item.id && <span className="flex items-center gap-1 text-xs text-[var(--portal-success)]"><Check className="size-3" /> Salvo</span>}</div></div></li>)}</ul>
    </section>
  );
}

function VisibilityPanel({ utensils, linen, onUtensils, onLinen }: { utensils: boolean; linen: boolean; onUtensils: (value: boolean) => void; onLinen: (value: boolean) => void }) {
  return (
    <section className="mx-auto max-w-2xl"><p className="text-xs font-semibold uppercase text-[var(--portal-muted)]">Implantação · {PROPERTY}</p><h1 className="mt-2 text-2xl font-semibold text-[var(--portal-navy)]">Guias no portal</h1><p className="mt-1 text-sm text-[var(--portal-muted)]">Cada guia possui sua própria liberação.</p><div className="mt-6 divide-y divide-[var(--portal-border)] overflow-hidden rounded-lg border border-[var(--portal-border)] bg-[var(--portal-surface)]"><VisibilityToggle label="Guia de utensílios" value={utensils} onChange={onUtensils} /><VisibilityToggle label="Guia de enxoval" value={linen} onChange={onLinen} /></div><p className="mt-4 text-sm text-[var(--portal-muted)]">Alterar um guia não afeta o outro, nem proposta ou documentos.</p></section>
  );
}

function VisibilityToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <div className="flex min-h-20 items-center justify-between gap-4 p-4"><div><p className="font-semibold text-[var(--portal-navy)]">{label}</p><p className={cn("mt-1 text-sm font-medium", value ? "text-[var(--portal-success)]" : "text-[var(--portal-muted)]")}>{value ? "● Visível" : "○ Privado"}</p></div><button type="button" role="switch" aria-checked={value} aria-label={`Alterar visibilidade de ${label}`} onClick={() => onChange(!value)} className={cn("relative h-7 w-12 shrink-0 rounded-full transition", value ? "bg-[var(--portal-success)]" : "bg-[var(--portal-border)]")}><span className={cn("absolute top-1 size-5 rounded-full bg-[var(--portal-surface)] shadow-sm transition-all", value ? "left-6" : "left-1")} /></button></div>;
}

function ItemVisual({ item, className }: { item: Pick<LinenItem, "name">; className?: string }) {
  return <div aria-label={`Imagem padrão STAYO para ${item.name}`} className={cn("relative grid w-full place-items-center overflow-hidden bg-[var(--portal-surface-soft)]", className)}><div className="absolute inset-x-0 top-0 h-1 bg-[var(--portal-success)]" /><span className="grid size-11 place-items-center rounded-full border border-[var(--portal-border)] bg-[var(--portal-surface)] text-[var(--portal-navy)]"><Package className="size-5" /></span><StayoLogo variant="green" decorative className="absolute bottom-2 right-2 h-3 w-auto opacity-50" /></div>;
}

function DetailSheet({ item, onClose, onEdit }: { item: LinenItem; onClose: () => void; onEdit: () => void }) {
  return <Sheet title={item.name} onClose={onClose}><ItemVisual item={item} className="aspect-[16/9] md:aspect-[4/3]" /><div className="space-y-5 p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]"><DetailValue label="Quantidade recomendada" value={item.quantityLabel} /><DetailValue label="Tamanho/padrão" value={item.standard} /><DetailValue label="Descrição" value={item.description} /><section className="rounded-lg bg-[var(--portal-surface-soft)] p-4"><p className="text-xs font-semibold uppercase text-[var(--portal-navy)]">Dica STAYO</p><p className="mt-1 text-sm leading-6">{item.tip}</p></section>{item.hasReference && <section><p className="text-xs font-semibold uppercase text-[var(--portal-muted)]">Indicação de compra</p><Button className="mt-2 h-11 w-full">Abrir referência <ExternalLink /></Button></section>}<div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><Button variant="outline" className="h-11" onClick={onEdit}>Editar</Button><Button size="icon" variant="ghost" aria-label="Mais ações"><MoreHorizontal /></Button></div></div></Sheet>;
}

function DetailValue({ label, value }: { label: string; value: string }) { return <section><p className="text-xs font-semibold uppercase text-[var(--portal-muted)]">{label}</p><p className="mt-1 text-sm leading-6 text-[var(--portal-navy)]">{value}</p></section>; }

function EditorSheet({ item, onClose }: { item: LinenItem | null; onClose: () => void }) {
  return <Sheet title={item ? `Editar ${item.name}` : "Adicionar item"} onClose={onClose}><div className="space-y-4 p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]"><DemoNotice /><button type="button" className="grid aspect-[16/7] w-full place-items-center rounded-lg border border-dashed border-[var(--portal-border)] bg-[var(--portal-surface-soft)] text-sm font-medium text-[var(--portal-navy)]"><span className="flex items-center gap-2"><ImagePlus /> {item ? "Trocar foto" : "Enviar foto"}</span></button>{["Nome", "Categoria", "Quantidade recomendada", "Tamanho/padrão", "Descrição/especificação", "Dica STAYO", "Link de indicação de compra"].map((label) => <label key={label} className="block"><span className="text-sm font-medium text-[var(--portal-navy)]">{label}</span>{label === "Descrição/especificação" || label === "Dica STAYO" ? <textarea className="mt-1 min-h-24 w-full rounded-lg border border-[var(--portal-border)] bg-[var(--portal-surface)] p-3 outline-none" defaultValue={item?.description ?? ""} /> : <input className="mt-1 h-11 w-full rounded-lg border border-[var(--portal-border)] bg-[var(--portal-surface)] px-3 outline-none" defaultValue={label === "Nome" ? item?.name : label === "Tamanho/padrão" ? item?.standard : ""} />}</label>)}<Button className="h-12 w-full" onClick={onClose}>Salvar exemplo</Button></div></Sheet>;
}

function QuantitySheet({ item, quantity, onQuantity, onClose, onSave }: { item: LinenItem; quantity: number; onQuantity: (value: number) => void; onClose: () => void; onSave: () => void }) {
  return <Sheet title="Quantos você já possui?" onClose={onClose}><div className="p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]"><p className="text-sm text-[var(--portal-muted)]">{item.name}</p><div className="mt-6 grid grid-cols-[auto_minmax(4rem,1fr)_auto] items-center gap-4"><Button size="icon" variant="outline" className="size-12 rounded-full" aria-label="Diminuir quantidade" onClick={() => onQuantity(Math.max(0, quantity - 1))}><Minus /></Button><span className="text-center text-3xl font-semibold text-[var(--portal-navy)]">{quantity}</span><Button size="icon" variant="outline" className="size-12 rounded-full" aria-label="Aumentar quantidade" onClick={() => onQuantity(Math.min(99, quantity + 1))}><Plus /></Button></div><p className="mt-4 text-center text-sm text-[var(--portal-muted)]">Recomendamos {item.recommended}.</p><Button className="mt-6 h-12 w-full" onClick={onSave}>Salvar</Button></div></Sheet>;
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 bg-foreground/40" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.currentTarget === event.target && onClose()}><aside className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-xl bg-[var(--portal-surface)] shadow-xl md:inset-y-0 md:left-auto md:w-[30rem] md:max-h-none md:rounded-none"><div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--portal-border)] bg-[var(--portal-surface)] px-5 py-4"><h2 className="truncate text-lg font-semibold text-[var(--portal-navy)]">{title}</h2><Button size="icon" variant="ghost" aria-label="Fechar" onClick={onClose}><X /></Button></div>{children}</aside></div>;
}