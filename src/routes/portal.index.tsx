import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useSearch } from "@tanstack/react-router";

import { portalContentQuery } from "../lib/api/queries";
import { blockView, type PortalContentBlock } from "../types/portal-content";

/**
 * Fase 6 — portal do proprietário como landing page (mobile-first).
 * Mostra apenas conteúdo institucional publicado; nenhum dado pessoal.
 * ?preview=rascunho renderiza o rascunho para revisão interna.
 */
export const Route = createFileRoute("/portal/")({
  validateSearch: (search: Record<string, unknown>) => ({
    preview: search["preview"] === "rascunho" ? ("rascunho" as const) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Portal do Proprietário — Stayo" },
      {
        name: "description",
        content:
          "Acompanhe a implantação do seu imóvel, confirme seus dados e fale com a Stayo em um só lugar.",
      },
      { property: "og:title", content: "Portal do Proprietário — Stayo" },
      {
        property: "og:description",
        content:
          "Acompanhe a implantação do seu imóvel, confirme seus dados e fale com a Stayo em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PortalLandingPage,
});

const surface = { backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" };

function PortalLandingPage() {
  const search = useSearch({ from: "/portal/" });
  const mode = search.preview === "rascunho" ? "draft" : "published";
  const blocksQ = useQuery(portalContentQuery());

  const all = blocksQ.data ?? [];
  const visible = all
    .filter((b) => (mode === "draft" ? b.draftTitle.trim() : (b.publishedTitle ?? "").trim()))
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const hero = visible.find((b) => b.kind === "hero") ?? null;
  const destaques = visible.filter((b) => b.kind === "destaque");
  const passos = visible.filter((b) => b.kind === "passo");
  const faq = visible.filter((b) => b.kind === "faq");
  const rodape = visible.filter((b) => b.kind === "rodape");

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: "var(--stayo-bg)",
        color: "var(--stayo-ink)",
        fontFamily: "var(--stayo-font-ui)",
      }}
    >
      {mode === "draft" ? (
        <div
          className="px-4 py-2 text-center text-xs"
          style={{ backgroundColor: "var(--stayo-gold-soft)", color: "var(--stayo-warning)" }}
        >
          Pré-visualização do rascunho — o proprietário ainda não vê estes textos.
        </div>
      ) : null}

      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-sm"
            style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
          >
            S
          </span>
          <span className="text-base" style={{ fontFamily: "var(--stayo-font-display)" }}>
            Stayo
          </span>
        </div>
        <a
          href="/portal/login"
          className="rounded-[var(--radius-control)] px-3 py-2 text-sm"
          style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
        >
          Entrar
        </a>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pb-16">
        <section className="flex flex-col gap-3">
          <h1
            className="text-2xl leading-tight sm:text-3xl"
            style={{ fontFamily: "var(--stayo-font-display)" }}
          >
            {hero ? blockView(hero, mode).title : "Portal do Proprietário Stayo"}
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "var(--stayo-ink-muted)" }}>
            {hero
              ? blockView(hero, mode).body
              : "Acompanhe a implantação do seu imóvel, confirme seus dados e receba a proposta em um só lugar."}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href="/portal/login"
              className="rounded-[var(--radius-control)] px-4 py-3 text-center text-sm"
              style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
            >
              Acessar minha conta
            </a>
          </div>
        </section>

        {blocksQ.isPending ? (
          <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
            Carregando...
          </p>
        ) : null}

        {destaques.length > 0 ? (
          <section className="grid gap-3 sm:grid-cols-2">
            {destaques.map((b) => (
              <Card key={b.id} block={b} mode={mode} />
            ))}
          </section>
        ) : null}

        {passos.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg" style={{ fontFamily: "var(--stayo-font-display)" }}>
              Como funciona
            </h2>
            <ol className="flex flex-col gap-3">
              {passos.map((b, index) => {
                const view = blockView(b, mode);
                return (
                  <li
                    key={b.id}
                    className="flex gap-3 rounded-[var(--radius-card)] border p-4"
                    style={surface}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs"
                      style={{
                        backgroundColor: "var(--stayo-forest-soft)",
                        color: "var(--stayo-forest)",
                      }}
                    >
                      {index + 1}
                    </span>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm">{view.title}</span>
                      {view.body ? (
                        <span className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                          {view.body}
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}

        {faq.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg" style={{ fontFamily: "var(--stayo-font-display)" }}>
              Perguntas frequentes
            </h2>
            {faq.map((b) => {
              const view = blockView(b, mode);
              return (
                <details
                  key={b.id}
                  className="rounded-[var(--radius-card)] border p-4"
                  style={surface}
                >
                  <summary className="cursor-pointer text-sm">{view.title}</summary>
                  <p className="mt-2 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                    {view.body}
                  </p>
                </details>
              );
            })}
          </section>
        ) : null}

        {!blocksQ.isPending && visible.length === 0 ? (
          <p
            className="rounded-[var(--radius-card)] border p-4 text-sm"
            style={{ ...surface, color: "var(--stayo-ink-muted)" }}
          >
            O conteúdo institucional deste portal ainda não foi publicado.
          </p>
        ) : null}
      </main>

      <footer
        className="border-t px-4 py-6"
        style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink-muted)" }}
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 text-xs">
          {rodape.map((b) => {
            const view = blockView(b, mode);
            return (
              <p key={b.id}>
                <span style={{ color: "var(--stayo-ink)" }}>{view.title}</span> {view.body}
              </p>
            );
          })}
          <p>Stayo — hospedagem por temporada.</p>
        </div>
      </footer>
    </div>
  );
}

function Card({
  block,
  mode,
}: {
  block: PortalContentBlock;
  mode: "draft" | "published";
}) {
  const view = blockView(block, mode);
  return (
    <div className="flex flex-col gap-1 rounded-[var(--radius-card)] border p-4" style={surface}>
      <span className="text-sm">{view.title}</span>
      {view.body ? (
        <span className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          {view.body}
        </span>
      ) : null}
    </div>
  );
}
