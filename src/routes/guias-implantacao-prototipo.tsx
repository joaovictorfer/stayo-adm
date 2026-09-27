import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  ImagePlus,
  Library,
  Link as LinkIcon,
  PackageOpen,
  Plus,
  Search,
  Sparkles,
  Upload,
  Utensils,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import cookwareImage from "@/assets/guide-cookware.jpg";
import cutleryImage from "@/assets/guide-cutlery.jpg";
import glassesImage from "@/assets/guide-wine-glasses.jpg";
import { StayoLogo } from "@/components/brand/StayoLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/guias-implantacao-prototipo")({
  head: () => ({
    meta: [
      { title: "Guia aplicado à implantação — STAYO Admin" },
      {
        name: "description",
        content: "Demonstração visual do Guia de Utensílios aplicado a uma implantação STAYO.",
      },
      { property: "og:title", content: "Guia aplicado à implantação — STAYO Admin" },
      {
        property: "og:description",
        content: "Demonstração visual do Guia de Utensílios aplicado a uma implantação STAYO.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AppliedGuidePrototype,
});

type Category = "Cozinha" | "Quartos" | "Banheiros";
type Classification = "Essencial" | "Recomendado" | "Opcional";
type OwnerStatus = "Não informado" | "Já possui" | "Pretende comprar";
type Scenario = "entrada" | "vazio" | "aplicado";

type AppliedItem = {
  id: string;
  name: string;
  category: Category;
  quantity: string;
  classification: Classification;
  specification: string;
  image: string | null;
  tip: string;
  reference: string;
  ownerStatus: OwnerStatus;
  exclusive?: boolean;
  hidden?: boolean;
};

const PROPERTY = "Vêneto · A-Verona · 105";

const initialItems: AppliedItem[] = [
  {
    id: "talheres",
    name: "Talheres",
    category: "Cozinha",
    quantity: "Jogo com 12 peças",
    classification: "Recomendado",
    specification: "Inox polido ou fosco com bom acabamento.",
    image: cutleryImage,
    tip: "Prefira linhas de fácil reposição para manter o conjunto uniforme.",
    reference: "",
    ownerStatus: "Não informado",
  },
  {
    id: "tacas-vinho",
    name: "Taças de vinho",
    category: "Cozinha",
    quantity: "6 unidades",
    classification: "Recomendado",
    specification: "Vidro transparente, haste média e base estável.",
    image: glassesImage,
    tip: "Prefira uma linha resistente e disponível para reposição.",
    reference: "",
    ownerStatus: "Não informado",
  },
  {
    id: "cafeteira",
    name: "Cafeteira elétrica",
    category: "Cozinha",
    quantity: "1 unidade",
    classification: "Recomendado",
    specification: "Com jarra de vidro ou térmica, ideal para 6 xícaras.",
    image: null,
    tip: "Prefira controles simples e peças fáceis de higienizar.",
    reference: "",
    ownerStatus: "Já possui",
  },
  {
    id: "panelas",
    name: "Jogo de panelas antiaderentes",
    category: "Cozinha",
    quantity: "Mínimo 4 peças",
    classification: "Recomendado",
    specification: "Revestimento antiaderente com tampas de vidro.",
    image: cookwareImage,
    tip: "Prefira uma linha com peças avulsas para reposição.",
    reference: "",
    ownerStatus: "Pretende comprar",
  },
  {
    id: "cabides",
    name: "Cabides",
    category: "Quartos",
    quantity: "5 por armário",
    classification: "Opcional",
    specification: "Madeira clara ou acrílico transparente.",
    image: null,
    tip: "Use o mesmo modelo em todos os armários.",
    reference: "",
    ownerStatus: "Não informado",
  },
  {
    id: "secador",
    name: "Secador de cabelo",
    category: "Banheiros",
    quantity: "1 unidade",
    classification: "Recomendado",
    specification: "Modelo hotel ou conforme orientação.",
    image: null,
    tip: "Guarde em local protegido da umidade.",
    reference: "",
    ownerStatus: "Já possui",
  },
];

const catalogSuggestions = initialItems.slice(0, 4);

function AppliedGuidePrototype() {
  const [scenario, setScenario] = useState<Scenario>("entrada");
  const [category, setCategory] = useState<"Todos" | Category>("Todos");
  const [query, setQuery] = useState("");
  const [portalVisible, setPortalVisible] = useState(false);
  const [items, setItems] = useState(initialItems);
  const [editing, setEditing] = useState<AppliedItem | "exclusive" | null>(null);
  const [addMode, setAddMode] = useState<"choice" | "catalog" | null>(null);

  const shown = useMemo(
    () =>
      items.filter(
        (item) =>
          !item.hidden &&
          (category === "Todos" || item.category === category) &&
          item.name.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")),
      ),
    [category, items, query],
  );

  const saveItem = (item: AppliedItem) => {
    setItems((current) => {
      const exists = current.some((candidate) => candidate.id === item.id);
      return exists
        ? current.map((candidate) => (candidate.id === item.id ? item : candidate))
        : [...current, item];
    });
    setEditing(null);
  };

  return (
    <main className="min-w-0 pb-14 text-[var(--admin-text)]">
      <section className="mx-auto max-w-[76rem]">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-[var(--admin-border)] pb-4">
          <span className="text-xs font-semibold uppercase text-[var(--admin-muted)]">Protótipo visual</span>
          <div className="flex overflow-hidden rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-1">
            {([
              ["entrada", "Entrada"],
              ["vazio", "Sem guia"],
              ["aplicado", "Aplicado"],
            ] as const).map(([value, label]) => (
              <Button
                key={value}
                size="sm"
                variant={scenario === value ? "default" : "ghost"}
                className="h-8 min-w-0 px-2.5 text-xs sm:px-4"
                onClick={() => setScenario(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {scenario === "entrada" && <ImplementationEntry onOpen={() => setScenario("aplicado")} />}
        {scenario === "vazio" && (
          <EmptyGuide
            onApply={() => setScenario("aplicado")}
            onStartEmpty={() => setEditing("exclusive")}
          />
        )}
        {scenario === "aplicado" && (
          <AppliedGuide
            category={category}
            query={query}
            items={shown}
            total={items.filter((item) => !item.hidden).length}
            portalVisible={portalVisible}
            onBack={() => setScenario("entrada")}
            onCategory={setCategory}
            onQuery={setQuery}
            onPortal={setPortalVisible}
            onEdit={setEditing}
            onAdd={() => setAddMode("choice")}
          />
        )}
      </section>

      {editing && (
        <ItemEditor
          item={editing === "exclusive" ? null : editing}
          exclusive={editing === "exclusive"}
          onClose={() => setEditing(null)}
          onSave={saveItem}
        />
      )}
      {addMode && (
        <AddItemSheet
          mode={addMode}
          onMode={setAddMode}
          onClose={() => setAddMode(null)}
          onExclusive={() => {
            setAddMode(null);
            setEditing("exclusive");
          }}
        />
      )}
    </main>
  );
}

function ImplementationEntry({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="mx-auto max-w-3xl">
      <header>
        <p className="text-sm font-medium text-[var(--admin-success)]">Implantação</p>
        <h1 className="mt-1 font-[var(--stayo-font-display)] text-2xl font-semibold text-[var(--admin-primary)] sm:text-3xl">
          {PROPERTY}
        </h1>
      </header>
      <div className="mt-8">
        <p className="mb-3 text-xs font-semibold uppercase text-[var(--admin-muted)]">Guias da implantação</p>
        <Button
          variant="outline"
          onClick={onOpen}
          className="h-auto min-h-24 w-full justify-start rounded-[var(--admin-radius-lg)] border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-4 text-left shadow-[var(--admin-shadow-sm)] hover:border-[var(--admin-primary)] hover:bg-[var(--admin-surface)]"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-[var(--admin-radius)] bg-[var(--admin-success-soft)] text-[var(--admin-success)]">
            <Utensils className="size-6" />
          </span>
          <span className="min-w-0 flex-1 whitespace-normal">
            <span className="block text-base font-semibold text-[var(--admin-text)]">Utensílios</span>
            <span className="mt-1 block text-sm font-normal text-[var(--admin-muted)]">
              32 recomendações · Nenhuma resposta ainda
            </span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-[var(--admin-muted)]" />
        </Button>
      </div>
    </div>
  );
}

function EmptyGuide({ onApply, onStartEmpty }: { onApply: () => void; onStartEmpty: () => void }) {
  return (
    <div className="mx-auto max-w-xl pt-8 sm:pt-20">
      <div className="rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-5 py-10 text-center shadow-[var(--admin-shadow-sm)] sm:px-10">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-[var(--admin-success-soft)] text-[var(--admin-success)]">
          <PackageOpen className="size-7" />
        </div>
        <h1 className="mt-5 font-[var(--stayo-font-display)] text-2xl font-semibold text-[var(--admin-primary)]">
          Guia de utensílios
        </h1>
        <p className="mt-2 text-sm text-[var(--admin-muted)]">Nenhum guia aplicado ainda.</p>
        <Button className="mt-7 min-h-12 w-full" onClick={onApply}>
          <Sparkles /> Aplicar guia padrão STAYO
        </Button>
        <Button variant="ghost" className="mt-2 min-h-11 w-full" onClick={onStartEmpty}>
          Começar vazio
        </Button>
      </div>
    </div>
  );
}

function AppliedGuide({
  category,
  query,
  items,
  total,
  portalVisible,
  onBack,
  onCategory,
  onQuery,
  onPortal,
  onEdit,
  onAdd,
}: {
  category: "Todos" | Category;
  query: string;
  items: AppliedItem[];
  total: number;
  portalVisible: boolean;
  onBack: () => void;
  onCategory: (value: "Todos" | Category) => void;
  onQuery: (value: string) => void;
  onPortal: (value: boolean) => void;
  onEdit: (item: AppliedItem) => void;
  onAdd: () => void;
}) {
  return (
    <div>
      <Button variant="ghost" className="mb-3 -ml-3 min-h-11 text-[var(--admin-success)]" onClick={onBack}>
        <ArrowLeft /> Implantação
      </Button>
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-[var(--admin-border)] pb-5">
        <div className="min-w-0">
          <h1 className="font-[var(--stayo-font-display)] text-2xl font-semibold text-[var(--admin-primary)] sm:text-3xl">
            Guia de utensílios
          </h1>
          <p className="mt-1 truncate text-sm text-[var(--admin-muted)]">{PROPERTY}</p>
        </div>
        <Button onClick={onAdd}>
          <Plus /> <span className="hidden sm:inline">Adicionar item</span><span className="sm:hidden">Adicionar</span>
        </Button>
      </header>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="min-w-0 lg:order-1">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(["Todos", "Cozinha", "Quartos", "Banheiros"] as const).map((value) => (
              <Button
                key={value}
                size="sm"
                variant={category === value ? "default" : "outline"}
                className="shrink-0 rounded-full"
                onClick={() => onCategory(value)}
              >
                {value}
              </Button>
            ))}
          </div>
          <label className="admin-input mt-3 flex min-h-12 items-center gap-3 px-4">
            <Search className="size-5 shrink-0 text-[var(--admin-muted)]" />
            <input
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-base outline-none"
              placeholder="Buscar utensílio..."
              aria-label="Buscar utensílio"
            />
          </label>
          <p className="mt-4 text-xs font-medium text-[var(--admin-muted)]">{total} recomendações neste imóvel</p>
          {items.length ? (
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {items.map((item) => (
                <AppliedItemCard key={item.id} item={item} onOpen={() => onEdit(item)} />
              ))}
            </ul>
          ) : (
            <div className="mt-4 rounded-[var(--admin-radius-lg)] border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] p-10 text-center">
              <PackageOpen className="mx-auto size-8 text-[var(--admin-muted)]" />
              <p className="mt-3 font-semibold">Nenhum item encontrado</p>
            </div>
          )}
        </div>
        <PortalVisibility visible={portalVisible} onChange={onPortal} />
      </div>
    </div>
  );
}

function PortalVisibility({ visible, onChange }: { visible: boolean; onChange: (value: boolean) => void }) {
  return (
    <aside className="rounded-[var(--admin-radius-lg)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow-sm)] lg:sticky lg:top-4 lg:order-2">
      <p className="text-sm font-semibold">Portal do proprietário</p>
      <div className="mt-3 grid grid-cols-2 rounded-[var(--admin-radius)] bg-[var(--admin-surface-subtle)] p-1">
        <Button size="sm" variant={!visible ? "default" : "ghost"} onClick={() => onChange(false)}>
          Privado
        </Button>
        <Button size="sm" variant={visible ? "default" : "ghost"} onClick={() => onChange(true)}>
          Visível
        </Button>
      </div>
      <p className="mt-3 text-xs leading-5 text-[var(--admin-muted)]">
        Controla somente este Guia de Utensílios.
      </p>
    </aside>
  );
}

function AppliedItemCard({ item, onOpen }: { item: AppliedItem; onOpen: () => void }) {
  const statusTone =
    item.ownerStatus === "Já possui"
      ? "text-[var(--admin-success)]"
      : item.ownerStatus === "Pretende comprar"
        ? "text-[var(--admin-warning)]"
        : "text-[var(--admin-muted)]";
  return (
    <li>
      <Button
        type="button"
        variant="outline"
        onClick={onOpen}
        className="grid h-auto min-h-28 w-full grid-cols-[6.25rem_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-[var(--admin-radius-lg)] border-[var(--admin-border)] bg-[var(--admin-surface)] p-2 text-left shadow-[var(--admin-shadow-sm)] hover:border-[var(--admin-primary)] hover:bg-[var(--admin-surface)] hover:shadow-[var(--admin-shadow-md)]"
      >
        <ItemVisual item={item} compact />
        <span className="min-w-0 whitespace-normal px-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold text-[var(--admin-text)]">{item.name}</span>
            {item.exclusive && (
              <span className="shrink-0 rounded-full bg-[var(--admin-info-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--admin-primary)]">
                Exclusivo
              </span>
            )}
          </span>
          <span className="mt-1 block truncate text-sm font-normal text-[var(--admin-muted)]">
            Recomendado: {item.quantity}
          </span>
          <span className={cn("mt-2 block truncate text-xs font-medium", statusTone)}>
            {item.ownerStatus === "Não informado" ? "Ainda não informado" : `Proprietário: ${item.ownerStatus.toLocaleLowerCase("pt-BR")}`}
          </span>
        </span>
        <ChevronRight className="mr-2 size-5 shrink-0 text-[var(--admin-muted)]" />
      </Button>
    </li>
  );
}

function ItemVisual({ item, compact = false }: { item: Pick<AppliedItem, "name" | "image">; compact?: boolean }) {
  const box = compact ? "h-24 w-[6.25rem]" : "aspect-[4/3] w-full";
  if (item.image) {
    return <img src={item.image} alt={item.name} className={cn(box, "rounded-[var(--admin-radius)] object-cover")} />;
  }
  return (
    <div
      aria-label={`Placeholder STAYO para ${item.name}`}
      className={cn(
        box,
        "relative grid place-items-center overflow-hidden rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface-subtle)]",
      )}
    >
      <div className="absolute left-0 top-0 h-1 w-full bg-[var(--admin-success)]" />
      <Utensils className={cn("text-[var(--admin-primary)]", compact ? "size-7" : "size-12")} />
      <span className="absolute bottom-2 right-2">
        <StayoLogo variant="green" decorative className={compact ? "h-3 w-auto opacity-60" : "h-4 w-auto opacity-60"} />
      </span>
    </div>
  );
}

function AddItemSheet({
  mode,
  onMode,
  onClose,
  onExclusive,
}: {
  mode: "choice" | "catalog";
  onMode: (mode: "choice" | "catalog") => void;
  onClose: () => void;
  onExclusive: () => void;
}) {
  return (
    <Sheet title={mode === "choice" ? "Adicionar item" : "Do catálogo STAYO"} onClose={onClose}>
      {mode === "choice" ? (
        <div className="grid gap-3 p-5">
          <Button
            variant="outline"
            className="h-auto min-h-20 justify-start border-[var(--admin-border)] px-4 text-left"
            onClick={() => onMode("catalog")}
          >
            <Library className="size-6 text-[var(--admin-success)]" />
            <span className="min-w-0 whitespace-normal">
              <span className="block font-semibold">Do catálogo STAYO</span>
              <span className="mt-1 block text-xs font-normal text-[var(--admin-muted)]">Adicionar uma recomendação já existente</span>
            </span>
            <ChevronRight className="ml-auto" />
          </Button>
          <Button
            variant="outline"
            className="h-auto min-h-20 justify-start border-[var(--admin-border)] px-4 text-left"
            onClick={onExclusive}
          >
            <Sparkles className="size-6 text-[var(--admin-success)]" />
            <span className="min-w-0 whitespace-normal">
              <span className="block font-semibold">Item exclusivo deste imóvel</span>
              <span className="mt-1 block text-xs font-normal text-[var(--admin-muted)]">Criar uma recomendação só para esta implantação</span>
            </span>
            <ChevronRight className="ml-auto" />
          </Button>
        </div>
      ) : (
        <div className="p-5">
          <label className="admin-input flex min-h-12 items-center gap-3 px-4">
            <Search className="size-5 text-[var(--admin-muted)]" />
            <input className="min-w-0 flex-1 bg-transparent text-base outline-none" placeholder="Buscar no catálogo..." />
          </label>
          <ul className="mt-4 divide-y divide-[var(--admin-border)]">
            {catalogSuggestions.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-3">
                <ItemVisual item={item} compact />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{item.name}</span>
                  <span className="block truncate text-xs text-[var(--admin-muted)]">{item.quantity}</span>
                </span>
                <Button size="icon" variant="outline" aria-label={`Adicionar ${item.name}`} onClick={onClose}>
                  <Plus />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Sheet>
  );
}

function ItemEditor({
  item,
  exclusive,
  onClose,
  onSave,
}: {
  item: AppliedItem | null;
  exclusive: boolean;
  onClose: () => void;
  onSave: (item: AppliedItem) => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState<Category>(item?.category ?? "Cozinha");
  const [quantity, setQuantity] = useState(item?.quantity ?? "1 unidade");
  const [classification, setClassification] = useState<Classification>(item?.classification ?? "Recomendado");
  const [specification, setSpecification] = useState(item?.specification ?? "");
  const [tip, setTip] = useState(item?.tip ?? "");
  const [reference, setReference] = useState(item?.reference ?? "");
  const [hidden, setHidden] = useState(item?.hidden ?? false);

  const save = () => {
    if (!name.trim()) return;
    onSave({
      id: item?.id ?? `exclusive-${Date.now()}`,
      name: name.trim(),
      category,
      quantity,
      classification,
      specification,
      image: item?.image ?? null,
      tip,
      reference,
      ownerStatus: item?.ownerStatus ?? "Não informado",
      exclusive: exclusive || item?.exclusive,
      hidden,
    });
  };

  return (
    <Sheet title={exclusive ? "Item exclusivo" : "Editar item"} eyebrow={exclusive ? "Somente neste imóvel" : item?.name} onClose={onClose}>
      <form
        className="space-y-5 p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <div className="rounded-[var(--admin-radius)] bg-[var(--admin-success-soft)] p-3 text-xs leading-5 text-[var(--admin-success)]">
          Esta edição vale somente para {PROPERTY}. O Guia STAYO não será alterado.
        </div>
        <div>
          <FieldLabel>Foto</FieldLabel>
          <div className="mt-2 grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-3">
            <ItemVisual item={{ name: name || "Novo item", image: item?.image ?? null }} compact />
            <Button type="button" variant="outline">
              <Upload /> {item?.image ? "Trocar foto" : "Enviar foto"}
            </Button>
          </div>
        </div>
        <FormField label="Nome">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do item" required />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Categoria">
            <select value={category} onChange={(event) => setCategory(event.target.value as Category)} className="admin-input h-10 w-full px-3 text-sm">
              <option>Cozinha</option>
              <option>Quartos</option>
              <option>Banheiros</option>
            </select>
          </FormField>
          <FormField label="Quantidade recomendada">
            <Input value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </FormField>
        </div>
        <div>
          <FieldLabel>Classificação</FieldLabel>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(["Essencial", "Recomendado", "Opcional"] as Classification[]).map((value) => (
              <Button
                type="button"
                key={value}
                size="sm"
                variant={classification === value ? "default" : "outline"}
                className="min-w-0 px-1 text-[11px] sm:text-xs"
                onClick={() => setClassification(value)}
              >
                {value}
              </Button>
            ))}
          </div>
        </div>
        <FormField label="Descrição / especificação">
          <Textarea value={specification} onChange={(event) => setSpecification(event.target.value)} className="min-h-24" />
        </FormField>
        <FormField label="Dica STAYO">
          <Textarea value={tip} onChange={(event) => setTip(event.target.value)} className="min-h-20" />
        </FormField>
        <FormField label="Link de indicação de compra">
          <div className="relative">
            <LinkIcon className="pointer-events-none absolute left-3 top-3 size-4 text-[var(--admin-muted)]" />
            <Input value={reference} onChange={(event) => setReference(event.target.value)} className="pl-9" type="url" placeholder="https://" />
          </div>
        </FormField>
        {!exclusive && (
          <label className="flex min-h-12 items-center justify-between gap-3 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-4">
            <span className="text-sm font-medium">Ocultar deste imóvel</span>
            <input type="checkbox" role="switch" checked={hidden} onChange={(event) => setHidden(event.target.checked)} className="size-5 accent-[var(--admin-success)]" />
          </label>
        )}
        <div className="grid grid-cols-2 gap-2 border-t border-[var(--admin-border)] pt-5">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit">Salvar</Button>
        </div>
      </form>
    </Sheet>
  );
}

function Sheet({
  title,
  eyebrow,
  onClose,
  children,
}: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-foreground/40" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <aside className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-2xl bg-[var(--admin-surface)] shadow-[var(--admin-shadow-lg)] md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[30rem] md:rounded-none">
        <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-5 py-4">
          <div className="min-w-0">
            {eyebrow && <p className="truncate text-xs font-semibold uppercase text-[var(--admin-accent)]">{eyebrow}</p>}
            <h2 className="truncate text-lg font-semibold">{title}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar"><X /></Button>
        </div>
        {children}
      </aside>
    </div>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <span className="text-sm font-semibold">{children}</span>;
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <div className="mt-2">{children}</div>
    </label>
  );
}