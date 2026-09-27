import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Search, Trash2 } from "lucide-react";
import {
  PENDING_OTHER_NAME,
  SPECIALTY_LABELS,
  SUPPLIER_ROLE_LABELS,
  isPendingOther,
  newEntry,
  type SupplierAnswer,
  type SupplierCatalogItem,
  type SupplierCategory,
  type SupplierEntry,
  type SupplierRole,
} from "@/lib/property-suppliers";

interface Props {
  categories: SupplierCategory[];
  entries: SupplierEntry[];
  catalog: SupplierCatalogItem[];
  onChange: (next: SupplierEntry[]) => void;
  mode: "owner" | "admin";
  /** Entrada editável neste contexto (ex.: proprietário não altera o que a STAYO revisou). */
  canEdit?: (e: SupplierEntry) => boolean;
  onRemoveCategory?: (key: string) => void;
}

interface DetailProps extends Omit<Props, "categories"> {
  category: SupplierCategory;
}

const field =
  "w-full min-h-11 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2";
const chip =
  "min-h-10 rounded-full border border-border px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2";

export function SupplierEditor({ categories, entries, catalog, onChange, mode, canEdit, onRemoveCategory }: Props) {
  const editable = (e: SupplierEntry) => (canEdit ? canEdit(e) : true);
  const update = (id: string, patch: Partial<SupplierEntry>) =>
    onChange(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const remove = (id: string) => onChange(entries.filter((e) => e.id !== id));

  const choose = (categoryKey: string, answer: SupplierAnswer, catalogId?: string) => {
    const entry = { ...newEntry(categoryKey, answer, mode), catalogId: catalogId ?? null };
    // "Não sei" / "Não se aplica" substituem as respostas editáveis da categoria.
    if (answer === "unknown" || answer === "not_applicable") {
      onChange([...entries.filter((e) => e.categoryKey !== categoryKey || !editable(e)), entry]);
      return;
    }
    onChange([
      ...entries.filter(
        (e) =>
          e.categoryKey !== categoryKey ||
          !editable(e) ||
          (e.answer !== "unknown" && e.answer !== "not_applicable"),
      ),
      entry,
    ]);
  };

  return (
    <div className="space-y-3">
      {categories.map((cat) => (
        <CategoryBlock
          key={cat.key}
          category={cat}
          entries={entries.filter((e) => e.categoryKey === cat.key)}
          catalog={catalog}
          mode={mode}
          editable={editable}
          onChoose={(a, id) => choose(cat.key, a, id)}
          onUpdate={update}
          onRemove={remove}
          onRemoveCategory={cat.custom && onRemoveCategory ? () => onRemoveCategory(cat.key) : undefined}
        />
      ))}
    </div>
  );
}

/** Edição focada de uma categoria no Admin; o editor completo do Portal permanece inalterado. */
export function SupplierCategoryDetail({ category, entries, catalog, onChange, mode, canEdit, onRemoveCategory }: DetailProps) {
  const editable = (entry: SupplierEntry) => (canEdit ? canEdit(entry) : true);
  const update = (id: string, patch: Partial<SupplierEntry>) =>
    onChange(entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  const remove = (id: string) => onChange(entries.filter((entry) => entry.id !== id));
  const choose = (answer: SupplierAnswer, catalogId?: string) => {
    const entry = { ...newEntry(category.key, answer, mode), catalogId: catalogId ?? null };
    if (answer === "unknown" || answer === "not_applicable") {
      onChange([...entries.filter((current) => current.categoryKey !== category.key || !editable(current)), entry]);
      return;
    }
    onChange([
      ...entries.filter(
        (current) =>
          current.categoryKey !== category.key ||
          !editable(current) ||
          (current.answer !== "unknown" && current.answer !== "not_applicable"),
      ),
      entry,
    ]);
  };

  return (
    <CategoryBlock
      category={category}
      entries={entries.filter((entry) => entry.categoryKey === category.key)}
      catalog={catalog}
      mode={mode}
      editable={editable}
      onChoose={choose}
      onUpdate={update}
      onRemove={remove}
      onRemoveCategory={category.custom && onRemoveCategory ? () => onRemoveCategory(category.key) : undefined}
      detail
    />
  );
}

function CategoryBlock({
  category,
  entries,
  catalog,
  mode,
  editable,
  onChoose,
  onUpdate,
  onRemove,
  onRemoveCategory,
  detail = false,
}: {
  category: SupplierCategory;
  entries: SupplierEntry[];
  catalog: SupplierCatalogItem[];
  mode: "owner" | "admin";
  editable: (e: SupplierEntry) => boolean;
  onChoose: (a: SupplierAnswer, catalogId?: string) => void;
  onUpdate: (id: string, patch: Partial<SupplierEntry>) => void;
  onRemove: (id: string) => void;
  onRemoveCategory?: (() => void) | undefined;
  detail?: boolean;
}) {
  const [searching, setSearching] = useState(false);
  const companies = entries.filter((e) => e.answer === "catalog" || e.answer === "other");
  const status = entries.find((e) => e.answer === "unknown" || e.answer === "not_applicable");
  const hasAny = entries.length > 0;

  return (
    <div className={detail ? "space-y-3" : "rounded-xl border border-border p-3 sm:p-4"} data-category={category.key}>
      <div className="flex items-start justify-between gap-2">
        <div>
          {!detail && <h4 className="text-sm font-semibold text-foreground">{category.label}</h4>}
          <p className={detail ? "text-sm font-medium text-foreground" : "text-xs text-muted-foreground"}>Quem forneceu ou instalou?</p>
        </div>
        {onRemoveCategory && !hasAny && (
          <button type="button" onClick={onRemoveCategory} className="text-xs text-muted-foreground underline">
            Remover categoria
          </button>
        )}
      </div>

      {companies.length > 0 && (
        <div className="mt-3 space-y-2">
          {companies.map((e) => (
            <EntryCard
              key={e.id}
              entry={e}
              catalog={catalog}
              mode={mode}
              editable={editable(e)}
              onUpdate={(p) => onUpdate(e.id, p)}
              onRemove={() => onRemove(e.id)}
            />
          ))}
        </div>
      )}

      {status && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
          <span className="font-medium">{status.answer === "unknown" ? "Não sei informar" : "Não se aplica"}</span>
          {editable(status) ? (
            <button type="button" className="text-xs underline" onClick={() => onRemove(status.id)}>
              Alterar
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">Revisado pela STAYO</span>
          )}
        </div>
      )}

      {searching ? (
        <CatalogSearch
          catalog={catalog}
          categoryKey={category.key}
          mode={mode}
          exclude={companies.map((c) => c.catalogId).filter(Boolean) as string[]}
          onPick={(id) => {
            onChoose("catalog", id);
            setSearching(false);
          }}
          onOther={() => {
            onChoose("other");
            setSearching(false);
          }}
          onClose={() => setSearching(false)}
        />
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={chip} onClick={() => setSearching(true)}>
            <Search className="mr-1 inline size-3.5" />
            {companies.length ? "Adicionar outra empresa" : "Buscar empresa"}
          </button>
          <button type="button" className={chip} onClick={() => onChoose("other")}>
            <Plus className="mr-1 inline size-3.5" />
            Outra empresa
          </button>
          {!status && companies.length === 0 && (
            <>
              <button type="button" className={chip} onClick={() => onChoose("unknown")}>
                Não sei informar
              </button>
              <button type="button" className={chip} onClick={() => onChoose("not_applicable")}>
                Não se aplica
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CatalogSearch({
  catalog,
  categoryKey,
  mode,
  exclude,
  onPick,
  onOther,
  onClose,
}: {
  catalog: SupplierCatalogItem[];
  categoryKey: string;
  mode: "owner" | "admin";
  exclude: string[];
  onPick: (id: string) => void;
  onOther: () => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    return catalog
      .filter((c) => !exclude.includes(c.id) && c.status !== "archived")
      .filter((c) => !term || c.name.toLowerCase().includes(term))
      .sort((a, b) => {
        const am = a.specialties.includes(categoryKey) ? 0 : 1;
        const bm = b.specialties.includes(categoryKey) ? 0 : 1;
        return am - bm || a.name.localeCompare(b.name);
      })
      .slice(0, 8);
  }, [catalog, q, categoryKey, exclude]);

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-border p-2">
      <input
        autoFocus
        aria-label="Buscar empresa"
        placeholder="Digite o nome da empresa"
        className={field}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <ul className="max-h-56 overflow-auto">
        {results.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onPick(c.id)}
              className="flex w-full min-h-11 flex-col items-start rounded-md px-2 py-1.5 text-left hover:bg-muted"
            >
              <span className="text-sm font-medium">
                {c.name}
                {mode === "admin" && c.status === "suggested" && (
                  <span className="ml-2 rounded bg-amber-100 px-1.5 text-[11px] text-amber-900">
                    sugestão não revisada
                  </span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                {c.specialties.map((s) => SPECIALTY_LABELS[s] ?? s).join(" · ") || "Sem especialidade"}
              </span>
            </button>
          </li>
        ))}
        {results.length === 0 && (
          <li className="px-2 py-2 text-xs text-muted-foreground">Nenhuma empresa encontrada.</li>
        )}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={chip} onClick={onOther}>
          <Plus className="mr-1 inline size-3.5" />
          Outra empresa
        </button>
        <button type="button" className="min-h-10 px-2 text-sm underline" onClick={onClose}>
          Cancelar
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Lista apenas de sugestões: não significa que a STAYO recomenda, contratou ou verificou a empresa.
      </p>
    </div>
  );
}

function EntryCard({
  entry,
  catalog,
  mode,
  editable,
  onUpdate,
  onRemove,
}: {
  entry: SupplierEntry;
  catalog: SupplierCatalogItem[];
  mode: "owner" | "admin";
  editable: boolean;
  onUpdate: (p: Partial<SupplierEntry>) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(
    Boolean(entry.phone || entry.service || entry.approxDate || entry.notes),
  );
  const pending = isPendingOther(entry);
  const catalogName = entry.catalogName ?? catalog.find((c) => c.id === entry.catalogId)?.name;
  const txt = (k: keyof SupplierEntry) => (v: string) => onUpdate({ [k]: v === "" ? null : v });

  return (
    <div className="rounded-lg border border-border bg-background p-3" data-entry={entry.id}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {entry.answer === "catalog" ? (
            <p className="text-sm font-semibold">{catalogName ?? "Empresa do catálogo"}</p>
          ) : (
            <label className="block text-xs font-medium text-muted-foreground">
              Nome da empresa ou profissional
              <input
                className={`${field} mt-1`}
                disabled={!editable}
                value={entry.otherName ?? ""}
                placeholder="Pode deixar em branco e completar depois"
                onChange={(e) => onUpdate({ otherName: e.target.value || null })}
              />
            </label>
          )}
          {pending && (
            <p className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-900">
              {PENDING_OTHER_NAME}
            </p>
          )}
          <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
            {mode === "admin" && (
              <span className="rounded bg-muted px-1.5">
                {entry.source === "owner" ? "Informado pelo proprietário" : "Registrado/revisado pela STAYO"}
              </span>
            )}
            {mode === "owner" && !editable && <span className="rounded bg-muted px-1.5">Revisado pela STAYO</span>}
          </div>
        </div>
        {editable && (
          <button type="button" aria-label="Remover empresa" onClick={onRemove} className="p-2 text-muted-foreground">
            <Trash2 className="size-4" />
          </button>
        )}
      </div>

      <select
        aria-label="O que a empresa fez"
        className={`${field} mt-2`}
        disabled={!editable}
        value={entry.role ?? ""}
        onChange={(e) => onUpdate({ role: (e.target.value || null) as SupplierRole | null })}
      >
        <option value="">O que fez? (opcional)</option>
        {Object.entries(SUPPLIER_ROLE_LABELS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-2 inline-flex min-h-10 items-center gap-1 text-xs font-medium underline"
      >
        {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        {open ? "Menos detalhes" : "Mais detalhes (opcional)"}
      </button>
      {open && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input aria-label="Telefone" placeholder="Telefone" inputMode="tel" className={field} disabled={!editable} value={entry.phone ?? ""} onChange={(e) => txt("phone")(e.target.value)} />
          <input aria-label="Data aproximada" placeholder="Data aproximada (ex.: 2023)" className={field} disabled={!editable} value={entry.approxDate ?? ""} onChange={(e) => txt("approxDate")(e.target.value)} />
          <input aria-label="Serviço realizado" placeholder="Serviço realizado" className={`${field} sm:col-span-2`} disabled={!editable} value={entry.service ?? ""} onChange={(e) => txt("service")(e.target.value)} />
          <textarea aria-label="Observações" placeholder="Observações" className={`${field} min-h-16 py-2 sm:col-span-2`} disabled={!editable} value={entry.notes ?? ""} onChange={(e) => txt("notes")(e.target.value)} />
          {mode === "admin" && (
            <textarea aria-label="Observação interna" placeholder="Observação interna (não aparece para o proprietário)" className={`${field} min-h-16 py-2 sm:col-span-2`} value={entry.adminNotes ?? ""} onChange={(e) => txt("adminNotes")(e.target.value)} />
          )}
        </div>
      )}
    </div>
  );
}
