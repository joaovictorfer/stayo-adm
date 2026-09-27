import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_SUPPLIER_CATEGORIES,
  SPECIALTY_LABELS,
  isPendingOther,
  mergeCategories,
  slugCategory,
  type SupplierCatalogItem,
  type SupplierCategory,
  type SupplierEntry,
} from "@/lib/property-suppliers";
import { summarizeSupplierCategory } from "@/lib/property-supplier-summary";
import { SupplierEditor } from "./SupplierEditor";

type Row = {
  id: string;
  category_key: string;
  answer: SupplierEntry["answer"];
  catalog_id: string | null;
  other_name: string | null;
  role: SupplierEntry["role"];
  phone: string | null;
  service: string | null;
  approx_date: string | null;
  notes: string | null;
  admin_notes: string | null;
  source: "owner" | "admin";
  reviewed_at: string | null;
  deleted_at: string | null;
};

const fromRow = (row: Row): SupplierEntry => ({
  id: row.id,
  categoryKey: row.category_key,
  answer: row.answer,
  catalogId: row.catalog_id,
  otherName: row.other_name,
  role: row.role,
  phone: row.phone,
  service: row.service,
  approxDate: row.approx_date,
  notes: row.notes,
  adminNotes: row.admin_notes,
  source: row.source,
  reviewedAt: row.reviewed_at,
});

const comparable = (entry: SupplierEntry) =>
  JSON.stringify([
    entry.categoryKey,
    entry.answer,
    entry.catalogId,
    entry.otherName,
    entry.role,
    entry.phone,
    entry.service,
    entry.approxDate,
    entry.notes,
    entry.adminNotes ?? null,
  ]);

async function load(implementationId: string) {
  const [entries, categories, catalog] = await Promise.all([
    supabase
      .from("property_supplier_entries")
      .select("*")
      .eq("implementation_id", implementationId)
      .is("deleted_at", null)
      .order("created_at"),
    supabase
      .from("property_supplier_categories")
      .select("key,label")
      .eq("implementation_id", implementationId)
      .order("created_at"),
    supabase.from("supplier_catalog").select("id,name,specialties,status").order("name"),
  ]);
  if (entries.error) throw entries.error;
  if (categories.error) throw categories.error;
  if (catalog.error) throw catalog.error;
  return {
    entries: (entries.data as Row[]).map(fromRow),
    categories: categories.data as SupplierCategory[],
    catalog: catalog.data as SupplierCatalogItem[],
  };
}

/** Ficha administrativa: lista compacta de categorias e detalhe sob demanda. */
export function PropertySuppliersPanel({ implementationId }: { implementationId: string }) {
  const qc = useQueryClient();
  const key = ["property-suppliers", implementationId];
  const q = useQuery({ queryKey: key, queryFn: () => load(implementationId) });
  const [entries, setEntries] = useState<SupplierEntry[] | null>(null);
  const base = useRef<Map<string, SupplierEntry>>(new Map());
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<SupplierEntry[]>([]);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null);
  const [newCat, setNewCat] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);

  useEffect(() => {
    if (q.data && entries === null) {
      setEntries(q.data.entries);
      latest.current = q.data.entries;
      base.current = new Map(q.data.entries.map((entry) => [entry.id, entry]));
    }
  }, [q.data, entries]);

  const save = async () => {
    const current = latest.current;
    setState("saving");
    const { data: userData } = await supabase.auth.getUser();
    const now = new Date().toISOString();
    const ids = new Set(current.map((entry) => entry.id));

    try {
      for (const entry of current) {
        const previous = base.current.get(entry.id);
        if (previous && comparable(previous) === comparable(entry)) continue;

        // Qualquer correção da STAYO vira resposta revisada; a versão anterior segue no histórico do banco.
        const row = {
          id: entry.id,
          implementation_id: implementationId,
          category_key: entry.categoryKey,
          answer: entry.answer,
          catalog_id: entry.answer === "catalog" ? entry.catalogId : null,
          other_name: entry.answer === "other" ? entry.otherName?.trim() || null : null,
          role: entry.role,
          phone: entry.phone,
          service: entry.service,
          approx_date: entry.approxDate,
          notes: entry.notes,
          admin_notes: entry.adminNotes ?? null,
          source: "admin" as const,
          reviewed_by: userData.user?.id ?? null,
          reviewed_at: now,
        };
        const { error } = await supabase.from("property_supplier_entries").upsert(row);
        if (error) throw error;
        base.current.set(entry.id, { ...entry, source: "admin", reviewedAt: now });
      }

      for (const id of [...base.current.keys()]) {
        if (ids.has(id)) continue;
        const { error } = await supabase
          .from("property_supplier_entries")
          .update({ deleted_at: now })
          .eq("id", id);
        if (error) throw error;
        base.current.delete(id);
      }

      setEntries(
        (currentEntries) =>
          currentEntries?.map((entry) => {
            const savedEntry = base.current.get(entry.id);
            return savedEntry?.source === "admin"
              ? {
                  ...entry,
                  source: "admin",
                  reviewedAt: savedEntry.reviewedAt ?? null,
                }
              : entry;
          }) ?? currentEntries,
      );
      if (latest.current === current) setState("saved");
    } catch {
      setState("error");
    }
  };

  const change = (next: SupplierEntry[]) => {
    setEntries(next);
    latest.current = next;
    setState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void save();
    }, 700);
  };

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        void save();
      }
    },
    // `save` lê somente refs atuais; o cleanup precisa ser registrado uma única vez.
    [],
  );

  const addCategory = async () => {
    const label = newCat.trim();
    if (!label) return;
    const { error } = await supabase.from("property_supplier_categories").insert({
      implementation_id: implementationId,
      key: slugCategory(label),
      label,
    });
    if (!error) {
      setNewCat("");
      setAddingCategory(false);
      await qc.invalidateQueries({ queryKey: key });
    }
  };

  const removeCategory = async (categoryKey: string) => {
    await supabase
      .from("property_supplier_categories")
      .delete()
      .eq("implementation_id", implementationId)
      .eq("key", categoryKey);
    setSelectedCategoryKey(null);
    await qc.invalidateQueries({ queryKey: key });
  };

  if (q.isLoading || (q.data && entries === null)) {
    return <p className="text-sm text-muted-foreground">Carregando fornecedores…</p>;
  }
  if (q.error || !q.data) {
    return <p className="text-sm text-destructive">Não foi possível carregar os fornecedores.</p>;
  }

  const currentEntries = entries ?? [];
  const categories = mergeCategories(q.data.categories);
  const selectedCategory =
    categories.find((category) => category.key === selectedCategoryKey) ?? null;
  const pending = currentEntries.filter(isPendingOther).length;
  const fromOwner = currentEntries.filter((entry) => entry.source === "owner").length;

  const saveState = (
    <span className="text-xs text-muted-foreground" aria-live="polite">
      {state === "saving" ? (
        "Salvando…"
      ) : state === "saved" ? (
        "Salvo"
      ) : state === "error" ? (
        <button type="button" className="underline" onClick={() => void save()}>
          Não salvo — tentar novamente
        </button>
      ) : null}
    </span>
  );

  if (selectedCategory) {
    const removeCategoryProps = selectedCategory.custom
      ? { onRemoveCategory: (categoryKey: string) => void removeCategory(categoryKey) }
      : {};

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelectedCategoryKey(null)}
            className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-[var(--stayo-forest)]"
          >
            <ArrowLeft className="size-4" /> Fornecedores
          </button>
          {saveState}
        </div>

        <SupplierEditor
          mode="admin"
          categories={[selectedCategory]}
          catalog={q.data.catalog}
          entries={currentEntries}
          onChange={change}
          {...removeCategoryProps}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Fornecedores</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Abra uma categoria somente quando precisar consultar ou editar os detalhes.
          </p>
        </div>
        {saveState}
      </div>

      {(pending > 0 || fromOwner > 0) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {pending > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-900">
              {pending} {pending === 1 ? "empresa a confirmar" : "empresas a confirmar"}
            </span>
          )}
          {fromOwner > 0 && (
            <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
              {fromOwner}{" "}
              {fromOwner === 1 ? "resposta do proprietário" : "respostas do proprietário"}
            </span>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-background">
        {categories.map((category, index) => {
          const categoryEntries = currentEntries.filter(
            (entry) => entry.categoryKey === category.key,
          );
          const summary = summarizeSupplierCategory(categoryEntries, q.data.catalog);

          return (
            <button
              key={category.key}
              type="button"
              onClick={() => setSelectedCategoryKey(category.key)}
              className={`flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] ${
                index > 0 ? "border-t border-border" : ""
              }`}
              data-supplier-category={category.key}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{category.label}</p>
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  {summary.primary && (
                    <span className="max-w-full truncate text-foreground">{summary.primary}</span>
                  )}
                  {summary.secondary && (
                    <span className="text-muted-foreground">{summary.secondary}</span>
                  )}
                  <span
                    className={
                      summary.state === "defined"
                        ? "font-medium text-emerald-700"
                        : summary.state === "not_applicable"
                          ? "text-muted-foreground"
                          : summary.state === "to_confirm"
                            ? "font-medium text-amber-700"
                            : "text-muted-foreground"
                    }
                  >
                    {summary.state === "defined" ? "✓ " : ""}
                    {summary.stateLabel.toLowerCase()}
                  </span>
                </div>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          );
        })}
      </div>

      {addingCategory ? (
        <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
          <label
            className="block text-xs font-medium text-muted-foreground"
            htmlFor="new-supplier-category"
          >
            Nome da categoria
          </label>
          <input
            id="new-supplier-category"
            autoFocus
            placeholder="Ex.: Portão eletrônico"
            className="min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
            value={newCat}
            onChange={(event) => setNewCat(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void addCategory();
              if (event.key === "Escape") {
                setAddingCategory(false);
                setNewCat("");
              }
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => void addCategory()}
              disabled={!newCat.trim()}
            >
              Adicionar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setAddingCategory(false);
                setNewCat("");
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => setAddingCategory(true)}
        >
          <Plus className="mr-1 size-4" /> Adicionar categoria
        </Button>
      )}

      <div className="border-t border-border pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowCatalog((shown) => !shown)}
        >
          {showCatalog ? "Fechar catálogo de empresas" : "Catálogo de empresas"}
        </Button>
      </div>

      {showCatalog && (
        <CatalogManager
          catalog={q.data.catalog}
          onChanged={() => qc.invalidateQueries({ queryKey: key })}
        />
      )}
    </div>
  );
}

function CatalogManager({
  catalog,
  onChanged,
}: {
  catalog: SupplierCatalogItem[];
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [specs, setSpecs] = useState<string[]>([]);
  const [msg, setMsg] = useState("");

  const setStatus = async (id: string, status: string) => {
    await supabase.from("supplier_catalog").update({ status }).eq("id", id);
    onChanged();
  };

  const add = async () => {
    const normalizedName = name.trim();
    if (!normalizedName) return;
    if (
      catalog.some((company) => company.name.trim().toLowerCase() === normalizedName.toLowerCase())
    ) {
      setMsg("Essa empresa já está no catálogo.");
      return;
    }
    const { error } = await supabase
      .from("supplier_catalog")
      .insert({ name: normalizedName, specialties: specs, status: "approved" });
    setMsg(error ? "Não foi possível adicionar." : "");
    if (!error) {
      setName("");
      setSpecs([]);
      onChanged();
    }
  };

  const label = {
    suggested: "Sugestão — revisar",
    approved: "Disponível",
    archived: "Arquivada",
  } as const;

  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      <p className="text-xs text-muted-foreground">
        Só empresas "Disponível" aparecem para o proprietário. O catálogo é apenas uma lista de
        sugestões, sem recomendação ou parceria.
      </p>
      <ul className="divide-y divide-border">
        {catalog.map((company) => (
          <li
            key={company.id}
            className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
          >
            <div>
              <p className="font-medium">{company.name}</p>
              <p className="text-xs text-muted-foreground">
                {company.specialties
                  .map((specialty) => SPECIALTY_LABELS[specialty] ?? specialty)
                  .join(" · ") || "Sem especialidade"}{" "}
                · {label[company.status ?? "approved"]}
              </p>
            </div>
            <div className="flex gap-1">
              {company.status !== "approved" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void setStatus(company.id, "approved")}
                >
                  Disponibilizar
                </Button>
              )}
              {company.status !== "archived" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void setStatus(company.id, "archived")}
                >
                  Arquivar
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="space-y-2">
        <input
          aria-label="Nome da nova empresa"
          placeholder="Nome da empresa"
          className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {DEFAULT_SUPPLIER_CATEGORIES.map((category) => (
            <label key={category.key} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={specs.includes(category.key)}
                onChange={(event) =>
                  setSpecs((current) =>
                    event.target.checked
                      ? [...current, category.key]
                      : current.filter((specialty) => specialty !== category.key),
                  )
                }
              />
              {category.label}
            </label>
          ))}
        </div>
        <Button type="button" size="sm" onClick={() => void add()} disabled={!name.trim()}>
          Adicionar empresa
        </Button>
        {msg && <p className="text-xs text-destructive">{msg}</p>}
      </div>
    </div>
  );
}
