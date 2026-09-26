import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SupplierEditor } from "./SupplierEditor";
import { mergeCategories, type SupplierCategory, type SupplierCatalogItem, type SupplierEntry } from "@/lib/property-suppliers";

interface Payload {
  categories: SupplierCategory[];
  catalog: SupplierCatalogItem[];
  entries: SupplierEntry[];
}

async function resolve(token: string): Promise<Payload | null> {
  const { data, error } = await supabase.rpc("owner_suppliers_resolve", { p_token: token });
  if (error) throw error;
  return (data as unknown as Payload) ?? null;
}

/** Seção "Fornecedores e instalações" no cadastro do proprietário (autosave pelo link). */
export function OwnerSuppliersSection({ token }: { token: string }) {
  const q = useQuery({ queryKey: ["owner-suppliers", token], queryFn: () => resolve(token) });
  const [entries, setEntries] = useState<SupplierEntry[] | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const latest = useRef<SupplierEntry[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (q.data && entries === null) setEntries(q.data.entries);
  }, [q.data, entries]);

  const save = async () => {
    const snapshot = latest.current;
    if (!snapshot) return;
    setState("saving");
    const payload = snapshot.filter((e) => !e.locked);
    const { error } = await supabase.rpc("owner_suppliers_save", {
      p_token: token,
      p_entries: payload as never,
    });
    if (latest.current === snapshot) setState(error ? "error" : "saved");
  };

  useEffect(() => {
    const flush = () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        void save();
      }
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  if (q.isLoading || (q.data && entries === null)) return <p className="text-sm text-muted-foreground">Carregando fornecedores…</p>;
  if (!q.data) return null;

  return (
    <section className="space-y-3" aria-labelledby="owner-suppliers-title">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 id="owner-suppliers-title" className="text-base font-semibold text-foreground">
            Fornecedores e instalações
          </h3>
          <p className="text-sm text-muted-foreground">
            Opcional. Conte quem forneceu ou instalou os principais itens do imóvel. Preencha o que souber e volte depois.
          </p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground" aria-live="polite">
          {state === "saving" ? "Salvando…" : state === "saved" ? "Salvo" : state === "error" ? (
            <button type="button" className="underline" onClick={() => void save()}>Não salvo — tentar novamente</button>
          ) : null}
        </span>
      </div>
      <SupplierEditor
        mode="owner"
        categories={mergeCategories(q.data.categories)}
        catalog={q.data.catalog}
        entries={entries ?? []}
        canEdit={(e) => !e.locked}
        onChange={change}
      />
    </section>
  );
}
