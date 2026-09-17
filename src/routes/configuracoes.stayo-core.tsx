import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { ErrorRows, Field, PageHeader, Panel } from "../components/data/ListStates";
import { coreApi } from "../lib/api/queries";
import {
  coreAppsQuery,
  coreLogsQuery,
  coreOverviewQuery,
  coreScopesQuery,
  coreWebhooksQuery,
} from "../lib/api/queries";

export const Route = createFileRoute("/configuracoes/stayo-core")({
  head: () => ({
    meta: [
      { title: "Stayo Core — Stayo Admin" },
      {
        name: "description",
        content: "Status, aplicativos, scopes, webhooks e logs da integração com o Stayo Core.",
      },
      { property: "og:title", content: "Stayo Core — Stayo Admin" },
      {
        property: "og:description",
        content: "Status, aplicativos, scopes, webhooks e logs da integração com o Stayo Core.",
      },
    ],
  }),
  component: StayoCoreSettingsPage,
});

const surface = {
  backgroundColor: "var(--stayo-surface)",
  borderColor: "var(--stayo-border)",
};

const sections = [
  { id: "visao-geral", label: "Visão geral" },
  { id: "api", label: "API" },
  { id: "aplicativos", label: "Aplicativos" },
  { id: "permissoes", label: "Permissões / Scopes" },
  { id: "webhooks", label: "Webhooks" },
  { id: "logs", label: "Logs" },
] as const;

type SectionId = (typeof sections)[number]["id"];

function StayoCoreSettingsPage() {
  const [section, setSection] = useState<SectionId>("visao-geral");

  return (
    <>
      <PageHeader title="Stayo Core" />

      <div
        className="mb-4 flex gap-2 overflow-x-auto border-b"
        style={{ borderColor: "var(--stayo-border)" }}
      >
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className="whitespace-nowrap px-3 py-2 text-sm"
            style={{
              color: section === s.id ? "var(--stayo-ink)" : "var(--stayo-ink-muted)",
              borderBottom:
                section === s.id ? "2px solid var(--stayo-forest)" : "2px solid transparent",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === "visao-geral" && <OverviewSection />}
      {section === "api" && <ApiSection />}
      {section === "aplicativos" && <AppsSection />}
      {section === "permissoes" && <ScopesSection />}
      {section === "webhooks" && <WebhooksSection />}
      {section === "logs" && <LogsSection />}
    </>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border" style={surface}>
      <h2
        className="border-b px-4 py-3 text-sm"
        style={{
          borderColor: "var(--stayo-border)",
          fontFamily: "var(--stayo-font-display)",
          color: "var(--stayo-ink)",
        }}
      >
        {title}
      </h2>
      <div className="p-4">{children}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: "ok" | "degraded" | "down" }) {
  const map = {
    ok: { label: "Operacional", color: "var(--stayo-success)" },
    degraded: { label: "Degradado", color: "var(--stayo-warning)" },
    down: { label: "Indisponível", color: "var(--stayo-danger)" },
  } as const;
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px]"
      style={{ backgroundColor: "var(--stayo-forest-soft)", color: map[status].color }}
    >
      {map[status].label}
    </span>
  );
}

function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-5 w-full animate-pulse rounded"
          style={{ backgroundColor: "var(--stayo-border)" }}
        />
      ))}
    </div>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-8 text-center text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
      {children}
    </p>
  );
}

function OverviewSection() {
  const query = useQuery(coreOverviewQuery());

  if (query.isPending) {
    return (
      <SectionCard title="Visão geral">
        <Loading />
      </SectionCard>
    );
  }
  if (query.isError || !query.data) {
    return (
      <Panel>
        <ErrorRows onRetry={() => void query.refetch()} />
      </Panel>
    );
  }

  const { health, api, appsCount, recentEvents, recentErrors } = query.data;

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="Visão geral">
        <div className="mb-3 flex items-center gap-2">
          <StatusBadge status={health.status} />
          <span className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
            verificado em {health.checkedAt}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Versão da API" value={api.version} />
          <Field label="Versão do Core" value={health.version} />
          <Field label="Disponibilidade" value={health.uptimePercent} />
          <Field label="Latência (ms)" value={health.latencyMs} />
          <Field label="Aplicativos conectados" value={appsCount} />
        </div>
      </SectionCard>

      <SectionCard title="Eventos recentes">
        {recentEvents.length === 0 ? (
          <EmptyText>Nenhum evento recente</EmptyText>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
            {recentEvents.map((e) => (
              <li key={e.id} className="flex flex-wrap gap-3 py-2 text-sm">
                <span style={{ color: "var(--stayo-ink)" }}>{e.name}</span>
                <span style={{ color: "var(--stayo-ink-muted)" }}>{e.appName ?? "—"}</span>
                <span className="ml-auto text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                  {e.occurredAt}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Erros recentes">
        {recentErrors.length === 0 ? (
          <EmptyText>Nenhum erro recente</EmptyText>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
            {recentErrors.map((l) => (
              <li key={l.id} className="flex flex-wrap gap-3 py-2 text-sm">
                <span style={{ color: "var(--stayo-danger)" }}>{l.status}</span>
                <span style={{ color: "var(--stayo-ink)" }}>{l.endpoint}</span>
                <span style={{ color: "var(--stayo-ink-muted)" }}>{l.errorSummary ?? "—"}</span>
                <span className="ml-auto text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                  {l.occurredAt}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function ApiSection() {
  const query = useQuery(coreOverviewQuery());

  if (query.isPending) {
    return (
      <SectionCard title="API">
        <Loading />
      </SectionCard>
    );
  }
  if (query.isError || !query.data) {
    return (
      <Panel>
        <ErrorRows onRetry={() => void query.refetch()} />
      </Panel>
    );
  }

  const { api } = query.data;

  return (
    <SectionCard title="API">
      <div className="mb-3">
        <StatusBadge status={api.status} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Versão" value={api.version} />
        <Field label="Endpoint base" value={api.baseUrl} />
        <Field label="Ambiente" value={api.environment} />
        <Field
          label="Documentação"
          value={
            api.docsUrl ? (
              <a
                href={api.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
                style={{ color: "var(--stayo-forest)" }}
              >
                {api.docsUrl}
              </a>
            ) : null
          }
        />
      </div>
    </SectionCard>
  );
}

function AppsSection() {
  const query = useQuery(coreAppsQuery());

  return (
    <SectionCard title="Aplicativos consumidores">
      <p
        className="mb-3 rounded-[var(--radius-control)] px-3 py-2 text-xs"
        style={{ backgroundColor: "var(--stayo-gold-soft)", color: "var(--stayo-warning)" }}
      >
        Cada aplicativo tem credencial própria. Nunca existe uma chave mestra compartilhada
        entre aplicativos — e o segredo nunca aparece nesta tela.
      </p>

      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorRows onRetry={() => void query.refetch()} />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyText>Nenhum aplicativo registrado</EmptyText>
      ) : (
        <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
          {(query.data ?? []).map((app) => (
            <li key={app.id} className="py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium" style={{ color: "var(--stayo-ink)" }}>
                  {app.name}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px]"
                  style={{
                    backgroundColor: "var(--stayo-forest-soft)",
                    color: app.active ? "var(--stayo-success)" : "var(--stayo-ink-muted)",
                  }}
                >
                  {app.active ? "Ativo" : "Inativo"}
                </span>
              </div>
              <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                {app.description ?? "—"}
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <Field label="Credencial" value={app.credentialId} />
                <Field label="Criada em" value={app.credentialCreatedAt} />
                <Field label="Última rotação" value={app.credentialLastRotatedAt} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {app.scopes.map((s) => (
                  <span
                    key={s}
                    className="rounded-full px-2 py-0.5 text-[11px]"
                    style={{
                      backgroundColor: "var(--stayo-forest-soft)",
                      color: "var(--stayo-forest)",
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function ScopesSection() {
  const scopesQuery = useQuery(coreScopesQuery());
  const appsQuery = useQuery(coreAppsQuery());

  const apps = appsQuery.data ?? [];

  return (
    <SectionCard title="Permissões / Scopes">
      {scopesQuery.isPending || appsQuery.isPending ? (
        <Loading rows={6} />
      ) : scopesQuery.isError || appsQuery.isError ? (
        <ErrorRows
          onRetry={() => {
            void scopesQuery.refetch();
            void appsQuery.refetch();
          }}
        />
      ) : (scopesQuery.data ?? []).length === 0 ? (
        <EmptyText>Nenhum scope definido</EmptyText>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr style={{ color: "var(--stayo-ink-muted)" }}>
                <th className="py-2 text-left text-xs font-normal">Scope</th>
                {apps.map((a) => (
                  <th key={a.id} className="py-2 text-center text-xs font-normal">
                    {a.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
              {(scopesQuery.data ?? []).map((scope) => (
                <tr key={scope.name}>
                  <td className="py-2 pr-4">
                    <span style={{ color: "var(--stayo-ink)" }}>{scope.name}</span>
                    {scope.sensitive && (
                      <span
                        className="ml-2 rounded-full px-2 py-0.5 text-[11px]"
                        style={{
                          backgroundColor: "var(--stayo-gold-soft)",
                          color: "var(--stayo-warning)",
                        }}
                      >
                        sensível
                      </span>
                    )}
                    <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                      {scope.description}
                    </p>
                  </td>
                  {apps.map((a) => (
                    <td
                      key={a.id}
                      className="py-2 text-center"
                      style={{
                        color: a.scopes.includes(scope.name)
                          ? "var(--stayo-forest)"
                          : "var(--stayo-border)",
                      }}
                    >
                      {a.scopes.includes(scope.name) ? "✓" : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function WebhooksSection() {
  const query = useQuery(coreWebhooksQuery());
  const queryClient = useQueryClient();
  const retry = useMutation({
    mutationFn: (id: string) => coreApi.admin.retryWebhook(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["core-admin", "webhooks"] });
    },
  });

  return (
    <SectionCard title="Webhooks">
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorRows onRetry={() => void query.refetch()} />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyText>Nenhum webhook configurado</EmptyText>
      ) : (
        <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
          {(query.data ?? []).map((w) => (
            <li key={w.id} className="py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm" style={{ color: "var(--stayo-ink)" }}>
                  {w.url}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px]"
                  style={{
                    backgroundColor: "var(--stayo-forest-soft)",
                    color: w.active ? "var(--stayo-success)" : "var(--stayo-ink-muted)",
                  }}
                >
                  {w.active ? "Ativo" : "Inativo"}
                </span>
                <button
                  type="button"
                  onClick={() => retry.mutate(w.id)}
                  disabled={retry.isPending}
                  className="ml-auto rounded-[var(--radius-control)] border px-3 py-1 text-xs"
                  style={{ ...surface, color: "var(--stayo-forest)" }}
                >
                  Reprocessar
                </button>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-4">
                <Field label="Aplicativo" value={w.appName ?? w.appId} />
                <Field label="Última tentativa" value={w.lastAttemptAt} />
                <Field label="Último sucesso" value={w.lastSuccessAt} />
                <Field label="Falhas" value={w.failureCount} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {w.events.map((e) => (
                  <span
                    key={e}
                    className="rounded-full px-2 py-0.5 text-[11px]"
                    style={{
                      backgroundColor: "var(--stayo-forest-soft)",
                      color: "var(--stayo-forest)",
                    }}
                  >
                    {e}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

/**
 * Logs de requisição ao Core.
 *
 * REGRA DE SEGURANÇA: este log NUNCA deve registrar senha, token,
 * documento ou selfie — nem no corpo da requisição, nem no resumo de erro.
 * O tipo CoreLogEntry existe justamente sem esses campos.
 */
function LogsSection() {
  const query = useQuery(coreLogsQuery());
  const rows = query.data?.data ?? [];

  return (
    <SectionCard title="Logs">
      {query.isPending ? (
        <Loading rows={6} />
      ) : query.isError ? (
        <ErrorRows onRetry={() => void query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyText>Nenhum registro de log disponível</EmptyText>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr style={{ color: "var(--stayo-ink-muted)" }}>
                <th className="py-2 text-left text-xs font-normal">Data/hora</th>
                <th className="py-2 text-left text-xs font-normal">Aplicativo</th>
                <th className="py-2 text-left text-xs font-normal">Endpoint / evento</th>
                <th className="py-2 text-left text-xs font-normal">Status</th>
                <th className="py-2 text-left text-xs font-normal">Latência</th>
                <th className="py-2 text-left text-xs font-normal">Correlation ID</th>
                <th className="py-2 text-left text-xs font-normal">Erro</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
              {rows.map((l) => (
                <tr key={l.id} style={{ color: "var(--stayo-ink)" }}>
                  <td className="py-2 pr-3">{l.occurredAt}</td>
                  <td className="py-2 pr-3">{l.appName ?? "—"}</td>
                  <td className="py-2 pr-3">{l.endpoint}</td>
                  <td className="py-2 pr-3">{l.status}</td>
                  <td className="py-2 pr-3">{l.latencyMs ?? "—"}</td>
                  <td className="py-2 pr-3">{l.correlationId}</td>
                  <td className="py-2" style={{ color: "var(--stayo-ink-muted)" }}>
                    {l.errorSummary ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
