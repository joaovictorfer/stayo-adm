import { sortCategories } from "@/lib/guides";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, Loader2, Package, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "../components/ui/button";
import { GuideItemEditor, emptyItem } from "../components/implantacao/guide/GuideItemEditor";
import { listCatalog, saveCatalogItem, uploadGuideImage, type CatalogItem } from "../lib/api/guides";
import { classificationLabel, guideDefaultCategories, guideTitle, type GuideType } from "../lib/guides";

export const Route = createFileRoute("/configuracoes/guias")({
  head: () => ({
    meta: [
      { title: "Catálogo de guias — Stayo Admin" },
      { name: "description", content: "Recomendações reutilizáveis dos guias de utensílios e enxoval da STAYO." },
      { property: "og:title", content: "Catálogo de guias — Stayo Admin" },
      { property: "og:description", content: "Recomendações reutilizáveis dos guias de utensílios e enxoval da STAYO." },
    ],
  }),
  component: CatalogPage,
});

function CatalogPage() {
  const qc = useQueryClient();
  const [type, setType] = useState<GuideType>("utensilios");
  const q = useQuery({ queryKey: ["guide-catalog", type], queryFn: () => listCatalog(type) });
  const [editing, setEditing] = useState<CatalogItem | "new" | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const items = q.data ?? [];
  const categories = sortCategories([...new Set(items.map((i) => i.category))], guideDefaultCategories[type]);
  const active = category && categories.includes(category) ? category : categories[0];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      <Link to="/configuracoes" className="flex items-center gap-1 text-sm"><ArrowLeft className="size-4" /> Configurações</Link>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Catálogo de guias</h1>
          <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>{guideTitle[type]} · {items.length} recomendações. Alterações aqui não mudam guias já aplicados.</p>
        </div>
        <Button className="min-h-11" onClick={() => setEditing("new")}><Plus /> Item</Button>
      </div>
      <div className="flex gap-2" role="tablist" aria-label="Tipo de guia">
        {(["utensilios", "enxoval"] as GuideType[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={t === type} onClick={() => { setType(t); setCategory(null); }} className="min-h-11 rounded-[var(--radius-control)] border px-4 text-sm font-medium" style={t === type ? { backgroundColor: "var(--stayo-forest)", color: "var(--primary-foreground)", borderColor: "var(--stayo-forest)" } : { borderColor: "var(--stayo-border)" }}>
            {t === "utensilios" ? "Utensílios" : "Enxoval"}
          </button>
        ))}
      </div>
      {q.isPending ? (
        <Loader2 className="size-5 animate-spin" />
      ) : q.isError ? (
        <p role="alert">Não foi possível carregar. <button className="underline" type="button" onClick={() => void q.refetch()}>Tentar novamente</button></p>
      ) : items.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border p-5 text-sm" style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink-muted)" }}>
          Nenhuma recomendação cadastrada neste guia. Use “+ Item” para montar o catálogo.
        </p>
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
                    <span className="block truncate text-xs" style={{ color: "var(--stayo-ink-muted)" }}>{i.quantity_text || i.recommended_quantity}{i.size_text ? ` · ${i.size_text}` : ""} · {classificationLabel[i.classification]}</span>
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
          categories={[...new Set([...guideDefaultCategories[type], ...categories])]}
          eyebrow={guideTitle[type]}
          showSize={type === "enxoval"}
          imageUrl={null}
          initial={editing === "new" ? emptyItem(active ?? guideDefaultCategories[type][0]) : { ...editing, enabled: editing.active }}
          onUpload={(file) => uploadGuideImage("catalog", editing === "new" ? "novo" : editing.id, file)}
          onSave={async ({ enabled, ...v }) => {
            await saveCatalogItem(editing === "new" ? null : editing.id, { ...v, active: enabled }, type);
            toast.success("Catálogo atualizado");
            void qc.invalidateQueries({ queryKey: ["guide-catalog"] });
          }}
        />
      )}
    </div>
  );
}
