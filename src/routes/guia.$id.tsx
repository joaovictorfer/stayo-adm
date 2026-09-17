import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  DetailSkeleton,
  ErrorRows,
  Field,
  NotFoundPanel,
  PageHeader,
} from "../components/data/ListStates";
import { Drawer } from "../components/patterns/Drawer";
import { coreApi, guideEntryQuery } from "../lib/api/queries";
import type { GuideEntry } from "../types/core";

export const Route = createFileRoute("/guia/$id")({
  head: () => ({
    meta: [
      { title: "Conteúdo do guia — Stayo Admin" },
      { name: "description", content: "Detalhe de um conteúdo editorial do Guia do hóspede." },
      { property: "og:title", content: "Conteúdo do guia — Stayo Admin" },
      {
        property: "og:description",
        content: "Detalhe de um conteúdo editorial do Guia do hóspede.",
      },
    ],
  }),
  component: GuideEntryDetailPage,
});

const surface = { backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" };

function GuideEntryDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery(guideEntryQuery(id));
  const entry = query.data;
  const [editOpen, setEditOpen] = useState(false);

  const remove = useMutation({
    mutationFn: () => coreApi.guide.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["guide"] });
      void navigate({ to: "/guia" });
    },
  });

  return (
    <>
      <PageHeader title={entry?.title ?? "Conteúdo do guia"}>
        <Link to="/guia" className="text-sm underline" style={{ color: "var(--stayo-ink-muted)" }}>
          Voltar para o guia
        </Link>
      </PageHeader>

      {query.isPending ? (
        <DetailSkeleton />
      ) : query.isError ? (
        <ErrorRows onRetry={() => void query.refetch()} />
      ) : !entry ? (
        <NotFoundPanel message="Conteúdo não encontrado" />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="ID" value={entry.id} />
            <Field label="Título" value={entry.title} />
            <Field label="Categoria" value={entry.category} />
            <Field label="Escopo" value={entry.scope} />
            <Field label="Imóvel" value={entry.propertyName ?? entry.propertyId} />
            <Field label="Status" value={entry.status} />
            <Field label="Idioma" value={entry.language} />
            <Field label="Ordem" value={entry.order} />
            <Field label="Resumo" value={entry.summary} />
            <Field label="Criado em" value={entry.createdAt} />
            <Field label="Atualizado em" value={entry.updatedAt} />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="rounded-[var(--radius-control)] border px-3 py-2 text-sm"
              style={{ ...surface, color: "var(--stayo-forest)" }}
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Excluir este conteúdo do guia?")) remove.mutate();
              }}
              disabled={remove.isPending}
              className="rounded-[var(--radius-control)] border px-3 py-2 text-sm disabled:opacity-60"
              style={{ ...surface, color: "var(--stayo-danger)" }}
            >
              {remove.isPending ? "Excluindo..." : "Excluir"}
            </button>
          </div>

          <EditGuideEntryDrawer open={editOpen} entry={entry} onClose={() => setEditOpen(false)} />
        </div>
      )}
    </>
  );
}

function EditGuideEntryDrawer({
  open,
  entry,
  onClose,
}: {
  open: boolean;
  entry: GuideEntry;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: entry.title,
    category: entry.category ?? "",
    status: entry.status,
    language: entry.language ?? "",
    summary: entry.summary ?? "",
  });

  useEffect(() => {
    setForm({
      title: entry.title,
      category: entry.category ?? "",
      status: entry.status,
      language: entry.language ?? "",
      summary: entry.summary ?? "",
    });
  }, [entry]);

  const update = useMutation({
    mutationFn: () =>
      coreApi.guide.update(entry.id, {
        title: form.title,
        category: form.category || null,
        propertyId: entry.propertyId,
        propertyName: entry.propertyName,
        scope: entry.scope,
        status: form.status,
        language: form.language || null,
        order: entry.order,
        summary: form.summary || null,
      }),
    onSuccess: async () => {
      onClose();
      await queryClient.invalidateQueries({ queryKey: ["guide"] });
    },
  });

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      eyebrow="Guia do hóspede"
      title="Editar conteúdo"
      footer={
        <button
          type="button"
          onClick={() => update.mutate()}
          disabled={update.isPending || form.title.trim() === ""}
          className="w-full rounded-[var(--radius-control)] px-3 py-2 text-sm disabled:opacity-60"
          style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
        >
          {update.isPending ? "Salvando..." : "Salvar"}
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
        {update.isError && (
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
