import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { ErrorRows, PageHeader, Panel } from "../components/data/ListStates";
import { checklistTemplatesQuery } from "../lib/api/queries";
import { checklistTemplatesStore } from "../lib/api/local-store";
import type {
  ChecklistTemplateItem,
  ChecklistTemplateItemInput,
} from "../types/checklist-template";

export const Route = createFileRoute("/implantacao/templates")({
  head: () => ({
    meta: [
      { title: "Templates de checklist — Stayo Admin" },
      {
        name: "description",
        content: "Categorias, fases e itens do checklist de implantação, editáveis pela equipe.",
      },
      { property: "og:title", content: "Templates de checklist — Stayo Admin" },
      {
        property: "og:description",
        content: "Categorias, fases e itens do checklist de implantação, editáveis pela equipe.",
      },
    ],
  }),
  component: ImplementationTemplatesPage,
});

const surface = {
  backgroundColor: "var(--stayo-surface)",
  borderColor: "var(--stayo-border)",
};

const emptyForm: ChecklistTemplateItemInput = {
  category: "",
  phase: "",
  title: "",
  description: null,
  mandatory: false,
  blocker: false,
  ownerVisible: false,
  order: 1,
};

function ImplementationTemplatesPage() {
  const queryClient = useQueryClient();
  const query = useQuery(checklistTemplatesQuery());
  const [form, setForm] = useState<ChecklistTemplateItemInput>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });

  const save = useMutation({
    mutationFn: async (input: ChecklistTemplateItemInput) =>
      editingId
        ? checklistTemplatesStore.update(editingId, input)
        : checklistTemplatesStore.create(input),
    onSuccess: async () => {
      setForm(emptyForm);
      setEditingId(null);
      await invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => checklistTemplatesStore.remove(id),
    onSuccess: async () => {
      await invalidate();
    },
  });

  const items = query.data ?? [];

  const groups = useMemo(() => {
    const map = new Map<string, Map<string, ChecklistTemplateItem[]>>();
    for (const item of items) {
      const byPhase = map.get(item.category) ?? new Map<string, ChecklistTemplateItem[]>();
      byPhase.set(item.phase, [...(byPhase.get(item.phase) ?? []), item]);
      map.set(item.category, byPhase);
    }
    return map;
  }, [items]);

  const categories = [...new Set(items.map((i) => i.category))];
  const phases = [...new Set(items.map((i) => i.phase))];

  const startEdit = (item: ChecklistTemplateItem) => {
    setEditingId(item.id);
    setForm({
      category: item.category,
      phase: item.phase,
      title: item.title,
      description: item.description,
      mandatory: item.mandatory,
      blocker: item.blocker,
      ownerVisible: item.ownerVisible,
      order: item.order,
    });
  };

  const canSave =
    form.category.trim() !== "" && form.phase.trim() !== "" && form.title.trim() !== "";

  return (
    <>
      <PageHeader title="Templates de checklist" count={items.length} />

      <p className="mb-4 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        Categoria → fase → item. Tudo editável aqui: as exigências mudam com o tempo, então
        nada fica fixo no código.
      </p>

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr] lg:items-start">
        <form
          className="rounded-[var(--radius-card)] border p-4"
          style={surface}
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) save.mutate(form);
          }}
        >
          <h2
            className="text-sm"
            style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
          >
            {editingId ? "Editar item" : "Novo item"}
          </h2>

          <div className="mt-3 flex flex-col gap-3">
            <TextField
              label="Categoria"
              value={form.category}
              list="stayo-categories"
              onChange={(v) => setForm({ ...form, category: v })}
            />
            <datalist id="stayo-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>

            <TextField
              label="Fase"
              value={form.phase}
              list="stayo-phases"
              onChange={(v) => setForm({ ...form, phase: v })}
            />
            <datalist id="stayo-phases">
              {phases.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>

            <TextField
              label="Título do item"
              value={form.title}
              onChange={(v) => setForm({ ...form, title: v })}
            />

            <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
              Descrição
              <textarea
                rows={3}
                value={form.description ?? ""}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value === "" ? null : e.target.value })
                }
                className="rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
                style={{ ...surface, color: "var(--stayo-ink)" }}
              />
            </label>

            <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
              Ordem
              <input
                type="number"
                min={1}
                value={form.order}
                onChange={(e) => setForm({ ...form, order: Number(e.target.value) || 1 })}
                className="rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
                style={{ ...surface, color: "var(--stayo-ink)" }}
              />
            </label>

            <CheckField
              label="Obrigatório"
              checked={form.mandatory}
              onChange={(v) => setForm({ ...form, mandatory: v })}
            />
            <CheckField
              label="Bloqueador"
              checked={form.blocker}
              onChange={(v) => setForm({ ...form, blocker: v })}
            />
            <CheckField
              label="Visível ao proprietário"
              checked={form.ownerVisible}
              onChange={(v) => setForm({ ...form, ownerVisible: v })}
            />
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={!canSave || save.isPending}
              className="rounded-[var(--radius-control)] px-3 py-2 text-sm disabled:opacity-50"
              style={{ backgroundColor: "var(--stayo-forest)", color: "var(--stayo-surface)" }}
            >
              {editingId ? "Salvar alterações" : "Adicionar item"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
                className="rounded-[var(--radius-control)] border px-3 py-2 text-sm"
                style={{ ...surface, color: "var(--stayo-ink-muted)" }}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>

        <div className="flex flex-col gap-4">
          {query.isPending ? (
            <Panel>
              <div className="space-y-3 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-5 w-full animate-pulse rounded"
                    style={{ backgroundColor: "var(--stayo-border)" }}
                  />
                ))}
              </div>
            </Panel>
          ) : query.isError ? (
            <Panel>
              <ErrorRows onRetry={() => void query.refetch()} />
            </Panel>
          ) : items.length === 0 ? (
            <Panel>
              <div
                className="px-4 py-16 text-center text-sm"
                style={{ color: "var(--stayo-ink-muted)" }}
              >
                Nenhum template de checklist cadastrado ainda
              </div>
            </Panel>
          ) : (
            [...groups.entries()].map(([category, byPhase]) => (
              <div key={category} className="rounded-[var(--radius-card)] border" style={surface}>
                <h2
                  className="border-b px-4 py-3 text-sm"
                  style={{
                    borderColor: "var(--stayo-border)",
                    fontFamily: "var(--stayo-font-display)",
                    color: "var(--stayo-ink)",
                  }}
                >
                  {category}
                </h2>
                {[...byPhase.entries()].map(([phase, list]) => (
                  <div key={phase}>
                    <p
                      className="px-4 pt-3 text-xs uppercase tracking-wide"
                      style={{ color: "var(--stayo-ink-muted)" }}
                    >
                      {phase}
                    </p>
                    <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
                      {list.map((item) => (
                        <li key={item.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                          <span className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                            #{item.order}
                          </span>
                          <span className="text-sm" style={{ color: "var(--stayo-ink)" }}>
                            {item.title}
                          </span>
                          {item.mandatory && <Tag label="Obrigatório" />}
                          {item.blocker && <Tag label="Bloqueador" tone="danger" />}
                          {item.ownerVisible && (
                            <Tag label="Visível ao proprietário" tone="gold" />
                          )}
                          <span className="ml-auto flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(item)}
                              className="text-xs underline"
                              style={{ color: "var(--stayo-forest)" }}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => remove.mutate(item.id)}
                              className="text-xs underline"
                              style={{ color: "var(--stayo-danger)" }}
                            >
                              Excluir
                            </button>
                          </span>
                          {item.description && (
                            <p
                              className="w-full text-xs"
                              style={{ color: "var(--stayo-ink-muted)" }}
                            >
                              {item.description}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function TextField({
  label,
  value,
  onChange,
  list,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  list?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
      {label}
      <input
        value={value}
        list={list}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
        style={{ ...surface, color: "var(--stayo-ink)" }}
      />
    </label>
  );
}

function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm" style={{ color: "var(--stayo-ink)" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function Tag({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "danger" | "gold" }) {
  const tones = {
    neutral: { backgroundColor: "var(--stayo-forest-soft)", color: "var(--stayo-forest)" },
    danger: { backgroundColor: "var(--stayo-gold-soft)", color: "var(--stayo-danger)" },
    gold: { backgroundColor: "var(--stayo-gold-soft)", color: "var(--stayo-warning)" },
  } as const;
  return (
    <span className="rounded-full px-2 py-0.5 text-[11px]" style={tones[tone]}>
      {label}
    </span>
  );
}
