import { createFileRoute } from "@tanstack/react-router";

import { PageHeader } from "../components/data/ListStates";

export const Route = createFileRoute("/bi")({
  head: () => ({
    meta: [
      { title: "BI — Stayo Admin" },
      { name: "description", content: "Indicadores gerais da operação Stayo." },
      { property: "og:title", content: "BI — Stayo Admin" },
      { property: "og:description", content: "Indicadores gerais da operação Stayo." },
    ],
  }),
  component: BiPage,
});

/** Placeholder: cards de métricas sem dado — serão ligados ao Core depois. */
const metrics = [
  "Ocupação",
  "Diária média",
  "Receita por imóvel disponível",
  "Reservas no período",
  "Cancelamentos",
  "Tempo médio de implantação",
  "Imóveis ativos",
  "Avaliação média",
] as const;

function BiPage() {
  return (
    <>
      <PageHeader title="BI" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((label) => (
          <div
            key={label}
            className="rounded-[var(--radius-card)] border p-4"
            style={{
              backgroundColor: "var(--stayo-surface)",
              borderColor: "var(--stayo-border)",
            }}
          >
            <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
              {label}
            </p>
            <p
              className="mt-2 text-2xl"
              style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
            >
              —
            </p>
            <p className="mt-1 text-[11px]" style={{ color: "var(--stayo-ink-muted)" }}>
              sem dados
            </p>
          </div>
        ))}
      </div>
    </>
  );
}
