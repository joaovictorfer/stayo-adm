import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SupplierCategoryDetail } from "./SupplierEditor";
import {
  DEFAULT_SUPPLIER_CATEGORIES,
  SPECIALTY_LABELS,
  isPendingOther,
  mergeCategories,
  slugCategory,
  summarizeSupplierCategory,
  type SupplierCatalogItem,
  type SupplierCategory,
  type SupplierEntry,
} from "@/lib/property-suppliers";

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

const fromRow = (r: Row): SupplierEntry => ({
  id: r.id,
  categoryKey: r.category_key,
  answer: r.answer,
  catalogId: r.catalog_id,
  otherName: r.other_name,
  role: r.role,
  phone: r.phone,
  service: r.service,
  approxDate: r.approx_date,
  notes: r.notes,
  adminNotes: r.admin_notes,
  source: r.source,
  reviewedAt: r.reviewed_at,
});

const comparable = (e: SupplierEntry) =>
  JSON.stringify([e.categoryKey, e.answer, e.catalogId, e.otherName, e.role, e.phone, e.service, e.approxDate, e.notes, e.adminNotes ?? null]);

async function load(implementationId: string) {
  const [entries, cats, catalog] = await Promise.all([
    supabase.from("property_supplier_entries").select("*").eq("implementation_id", implementationId).is("deleted_at", null).order("created_at"),
    supabase.from("property_supplier_categories").select("key,label").eq("implementation_id", implementationId).order("created_at"),
    supabase.from("supplier_catalog").select("id,name,specialties,status").order("name"),
  ]);
  if (entries.error) throw entries.error;
  if (cats.error) throw cats.error;
  if (catalog.error) throw catalog.error;
  return {
    entries: (entries.data as Row[]).map(fromRow),
    categories: cats.data as SupplierCategory[],
    catalog: catalog.data as SupplierCatalogItem[],
  };
}

/** Ficha administrativa: revisar, corrigir e completar fornecedores do imóvel. */
export function PropertySuppliersPanel({ implementationId }: { implementationId: string }) {
  const qc = useQueryClient();
  const key = ["property-suppliers", implementationId];
  const q = useQuery({ queryKey: key, queryFn: () => load(implementationId) });
  const [entries, setEntries] = useState<SupplierEntry[] | null>(null);
  const base = useRef<Map<string, SupplierEntry>>(new Map());
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<SupplierEntry[]>([]);
  const [newCat, setNewCat] = useState("");
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);

  useEffect(() => {
    if (q.data && entries === null) {
      setEntries(q.data.entries);
      latest.current = q.data.entries;
      base.current = new Map(q.data.entries.map((e) => [e.id, e]));
    }
  }, [q.data, entries]);

  const save = async () => {
    const current = latest.current;
    setState("saving");
    const { data: u } = await supabase.auth.getUser();
    const now = new Date().toISOString();
    const ids = new Set(current.map((e) => e.id));
    try {
      for (const e of current) {
        const prev = base.current.get(e.id);
        if (prev && comparable(prev) === comparable(e)) continue;
        // Qualquer correção da STAYO vira resposta revisada; a versão do proprietário fica no histórico.
        const row = {
          id: e.id,
          implementation_id: implementationId,
          category_key: e.categoryKey,
          answer: e.answer,
          catalog_id: e.answer === "catalog" ? e.catalogId : null,
          other_name: e.answer === "other" ? e.otherName?.trim() || null : null,
          role: e.role,
          phone: e.phone,
          service: e.service,
          approx_date: e.approxDate,
          notes: e.notes,
          admin_notes: e.adminNotes ?? null,
          source: "admin" as const,
          reviewed_by: u.user?.id ?? null,
          reviewed_at: now,
        };
        const { error } = await supabase.from("property_supplier_entries").upsert(row);
        if (error) throw error;
        base.current.set(e.id, { ...e, source: "admin", reviewedAt: now });
      }
      for (const id of [...base.current.keys()]) {
        if (ids.has(id)) continue;
        const { error } = await supabase.from("property_supplier_entries").update({ deleted_at: now }).eq("id", id);
        if (error) throw error;
        base.current.delete(id);
      }
      setEntries((cur) => cur?.map((e) => (base.current.get(e.id)?.source === "admin" ? { ...e, source: "admin" } : e)) ?? cur);
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

  useEffect(() => () => {
    if (timer.current) {
      clearTimeout(timer.current);
      void save();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addCategory = async () => {
    const label = newCat.trim();
    if (!label) return;
    const { error } = await supabase.from("property_supplier_categories").insert({ implementation_id: implementationId, key: slugCategory(label), label });
    if (!error) {
      setNewCat("");
      await qc.invalidateQueries({ queryKey: key });
    }
  };
  const removeCategory = async (k: string) => {
    await supabase.from("property_supplier_categories").delete().eq("implementation_id", implementationId).eq("key", k);
    await qc.invalidateQueries({ queryKey: key });
  };

  if (q.isLoading || (q.data && entries === null)) return <p className="text-sm text-muted-foreground">Carregando fornecedores…</p>;
  if (q.error || !q.data) return <p className="text-sm text-destructive">Não foi possível carregar os fornecedores.</p>;

  const pending = (entries ?? []).filter(isPendingOther).length;
  const fromOwner = (entries ?? []).filter((e) => e.source === "owner").length;
  const categories = mergeCategories(q.data.categories);
  const selectedCategory = categories.find((category) => category.key === selectedCategoryKey) ?? null;

  if (selectedCategory) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between">
          <Button type="button" variant="ghost" className="min-w-0 justify-start px-2" onClick={() => setSelectedCategoryKey(null)}>
            <ArrowLeft className="shrink-0" />
            <span className="truncate">Voltar para fornecedores</span>
          </Button>
          <span className="shrink-0 text-xs text-muted-foreground" aria-live="polite">
            {state === "saving" ? "Salvando…" : state === "saved" ? "Salvo" : state === "error" ? (
              <button type="button" className="underline" onClick={() => void save()}>Tentar novamente</button>
            ) : null}
          </span>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">Fornecedor ou instalação</p>
          <h3 className="text-lg font-semibold text-foreground">{selectedCategory.label}</h3>
        </div>
        <SupplierCategoryDetail
          mode="admin"
          category={selectedCategory}
          catalog={q.data.catalog}
          entries={entries ?? []}
          onChange={change}
          onRemoveCategory={async (categoryKey) => {
            await removeCategory(categoryKey);
            setSelectedCategoryKey(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:flex sm:flex-wrap sm:justify-between">
        <div className="flex flex-wrap gap-2 text-xs">
          {pending > 0 && (
            <span className="rounded bg-muted px-2 py-1 font-medium text-foreground">
              {pending} {pending === 1 ? "empresa com nome pendente" : "empresas com nome pendente"}
            </span>
          )}
          {fromOwner > 0 && (
            <span className="rounded bg-muted px-2 py-1">{fromOwner} informadas pelo proprietário — revisar</span>
          )}
        </div>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {state === "saving" ? "Salvando…" : state === "saved" ? "Salvo" : state === "error" ? (
            <button type="button" className="underline" onClick={() => void save()}>Não salvo — tentar novamente</button>
          ) : null}
        </span>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-background">
        {categories.map((category) => {
          const summary = summarizeSupplierCategory(
            (entries ?? []).filter((entry) => entry.categoryKey === category.key),
            q.data.catalog,
          );
          return (
            <li key={category.key}>
              <button
                type="button"
                className="grid min-h-16 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2"
                onClick={() => setSelectedCategoryKey(category.key)}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">{category.label}</span>
                  <span className="block truncate text-sm text-muted-foreground">{summary.description}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">{summary.stateLabel}</span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="space-y-3">
        {!showNewCategory ? (
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setShowNewCategory(true)}>
            <Plus /> Adicionar categoria
          </Button>
        ) : (
          <div className="rounded-lg border border-border p-3">
            <label className="mb-2 block text-sm font-medium text-foreground" htmlFor="new-supplier-category">Nome da categoria</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="new-supplier-category"
                placeholder="Ex.: Portão eletrônico"
                className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                autoFocus
              />
              <Button type="button" onClick={() => void addCategory().then(() => setShowNewCategory(false))} disabled={!newCat.trim()}>
                Adicionar
              </Button>
              <Button type="button" variant="ghost" onClick={() => { setNewCat(""); setShowNewCategory(false); }}>Cancelar</Button>
            </div>
          </div>
        )}
        <Button type="button" variant="ghost" onClick={() => setShowCatalog((s) => !s)}>
          {showCatalog ? "Fechar catálogo" : "Catálogo de empresas"}
        </Button>
      </div>
      {showCatalog && <CatalogManager catalog={q.data.catalog} onChanged={() => qc.invalidateQueries({ queryKey: key })} />}
    </div>
  );
}

function CatalogManager({ catalog, onChanged }: { catalog: SupplierCatalogItem[]; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [specs, setSpecs] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const setStatus = async (id: string, status: string) => {
    await supabase.from("supplier_catalog").update({ status }).eq("id", id);
    onChanged();
  };
  const add = async () => {
    const n = name.trim();
    if (!n) return;
    if (catalog.some((c) => c.name.trim().toLowerCase() === n.toLowerCase())) {
      setMsg("Essa empresa já está no catálogo.");
      return;
    }
    const { error } = await supabase.from("supplier_catalog").insert({ name: n, specialties: specs, status: "approved" });
    setMsg(error ? "Não foi possível adicionar." : "");
    if (!error) {
      setName("");
      setSpecs([]);
      onChanged();
    }
  };
  const label = { suggested: "Sugestão — revisar", approved: "Disponível", archived: "Arquivada" } as const;
  return (
    <div className="space-y-3 rounded-xl border border-border p-3">
      <p className="text-xs text-muted-foreground">
        Só empresas "Disponível" aparecem para o proprietário. O catálogo é apenas uma lista de sugestões, sem recomendação ou parceria.
      </p>
      <ul className="divide-y divide-border">
        {catalog.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <div>
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-muted-foreground">
                {c.specialties.map((s) => SPECIALTY_LABELS[s] ?? s).join(" · ") || "Sem especialidade"} · {label[c.status ?? "approved"]}
              </p>
            </div>
            <div className="flex gap-1">
              {c.status !== "approved" && <Button size="sm" variant="outline" onClick={() => void setStatus(c.id, "approved")}>Disponibilizar</Button>}
              {c.status !== "archived" && <Button size="sm" variant="ghost" onClick={() => void setStatus(c.id, "archived")}>Arquivar</Button>}
            </div>
          </li>
        ))}
      </ul>
      <div className="space-y-2">
        <input aria-label="Nome da nova empresa" placeholder="Nome da empresa" className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex flex-wrap gap-2">
          {DEFAULT_SUPPLIER_CATEGORIES.map((c) => (
            <label key={c.key} className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={specs.includes(c.key)} onChange={(e) => setSpecs((s) => (e.target.checked ? [...s, c.key] : s.filter((x) => x !== c.key)))} />
              {c.label}
            </label>
          ))}
        </div>
        <Button type="button" size="sm" onClick={() => void add()} disabled={!name.trim()}>Adicionar empresa</Button>
        {msg && <p className="text-xs text-destructive">{msg}</p>}
      </div>
    </div>
  );
}
