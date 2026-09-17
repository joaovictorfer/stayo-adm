import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { PageHeader } from "../components/data/ListStates";
import { isSupabaseConfigured } from "../lib/api/supabase-client";
import {
  collectLocalAdminSnapshot,
  importLocalAdminDataToSupabase,
  type ImportResult,
} from "../lib/migration/local-to-supabase";

export const Route = createFileRoute("/configuracoes/migracao")({
  head: () => ({
    meta: [
      { title: "Migração de dados — Stayo Admin" },
      {
        name: "description",
        content: "Status da migração do localStorage para o Supabase, chave a chave.",
      },
    ],
  }),
  component: MigrationPage,
});

const surface = { backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" };

const migratedTables = [
  { key: "stayo-admin:owner-records", table: "owner_records" },
  { key: "stayo-admin:commercial-term-defaults", table: "commercial_term_defaults" },
  { key: "stayo-admin:commercial-terms", table: "commercial_terms" },
  { key: "stayo-admin:outbound-messages", table: "outbound_messages" },
  { key: "stayo-admin:initial-charges", table: "initial_charges" },
];

const pendingKeys = [
  "stayo-admin:audit-logs",
  "stayo-admin:owner-onboarding-links",
  "stayo-admin:owner-onboarding-submissions",
  "stayo-admin:proposals",
  "stayo-admin:proposal-share-links",
  "stayo-admin:owner-notes",
  "stayo-admin:checklist-templates",
  "stayo-admin:implementations",
  "stayo-admin:implementation-items",
];

function MigrationPage() {
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const snapshotQuery = useQuery({
    queryKey: ["migration", "local-snapshot"],
    queryFn: () => Promise.resolve(collectLocalAdminSnapshot()),
  });
  const configured = isSupabaseConfigured();

  const runImport = useMutation({
    mutationFn: () => importLocalAdminDataToSupabase(),
    onSuccess: setResults,
  });

  const snapshot = snapshotQuery.data;
  const localCounts = snapshot
    ? [
        { table: "owner_records", count: snapshot.ownerRecords.length },
        { table: "commercial_term_defaults", count: snapshot.commercialTermDefaults.length },
        { table: "commercial_terms", count: snapshot.commercialTerms.length },
        { table: "outbound_messages", count: snapshot.outboundMessages.length },
        { table: "initial_charges", count: snapshot.initialCharges.length },
      ]
    : [];

  return (
    <>
      <PageHeader title="Migração de dados">
        <Link
          to="/configuracoes"
          className="text-sm underline"
          style={{ color: "var(--stayo-ink-muted)" }}
        >
          Voltar para configurações
        </Link>
      </PageHeader>

      <p className="mb-4 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        Mapa completo de toda chave <code>stayo-admin:*</code> em{" "}
        <code>docs/LOCALSTORAGE_MIGRATION.md</code>. Esta tela só importa as verticais que já têm
        adapter Supabase pronto (<code>src/lib/api/admin-client.ts</code>) — o restante é dado real
        que ainda precisa de schema próprio, listado abaixo como pendente.
      </p>

      <div className="mb-4 rounded-[var(--radius-card)] border p-4" style={surface}>
        <h2
          className="mb-3 text-sm"
          style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
        >
          Pronto para importar
        </h2>
        {snapshotQuery.isPending ? (
          <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
            Carregando...
          </p>
        ) : (
          <ul className="mb-3 divide-y text-sm" style={{ borderColor: "var(--stayo-border)" }}>
            {localCounts.map((row) => (
              <li key={row.table} className="flex items-center justify-between py-1.5">
                <span>{row.table}</span>
                <span style={{ color: "var(--stayo-ink-muted)" }}>
                  {row.count} {row.count === 1 ? "registro local" : "registros locais"}
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="mb-2 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
          {configured
            ? "Supabase configurado — a importação é segura para rodar mais de uma vez (upsert por id, nunca duplica)."
            : "Supabase ainda não configurado (VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY ausentes) — o botão abaixo fica desabilitado até existir um projeto real."}
        </p>
        <button
          type="button"
          onClick={() => runImport.mutate()}
          disabled={!configured || runImport.isPending}
          className="rounded-[var(--radius-control)] px-3 py-2 text-sm disabled:opacity-50"
          style={{ backgroundColor: "var(--stayo-forest)", color: "var(--stayo-surface)" }}
        >
          {runImport.isPending ? "Importando..." : "Importar para o Supabase"}
        </button>

        {runImport.isError && (
          <p className="mt-2 text-xs" style={{ color: "var(--stayo-danger)" }} role="alert">
            {runImport.error instanceof Error ? runImport.error.message : String(runImport.error)}
          </p>
        )}

        {results && (
          <ul className="mt-3 divide-y text-sm" style={{ borderColor: "var(--stayo-border)" }}>
            {results.map((r) => (
              <li key={r.table} className="flex items-center justify-between py-1.5">
                <span>{r.table}</span>
                <span style={{ color: "var(--stayo-success)" }}>{r.imported} importados</span>
              </li>
            ))}
          </ul>
        )}

        {migratedTables.map((t) => (
          <p key={t.key} className="mt-1 text-[11px]" style={{ color: "var(--stayo-ink-muted)" }}>
            {t.key} → {t.table}
          </p>
        ))}
      </div>

      <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
        <h2
          className="mb-3 text-sm"
          style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
        >
          Pendentes (schema ou adapter ainda não existem)
        </h2>
        <ul className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
          {pendingKeys.map((key) => (
            <li key={key}>{key}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
          Detalhe de cada uma (por que ainda não migra e o que falta) em{" "}
          <code>docs/LOCALSTORAGE_MIGRATION.md</code>.
        </p>
      </div>
    </>
  );
}
