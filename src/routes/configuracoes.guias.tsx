import { sortCategories } from "@/lib/guides";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, Loader2, Package, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "../components/ui/button";
import { GuideItemEditor, emptyItem } from "../components/implantacao/guide/GuideItemEditor";
import { listCatalog, saveCatalogItem, uploadGuideImage, type CatalogItem } from "../lib/api/guides";
import { classificationLabel } from "../lib/guides";

export const Route = createFileRoute("/configuracoes/guias")({
  head: () => ({
    meta: [
      { title: "Catálogo de guias — Stayo Admin" },
      { name: "description", content: "Recomendações reutilizáveis do Guia de Utensílios da STAYO." },
      { property: "og:title", content: "Catálogo de guias — Stayo Admin" },
      { property: "og:description", content: "Recomendações reutilizáveis do Guia de Utensílios da STAYO." },
    ],
  }),
  component: CatalogPage,
});

function CatalogPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["guide-catalog"], queryFn: listCatalog });
  const [editing, setEditing] = useState<CatalogItem | "new" | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const items = q.data ?? [];
  const categories = sortCategories([...new Set(items.map((i) => i.category))]);
  const active = category ?? categories[0];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <Link to="/configuracoes" className="flex items-center gap-1 text-sm"><ArrowLeft className="size-4" /> Configurações</Link>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Catálogo de guias</h1>
          <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>Guia de utensílios · {items.length} recomendações. Alterações aqui não mudam guias já aplicados.</p>
        </div>
        <Button className="min-h-11" onClick={() => setEditing("new")}><Plus /> Item</Button>
      </div>
      {q.isPending ? (
        <Loader2 className="size-5 animate-spin" />
      ) : q.isError ? (
        <p role="alert">Não foi possível carregar. <button className="underline" type="button" onClick={() => void q.refetch()}>Tentar novamente</button></p>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto">
            {categories.map((c) => (
              <button key={c} type="button" onClick={() => setCategory(c)} className="min-h-10 shrink-0 rounded-full border px-4 text-sm" style={c === active ? { backgroundColor: "var(--stayo-forest)", color: "var(--primary-foreground)" } : { borderColor: "var(--stayo-border)" }}>
                {c}
              </button>
            ))}
          </div>
          <ul className="divide-y overflow-hidden rounded-[var(--radius-card)] border" style={{ borderColor: "var(--stayo-border)", backgroundColor: "var(--stayo-surface)" }}>
            {items.filter((i) => i.category === active).map((i) => (
              <li key={i.id}>
                <button type="button" onClick={() => setEditing(i)} className="flex w-full items-center gap-3 px-4 py-3 text-left" style={{ opacity: i.active ? 1 : 0.5 }}>
                  <Package className="size-5 shrink-0" style={{ color: "var(--stayo-ink-muted)" }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{i.name}</span>
                    <span className="block truncate text-xs" style={{ color: "var(--stayo-ink-muted)" }}>{i.quantity_text || i.recommended_quantity} · {classificationLabel[i.classification]}</span>
                  </span>
                  <ChevronRight className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {editing && (
        <GuideItemEditor
          open
          mode="catalog"
          isNew={editing === "new"}
          onClose={() => setEditing(null)}
          categories={[...new Set(["Cozinha", "Quartos", "Banheiros", ...categories])]}
          imageUrl={null}
          initial={editing === "new" ? emptyItem(active ?? "Cozinha") : { ...editing, enabled: editing.active }}
          onUpload={(file) => uploadGuideImage("catalog", editing === "new" ? "novo" : editing.id, file)}
          onSave={async ({ enabled, ...v }) => {
            await saveCatalogItem(editing === "new" ? null : editing.id, { ...v, active: enabled });
            toast.success("Catálogo atualizado");
            void qc.invalidateQueries({ queryKey: ["guide-catalog"] });
          }}
        />
      )}
    </div>
  );
}
