import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { PageHeader } from "../components/data/ListStates";
import { isSupabaseConfigured } from "../lib/api/supabase-client";
import {
  collectLocalAdminSnapshot,
  importLocalAdminDataToSupabase,
  readMigrationStatus,
  validateSupabaseImport,
  writeMigrationStatus,
  type ImportResult,
  type ValidationResult,
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
  { key: "stayo-admin:owner-onboarding-links", table: "owner_portal_invitations" },
  { key: "stayo-admin:owner-onboarding-submissions", table: "owner_onboarding_submissions" },
];

const pendingKeys = [
  "stayo-admin:audit-logs",
  "stayo-admin:proposals",
  "stayo-admin:proposal-share-links",
  "stayo-admin:owner-notes",
  "stayo-admin:checklist-templates",
  "stayo-admin:implementations",
  "stayo-admin:implementation-items",
];

function MigrationPage() {
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [validation, setValidation] = useState<ValidationResult[] | null>(null);
  const [status, setStatus] = useState(() => readMigrationStatus());
  const snapshotQuery = useQuery({
    queryKey: ["migration", "local-snapshot"],
    queryFn: () => Promise.resolve(collectLocalAdminSnapshot()),
  });
  const configured = isSupabaseConfigured();

  // Fluxo detect → preview → import → validate → mark-migrated (seção 32
  // do plano): o import por si só não confirma nada além de "o upsert não
  // lançou erro" — validate reconsulta o Supabase de verdade, e só então
  // a marca de "já migrado" é gravada neste navegador.
  const runImport = useMutation({
    mutationFn: async () => {
      const snapshot = collectLocalAdminSnapshot();
      const importResults = await importLocalAdminDataToSupabase(snapshot);
      const validationResults = await validateSupabaseImport(snapshot);
      return { importResults, validationResults };
    },
    onSuccess: ({ importResults, validationResults }) => {
      setResults(importResults);
      setValidation(validationResults);
      const allValid = validationResults.every((v) => v.ok);
      const newStatus = {
        lastImportedAt: new Date().toISOString(),
        lastValidatedAt: new Date().toISOString(),
        allValid,
      };
      writeMigrationStatus(newStatus);
      setStatus(newStatus);
    },
  });

  const snapshot = snapshotQuery.data;
  const localCounts = snapshot
    ? [
        { table: "owner_records", count: snapshot.ownerRecords.length },
        { table: "commercial_term_defaults", count: snapshot.commercialTermDefaults.length },
        { table: "commercial_terms", count: snapshot.commercialTerms.length },
        { table: "outbound_messages", count: snapshot.outboundMessages.length },
        { table: "initial_charges", count: snapshot.initialCharges.length },
        { table: "owner_portal_invitations", count: snapshot.ownerOnboardingLinks.length },
        {
          table: "owner_onboarding_submissions",
          count: snapshot.ownerOnboardingSubmissions.length,
        },
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
            ? "Supabase configurado — a importação é segura para rodar mais de uma vez (upsert por id, nunca duplica). Nunca apaga o localStorage de origem, mesmo depois de validada."
            : "Supabase ainda não configurado (VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY ausentes) — o botão abaixo fica desabilitado até existir um projeto real."}
        </p>

        {status && (
          <p
            className="mb-2 rounded-[var(--radius-control)] px-3 py-2 text-xs"
            style={{
              backgroundColor: status.allValid ? "var(--stayo-forest-soft)" : "var(--stayo-danger)",
              color: status.allValid ? "var(--stayo-forest)" : "#fff",
            }}
          >
            {status.allValid
              ? `Já importado e validado neste navegador em ${new Date(status.lastImportedAt).toLocaleString("pt-BR")}.`
              : `Import rodou em ${new Date(status.lastImportedAt).toLocaleString("pt-BR")}, mas a validação encontrou divergência — ver detalhe abaixo.`}{" "}
            Rodar de novo é seguro (upsert), mas não é necessário se está tudo válido.
          </p>
        )}

        <button
          type="button"
          onClick={() => runImport.mutate()}
          disabled={!configured || runImport.isPending}
          className="rounded-[var(--radius-control)] px-3 py-2 text-sm disabled:opacity-50"
          style={{ backgroundColor: "var(--stayo-forest)", color: "var(--stayo-surface)" }}
        >
          {runImport.isPending
            ? "Importando e validando..."
            : status
              ? "Importar novamente mesmo assim"
              : "Importar para o Supabase"}
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

        {validation && (
          <>
            <h3 className="mt-3 mb-1 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
              Validação (reconsulta o Supabase de verdade, não só confirma que o upsert não deu
              erro)
            </h3>
            <ul className="divide-y text-sm" style={{ borderColor: "var(--stayo-border)" }}>
              {validation.map((v) => (
                <li key={v.table} className="flex items-center justify-between py-1.5">
                  <span>{v.table}</span>
                  <span style={{ color: v.ok ? "var(--stayo-success)" : "var(--stayo-danger)" }}>
                    {v.ok
                      ? `ok (${v.foundInSupabase}/${v.expected})`
                      : `divergente (${v.foundInSupabase}/${v.expected})`}
                  </span>
                </li>
              ))}
            </ul>
          </>
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
