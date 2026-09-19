import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { PageHeader, Panel } from "../components/data/ListStates";
import { adminApi, portalContentQuery } from "../lib/api/queries";
import {
  hasUnpublishedChanges,
  portalBlockKindLabels,
  portalBlockKindOrder,
} from "../types/portal-content";
import type { PortalBlockKind, PortalContentBlock } from "../types/portal-content";

export const Route = createFileRoute("/configuracoes/portal")({
  head: () => ({
    meta: [
      { title: "Conteúdo do portal — Stayo Admin" },
      {
        name: "description",
        content: "Textos institucionais do portal do proprietário, com rascunho e publicação.",
      },
      { property: "og:title", content: "Conteúdo do portal — Stayo Admin" },
      {
        property: "og:description",
        content: "Textos institucionais do portal do proprietário, com rascunho e publicação.",
      },
    ],
  }),
  component: PortalContentPage,
});

const surface = { backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" };

const inputStyle = {
  backgroundColor: "var(--stayo-surface)",
  borderColor: "var(--stayo-border)",
  color: "var(--stayo-ink)",
};

const inputClass =
  "w-full rounded-[var(--radius-control)] border px-2 py-2 text-sm outline-none";

function PortalContentPage() {
  const queryClient = useQueryClient();
  const blocksQ = useQuery(portalContentQuery());
  const [kind, setKind] = useState<PortalBlockKind>("destaque");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: portalContentQuery().queryKey });

  const addBlock = useMutation({
    mutationFn: () =>
      adminApi.portalContent.add({
        kind,
        draftTitle: title.trim(),
        draftBody: body.trim(),
        displayOrder: (blocksQ.data?.length ?? 0) + 1,
      }),
    onSuccess: async () => {
      setTitle("");
      setBody("");
      await invalidate();
    },
  });

  const blocks = blocksQ.data ?? [];
  const pending = blocks.filter(hasUnpublishedChanges).length;

  return (
    <>
      <PageHeader title="Conteúdo do portal do proprietário" />

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-4">
          <Panel title="Blocos">
            {blocksQ.isPending ? (
              <p className="p-4 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                Carregando...
              </p>
            ) : blocksQ.isError ? (
              <p className="p-4 text-sm" style={{ color: "var(--stayo-danger)" }}>
                Não foi possível carregar o conteúdo do portal.
              </p>
            ) : blocks.length === 0 ? (
              <p className="p-4 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                Nenhum bloco criado. O portal do proprietário mostra os textos publicados aqui.
              </p>
            ) : (
              <div className="flex flex-col divide-y" style={{ borderColor: "var(--stayo-border)" }}>
                {blocks.map((block) => (
                  <BlockEditor key={block.id} block={block} onChanged={invalidate} />
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel title="Novo bloco">
            <div className="flex flex-col gap-3 p-4">
              <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                Tipo
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as PortalBlockKind)}
                  className={inputClass}
                  style={inputStyle}
                >
                  {portalBlockKindOrder.map((k) => (
                    <option key={k} value={k}>
                      {portalBlockKindLabels[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                Título
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inputClass}
                  style={inputStyle}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                Texto
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  className={inputClass}
                  style={inputStyle}
                />
              </label>
              <button
                type="button"
                disabled={!title.trim() || addBlock.isPending}
                onClick={() => addBlock.mutate()}
                className="rounded-[var(--radius-control)] px-3 py-2 text-sm disabled:opacity-50"
                style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
              >
                Adicionar bloco
              </button>
              <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                O bloco nasce como rascunho. Só aparece no portal depois de publicado.
              </p>
            </div>
          </Panel>

          <Panel title="Visualizar">
            <div className="flex flex-col gap-2 p-4">
              <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                {pending === 0
                  ? "Nenhuma alteração pendente de publicação."
                  : `${pending} bloco(s) com alterações não publicadas.`}
              </p>
              <a
                href="/portal?preview=rascunho"
                target="_blank"
                rel="noreferrer"
                className="rounded-[var(--radius-control)] border px-3 py-2 text-center text-sm"
                style={surface}
              >
                Visualizar como proprietário (rascunho)
              </a>
              <a
                href="/portal"
                target="_blank"
                rel="noreferrer"
                className="rounded-[var(--radius-control)] border px-3 py-2 text-center text-sm"
                style={surface}
              >
                Ver portal publicado
              </a>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

function BlockEditor({
  block,
  onChanged,
}: {
  block: PortalContentBlock;
  onChanged: () => Promise<void>;
}) {
  const [title, setTitle] = useState(block.draftTitle);
  const [body, setBody] = useState(block.draftBody);
  const dirty = title !== block.draftTitle || body !== block.draftBody;

  const save = useMutation({
    mutationFn: () =>
      adminApi.portalContent.update(block.id, { draftTitle: title, draftBody: body }),
    onSuccess: onChanged,
  });
  const publish = useMutation({
    mutationFn: () => adminApi.portalContent.publish(block.id),
    onSuccess: onChanged,
  });
  const unpublish = useMutation({
    mutationFn: () => adminApi.portalContent.unpublish(block.id),
    onSuccess: onChanged,
  });
  const remove = useMutation({
    mutationFn: () => adminApi.portalContent.remove(block.id),
    onSuccess: onChanged,
  });

  const unpublished = hasUnpublishedChanges(block) || dirty;

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="rounded-full px-2 py-0.5 text-xs"
          style={{ backgroundColor: "var(--stayo-forest-soft)", color: "var(--stayo-forest)" }}
        >
          {portalBlockKindLabels[block.kind]}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-xs"
          style={
            block.publishedAt
              ? { backgroundColor: "var(--stayo-forest-soft)", color: "var(--stayo-success)" }
              : { backgroundColor: "var(--stayo-gold-soft)", color: "var(--stayo-warning)" }
          }
        >
          {block.publishedAt ? "Publicado" : "Rascunho"}
        </span>
        {unpublished && block.publishedAt ? (
          <span className="text-xs" style={{ color: "var(--stayo-warning)" }}>
            alterações não publicadas
          </span>
        ) : null}
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className={inputClass}
        style={inputStyle}
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        className={inputClass}
        style={inputStyle}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate()}
          className="rounded-[var(--radius-control)] border px-3 py-1.5 text-xs disabled:opacity-50"
          style={surface}
        >
          Salvar rascunho
        </button>
        <button
          type="button"
          disabled={publish.isPending || dirty}
          onClick={() => publish.mutate()}
          title={dirty ? "Salve o rascunho antes de publicar" : undefined}
          className="rounded-[var(--radius-control)] px-3 py-1.5 text-xs disabled:opacity-50"
          style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
        >
          Publicar
        </button>
        {block.publishedAt ? (
          <button
            type="button"
            disabled={unpublish.isPending}
            onClick={() => unpublish.mutate()}
            className="rounded-[var(--radius-control)] border px-3 py-1.5 text-xs disabled:opacity-50"
            style={surface}
          >
            Despublicar
          </button>
        ) : null}
        <button
          type="button"
          disabled={remove.isPending}
          onClick={() => remove.mutate()}
          className="rounded-[var(--radius-control)] border px-3 py-1.5 text-xs disabled:opacity-50"
          style={{ ...surface, color: "var(--stayo-danger)" }}
        >
          Excluir
        </button>
      </div>
    </div>
  );
}
