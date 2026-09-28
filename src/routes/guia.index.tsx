import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import {
  EmptyRows,
  ErrorRows,
  ListSkeleton,
  PageHeader,
  Panel,
  SearchInput,
} from "../components/data/ListStates";
import { PropertyVisual } from "../components/admin/PhaseOnePatterns";
import { Drawer } from "../components/patterns/Drawer";
import { coreApi, guideEntriesListQuery } from "../lib/api/queries";
import type { GuideEntry } from "../types/core";

export const Route = createFileRoute("/guia/")({
  head: () => ({
    meta: [
      { title: "Guia do hóspede — Stayo Admin" },
      { name: "description", content: "Administração do conteúdo editorial do Guia do hóspede." },
      { property: "og:title", content: "Guia do hóspede — Stayo Admin" },
      {
        property: "og:description",
        content: "Administração do conteúdo editorial do Guia do hóspede.",
      },
    ],
  }),
  component: GuidePage,
});

const surface = { backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" };

function GuidePage() {
  const [q, setQ] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const query = useQuery(guideEntriesListQuery());

  const rows = useMemo(() => {
    const data = query.data?.data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return data;
    return data.filter(
      (g) =>
        g.title.toLowerCase().includes(term) ||
        (g.category ?? "").toLowerCase().includes(term) ||
        (g.propertyName ?? "").toLowerCase().includes(term),
    );
  }, [query.data, q]);

  return (
    <>
      <PageHeader title="Guia do hóspede" count={query.isSuccess ? rows.length : undefined}>
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Buscar por título, categoria ou imóvel"
        />
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="rounded-[var(--radius-control)] px-3 py-2 text-sm"
          style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
        >
          Novo conteúdo
        </button>
      </PageHeader>
      <Panel>
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <ErrorRows onRetry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyRows
            message={
              q
                ? "Nenhum conteúdo encontrado para esta busca"
                : "Nenhum conteúdo de guia cadastrado ainda"
            }
          />
        ) : (
          <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((g) => (
              <Link key={g.id} to="/guia/$id" params={{ id: g.id }} className="overflow-hidden rounded-xl border border-[var(--stayo-border)] bg-[var(--stayo-surface)] transition hover:-translate-y-0.5">
                <PropertyVisual label={g.propertyName ?? "Guia geral"} />
                <div className="space-y-1 p-3">
                  <b className="block truncate text-sm">{g.title}</b>
                  <small className="block truncate text-[var(--admin-muted)]">{g.category ?? "Sem categoria"}</small>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] ${/public/i.test(g.status) ? "bg-[var(--stayo-forest-soft)] text-[var(--stayo-forest)]" : "bg-[var(--stayo-gold-soft)]"}`}>{/public/i.test(g.status) ? "Publicado" : "Rascunho"}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Panel>

      <NewGuideEntryDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

const emptyForm = { title: "", category: "", status: "rascunho", language: "pt-BR", summary: "" };

function NewGuideEntryDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);

  const create = useMutation({
    mutationFn: (): Promise<GuideEntry> =>
      coreApi.guide.create({
        title: form.title,
        category: form.category || null,
        propertyId: null,
        propertyName: null,
        scope: "global",
        status: form.status,
        language: form.language || null,
        order: null,
        summary: form.summary || null,
      }),
    onSuccess: async () => {
      setForm(emptyForm);
      onClose();
      await queryClient.invalidateQueries({ queryKey: ["guide"] });
    },
  });

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <Drawer
      open={open}
      onClose={() => {
        setForm(emptyForm);
        onClose();
      }}
      eyebrow="Guia do hóspede"
      title="Novo conteúdo"
      footer={
        <button
          type="button"
          onClick={() => create.mutate()}
          disabled={create.isPending || form.title.trim() === ""}
          className="w-full rounded-[var(--radius-control)] px-3 py-2 text-sm disabled:opacity-60"
          style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
        >
          {create.isPending ? "Salvando..." : "Salvar"}
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <TextField label="Título" value={form.title} onChange={set("title")} />
        <TextField label="Categoria" value={form.category} onChange={set("category")} />
        <label className="block text-sm">
          <span className="mb-1 block text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
            Status
          </span>
          <select
            value={form.status}
            onChange={(e) => set("status")(e.target.value)}
            className="w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
            style={{ ...surface, color: "var(--stayo-ink)" }}
          >
            <option value="rascunho">Rascunho</option>
            <option value="publicado">Publicado</option>
          </select>
        </label>
        <TextField label="Idioma" value={form.language} onChange={set("language")} />
        <label className="block text-sm">
          <span className="mb-1 block text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
            Resumo
          </span>
          <textarea
            value={form.summary}
            onChange={(e) => set("summary")(e.target.value)}
            rows={4}
            className="w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
            style={{ ...surface, color: "var(--stayo-ink)" }}
          />
        </label>
        {create.isError && (
          <span className="text-sm" style={{ color: "var(--stayo-danger)" }} role="alert">
            Não foi possível salvar.
          </span>
        )}
      </div>
    </Drawer>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[var(--radius-control)] border px-3 py-2 text-sm outline-none"
        style={{ ...surface, color: "var(--stayo-ink)" }}
      />
    </label>
  );
}
