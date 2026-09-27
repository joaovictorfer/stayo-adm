import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  ExternalLink,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShoppingBag,
  Utensils,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import cookwareImage from "@/assets/guide-cookware.jpg";
import cutleryImage from "@/assets/guide-cutlery.jpg";
import glassesImage from "@/assets/guide-wine-glasses.jpg";
import { StayoLogo } from "@/components/brand/StayoLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/guias-implantacao-prototipo")({
  head: () => ({
    meta: [
      { title: "Guia de Utensílios do proprietário — STAYO" },
      {
        name: "description",
        content: "Demonstração visual mobile do Guia de Utensílios para o proprietário.",
      },
      { property: "og:title", content: "Guia de Utensílios do proprietário — STAYO" },
      {
        property: "og:description",
        content: "Demonstração visual mobile do Guia de Utensílios para o proprietário.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OwnerGuidePrototype,
});

type Category = "Cozinha" | "Quartos" | "Banheiros";
type Answer = "unanswered" | "owned" | "buy";
type Screen = "entry" | "guide";

type GuideItem = {
  id: string;
  name: string;
  category: Category;
  recommended: number;
  quantityLabel: string;
  specification: string;
  tip: string;
  image: string | null;
  hasReference: boolean;
  answer: Answer;
  ownedQuantity: number | null;
};

const initialItems: GuideItem[] = [
  {
    id: "cafeteira",
    name: "Cafeteira elétrica",
    category: "Cozinha",
    recommended: 1,
    quantityLabel: "1 unidade",
    specification: "Com jarra de vidro ou térmica, ideal para 6 xícaras.",
    tip: "Prefira controles simples e peças fáceis de higienizar.",
    image: null,
    hasReference: true,
    answer: "unanswered",
    ownedQuantity: null,
  },
  {
    id: "tacas-vinho",
    name: "Taças de vinho",
    category: "Cozinha",
    recommended: 6,
    quantityLabel: "6 unidades",
    specification: "Vidro transparente, haste média e base estável.",
    tip: "Prefira uma linha de fácil reposição.",
    image: glassesImage,
    hasReference: true,
    answer: "unanswered",
    ownedQuantity: null,
  },
  {
    id: "talheres",
    name: "Talheres",
    category: "Cozinha",
    recommended: 12,
    quantityLabel: "jogo com 12 peças",
    specification: "Inox polido ou fosco, com desenho simples e bom acabamento.",
    tip: "Escolha uma linha disponível para reposição de peças avulsas.",
    image: cutleryImage,
    hasReference: false,
    answer: "owned",
    ownedQuantity: 12,
  },
  {
    id: "panelas",
    name: "Jogo de panelas",
    category: "Cozinha",
    recommended: 1,
    quantityLabel: "1 jogo",
    specification: "Conjunto antiaderente com tampas e tamanhos variados.",
    tip: "Cabos firmes e peças fáceis de limpar ajudam no uso diário.",
    image: cookwareImage,
    hasReference: true,
    answer: "buy",
    ownedQuantity: null,
  },
  {
    id: "cabides",
    name: "Cabides",
    category: "Quartos",
    recommended: 5,
    quantityLabel: "5 por armário",
    specification: "Madeira clara ou acrílico transparente.",
    tip: "Use o mesmo modelo em todos os armários.",
    image: null,
    hasReference: false,
    answer: "owned",
    ownedQuantity: 4,
  },
  {
    id: "secador",
    name: "Secador de cabelo",
    category: "Banheiros",
    recommended: 1,
    quantityLabel: "1 unidade",
    specification: "Modelo compacto, com potência adequada para uso frequente.",
    tip: "Guarde em local protegido da umidade.",
    image: null,
    hasReference: true,
    answer: "buy",
    ownedQuantity: null,
  },
];

function OwnerGuidePrototype() {
  const [screen, setScreen] = useState<Screen>("entry");
  const [category, setCategory] = useState<"Todos" | Category>("Todos");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState(initialItems);
  const [quantityItem, setQuantityItem] = useState<GuideItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [detail, setDetail] = useState<GuideItem | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const prototypeAnswered = items.filter((item) => item.answer !== "unanswered").length;
  const displayedAnswered = Math.min(32, 8 + prototypeAnswered);
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
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, answer, ownedQuantity } : item)),
    );
    setSavedId(id);
    window.setTimeout(() => setSavedId((current) => (current === id ? null : current)), 1800);
  };

  const chooseOwned = (item: GuideItem) => {
    if (item.recommended === 1) {
      saveAnswer(item.id, "owned", 1);
      return;
    }
    setQuantity(item.ownedQuantity ?? Math.min(item.recommended, 4));
    setQuantityItem(item);
  };

  return (
    <main className="min-h-dvh bg-[var(--portal-background,#f5f7f5)] text-[var(--portal-foreground,var(--stayo-ink))]">
      <div className="mx-auto w-full max-w-[390px] px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4">
        <div className="mb-4 flex items-center justify-between border-b border-[var(--portal-border)] pb-3">
          <span className="text-[11px] font-semibold uppercase text-[var(--portal-muted)]">Protótipo mobile · 390 px</span>
          <div className="flex rounded-full border border-[var(--portal-border)] bg-[var(--portal-surface,white)] p-1">
            <Button
              size="sm"
              variant={screen === "entry" ? "default" : "ghost"}
              className="h-8 rounded-full px-3 text-xs"
              onClick={() => setScreen("entry")}
            >
              Entrada
            </Button>
            <Button
              size="sm"
              variant={screen === "guide" ? "default" : "ghost"}
              className="h-8 rounded-full px-3 text-xs"
              onClick={() => setScreen("guide")}
            >
              Guia
            </Button>
          </div>
        </div>

        {screen === "entry" ? (
          <ModuleEntry answered={displayedAnswered} onContinue={() => setScreen("guide")} />
        ) : (
          <GuideList
            items={shown}
            answered={displayedAnswered}
            category={category}
            query={query}
            savedId={savedId}
            onBack={() => setScreen("entry")}
            onCategory={setCategory}
            onQuery={setQuery}
            onOwned={chooseOwned}
            onBuy={(item) => saveAnswer(item.id, "buy")}
            onDetail={setDetail}
          />
        )}
      </div>

      {quantityItem && (
        <QuantitySheet
          item={quantityItem}
          quantity={quantity}
          onQuantity={setQuantity}
          onClose={() => setQuantityItem(null)}
          onSave={() => {
            saveAnswer(quantityItem.id, "owned", quantity);
            setQuantityItem(null);
          }}
        />
      )}
      {detail && <DetailSheet item={detail} onClose={() => setDetail(null)} />}
    </main>
  );
}

function ModuleEntry({ answered, onContinue }: { answered: number; onContinue: () => void }) {
  return (
    <section className="pt-8">
      <header>
        <StayoLogo variant="green" className="h-7 w-auto" />
        <p className="mt-10 text-xs font-semibold uppercase text-[var(--portal-muted)]">Prepare seu imóvel</p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--portal-navy)]">Tudo pronto, no seu ritmo</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--portal-muted)]">
          Informe os itens que você já possui ou pretende comprar.
        </p>
      </header>

      <div className="mt-7 overflow-hidden rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface,white)] shadow-sm">
        <div className="p-5">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--portal-surface-soft)] text-[var(--portal-navy)]">
              <Utensils className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-[var(--portal-navy)]">Utensílios</h2>
              <p className="mt-0.5 text-sm text-[var(--portal-muted)]">{answered} de 32 respondidos</p>
            </div>
            <ChevronRight className="size-5 shrink-0 text-[var(--portal-muted)]" />
          </div>
          <ProgressBar answered={answered} />
          <Button className="mt-5 h-12 w-full rounded-xl" onClick={onContinue}>
            Continuar
          </Button>
        </div>
      </div>
    </section>
  );
}

function GuideList({
  items,
  answered,
  category,
  query,
  savedId,
  onBack,
  onCategory,
  onQuery,
  onOwned,
  onBuy,
  onDetail,
}: {
  items: GuideItem[];
  answered: number;
  category: "Todos" | Category;
  query: string;
  savedId: string | null;
  onBack: () => void;
  onCategory: (value: "Todos" | Category) => void;
  onQuery: (value: string) => void;
  onOwned: (item: GuideItem) => void;
  onBuy: (item: GuideItem) => void;
  onDetail: (item: GuideItem) => void;
}) {
  return (
    <section>
      <Button variant="ghost" className="-ml-3 min-h-11 text-[var(--portal-navy)]" onClick={onBack}>
        <ArrowLeft /> Voltar
      </Button>
      <header className="mt-2">
        <h1 className="text-2xl font-semibold text-[var(--portal-navy)]">Utensílios</h1>
        <p className="mt-1 text-sm text-[var(--portal-muted)]">{answered} de 32 itens respondidos</p>
        <ProgressBar answered={answered} />
      </header>

      <div className="scroll-mask hide-scrollbar mt-5 flex max-w-full gap-2 overflow-x-auto pb-1">
        {(["Todos", "Cozinha", "Quartos", "Banheiros"] as const).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={category === value ? "default" : "outline"}
            className="min-h-10 shrink-0 rounded-full px-4"
            onClick={() => onCategory(value)}
          >
            {value}
          </Button>
        ))}
      </div>

      <label className="mt-3 flex min-h-12 items-center gap-3 rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface,white)] px-4">
        <Search className="size-5 shrink-0 text-[var(--portal-muted)]" />
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-base outline-none"
          placeholder="Buscar..."
          aria-label="Buscar utensílio"
        />
      </label>

      {items.length ? (
        <ul className="mt-5 space-y-4">
          {items.map((item) => (
            <OwnerItemCard
              key={item.id}
              item={item}
              saved={savedId === item.id}
              onOwned={() => onOwned(item)}
              onBuy={() => onBuy(item)}
              onDetail={() => onDetail(item)}
            />
          ))}
        </ul>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-[var(--portal-border)] bg-[var(--portal-surface,white)] p-8 text-center">
          <p className="font-medium">Nenhum item encontrado</p>
          <p className="mt-1 text-sm text-[var(--portal-muted)]">Tente outra busca ou categoria.</p>
        </div>
      )}

      <Completion answered={answered} onBack={onBack} />
    </section>
  );
}

function OwnerItemCard({
  item,
  saved,
  onOwned,
  onBuy,
  onDetail,
}: {
  item: GuideItem;
  saved: boolean;
  onOwned: () => void;
  onBuy: () => void;
  onDetail: () => void;
}) {
  return (
    <li className="overflow-hidden rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface,white)] shadow-sm">
      <ItemVisual item={item} />
      <div className="p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-6 text-[var(--portal-navy)]">{item.name}</h2>
            <p className="mt-1 text-sm text-[var(--portal-muted)]">Recomendado: {item.quantityLabel}</p>
          </div>
          <StatusPill answer={item.answer} quantity={item.ownedQuantity} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            variant={item.answer === "owned" ? "default" : "outline"}
            className="h-12 min-w-0 rounded-xl px-2"
            onClick={onOwned}
            aria-pressed={item.answer === "owned"}
          >
            <Check className="size-4" /> Já tenho
          </Button>
          <Button
            variant={item.answer === "buy" ? "default" : "outline"}
            className="h-12 min-w-0 rounded-xl px-2"
            onClick={onBuy}
            aria-pressed={item.answer === "buy"}
          >
            <ShoppingBag className="size-4" /> Vou comprar
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <Button variant="ghost" className="-ml-3 justify-start text-[var(--portal-navy)]" onClick={onDetail}>
            Ver detalhes
          </Button>
          {item.answer === "buy" && item.hasReference && (
            <Button variant="ghost" className="px-2 text-[var(--portal-navy)]" onClick={onDetail}>
              Ver indicação
            </Button>
          )}
          {saved && (
            <span className="col-span-2 flex items-center gap-1 text-xs text-[var(--portal-success)]" role="status">
              <Check className="size-3.5" /> Salvo
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

function StatusPill({ answer, quantity }: { answer: Answer; quantity: number | null }) {
  if (answer === "owned") {
    return (
      <span className="shrink-0 rounded-full bg-[var(--portal-success-soft,#eaf5ee)] px-2.5 py-1 text-[11px] font-semibold text-[var(--portal-success)]">
        Já possui{quantity && quantity > 1 ? ` · ${quantity}` : ""}
      </span>
    );
  }
  if (answer === "buy") {
    return (
      <span className="shrink-0 rounded-full bg-[var(--portal-surface-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--portal-navy)]">
        Vai comprar
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full border border-[var(--portal-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--portal-muted)]">
      Não respondido
    </span>
  );
}

function ItemVisual({ item, large = false }: { item: Pick<GuideItem, "name" | "image">; large?: boolean }) {
  const size = large ? "aspect-[4/3]" : "aspect-[16/10]";
  if (item.image) {
    return <img src={item.image} alt={item.name} className={cn(size, "w-full object-cover")} />;
  }
  return (
    <div
      aria-label={`Imagem padrão STAYO para ${item.name}`}
      className={cn(size, "relative grid w-full place-items-center overflow-hidden bg-[var(--portal-surface-soft)]")}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-[var(--portal-success)]" />
      <span className="grid size-16 place-items-center rounded-full border border-[var(--portal-border)] bg-[var(--portal-surface,white)] text-[var(--portal-navy)]">
        <Utensils className="size-7" />
      </span>
      <span className="absolute bottom-4 right-4">
        <StayoLogo variant="green" decorative className="h-4 w-auto opacity-60" />
      </span>
    </div>
  );
}

function ProgressBar({ answered }: { answered: number }) {
  return (
    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--portal-border)]" aria-label={`${answered} de 32 itens respondidos`}>
      <div
        className="h-full rounded-full bg-[var(--portal-success)] transition-[width] duration-300"
        style={{ width: `${Math.min(100, (answered / 32) * 100)}%` }}
      />
    </div>
  );
}

function Completion({ answered, onBack }: { answered: number; onBack: () => void }) {
  return (
    <section className="mt-6 rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-surface,white)] p-5 text-center">
      <span className="mx-auto grid size-11 place-items-center rounded-full bg-[var(--portal-success-soft,#eaf5ee)] text-[var(--portal-success)]">
        <PackageCheck className="size-5" />
      </span>
      <h2 className="mt-3 font-semibold text-[var(--portal-navy)]">Continue quando estiver pronto</h2>
      <p className="mt-1 text-sm text-[var(--portal-muted)]">{answered} de 32 itens respondidos</p>
      <ProgressBar answered={answered} />
      <Button variant="outline" className="mt-4 h-11 w-full rounded-xl" onClick={onBack}>
        Voltar à jornada
      </Button>
    </section>
  );
}

function QuantitySheet({
  item,
  quantity,
  onQuantity,
  onClose,
  onSave,
}: {
  item: GuideItem;
  quantity: number;
  onQuantity: (value: number) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Sheet title="Quantos você já possui?" onClose={onClose}>
      <div className="p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <p className="text-sm text-[var(--portal-muted)]">{item.name}</p>
        <div className="mt-6 grid grid-cols-[auto_minmax(4rem,1fr)_auto] items-center gap-4">
          <Button
            size="icon"
            variant="outline"
            className="size-12 rounded-full"
            aria-label="Diminuir quantidade"
            onClick={() => onQuantity(Math.max(0, quantity - 1))}
          >
            <Minus />
          </Button>
          <span className="text-center text-3xl font-semibold text-[var(--portal-navy)]" aria-live="polite">
            {quantity}
          </span>
          <Button
            size="icon"
            variant="outline"
            className="size-12 rounded-full"
            aria-label="Aumentar quantidade"
            onClick={() => onQuantity(Math.min(99, quantity + 1))}
          >
            <Plus />
          </Button>
        </div>
        <p className="mt-4 text-center text-sm text-[var(--portal-muted)]">Recomendamos {item.recommended}.</p>
        <Button className="mt-6 h-12 w-full rounded-xl" onClick={onSave}>
          Salvar
        </Button>
      </div>
    </Sheet>
  );
}

function DetailSheet({ item, onClose }: { item: GuideItem; onClose: () => void }) {
  return (
    <Sheet title={item.name} onClose={onClose}>
      <ItemVisual item={item} large />
      <div className="space-y-5 p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <section>
          <p className="text-xs font-semibold uppercase text-[var(--portal-muted)]">Recomendamos</p>
          <p className="mt-1 text-xl font-semibold text-[var(--portal-navy)]">{item.quantityLabel}</p>
        </section>
        <p className="text-sm leading-6 text-[var(--portal-foreground,var(--stayo-ink))]">{item.specification}</p>
        <section className="rounded-xl bg-[var(--portal-surface-soft)] p-4">
          <p className="text-xs font-semibold uppercase text-[var(--portal-navy)]">Dica STAYO</p>
          <p className="mt-1 text-sm leading-6">{item.tip}</p>
        </section>
        {item.hasReference && (
          <section>
            <p className="text-xs font-semibold uppercase text-[var(--portal-muted)]">Indicação STAYO</p>
            <Button className="mt-2 h-12 w-full rounded-xl">
              Ver produto <ExternalLink className="size-4" />
            </Button>
            <p className="mt-3 text-xs leading-5 text-[var(--portal-muted)]">
              Esta é apenas uma referência da STAYO. Você pode escolher outro produto equivalente.
            </p>
          </section>
        )}
      </div>
    </Sheet>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/40"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => event.currentTarget === event.target && onClose()}
    >
      <aside className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-2xl bg-[var(--portal-surface,white)] shadow-xl">
        <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--portal-border)] bg-[var(--portal-surface,white)] px-5 py-4">
          <h2 className="min-w-0 truncate text-lg font-semibold text-[var(--portal-navy)]">{title}</h2>
          <Button size="icon" variant="ghost" aria-label="Fechar" onClick={onClose}>
            <X />
          </Button>
        </div>
        {children}
      </aside>
    </div>
  );
}
