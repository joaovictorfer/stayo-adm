import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import {
  EmptyRows,
  ErrorRows,
  ListSkeleton,
  PageHeader,
  Panel,
} from "../components/data/ListStates";
import { auditLogQuery } from "../lib/api/queries";
import { isSupabaseConfigured } from "../lib/api/supabase-client";
import type { AuditEvent } from "../types/audit";

const eventLabels: Record<AuditEvent, string> = {
  "auth.login": "Login do time interno",
  "owner.created": "Proprietário criado",
  "owner.updated": "Proprietário atualizado",
  "implementation.created": "Implantação criada",
  "implementation.status_changed": "Status da implantação alterado",
  "timeline.item_updated": "Item da timeline atualizado",
  "readiness.override": "Override de prontidão registrado",
  "supply.resolved": "Item do inventário resolvido",
  "supply.dismissed": "Item do inventário dispensado",
  "supply.reopened": "Item do inventário reaberto",
  "supply.blocker_removed": "Bloqueio do inventário retirado",
  "proposal.version_created": "Nova versão de proposta",
  "proposal.sent": "Proposta enviada",
  "proposal.accepted": "Proposta aceita",
  "portal.invitation_created": "Convite do portal criado",
  "portal.invitation_revoked": "Convite do portal revogado",
  "owner.data_submitted": "Proprietário enviou dados",
  "charge.created": "Cobrança criada",
  "charge.status_changed": "Status de cobrança alterado",
  "core_conversion.requested": "Conversão para o Core solicitada",
  "core_conversion.completed": "Conversão para o Core concluída",
};

export const Route = createFileRoute("/configuracoes/auditoria")({
  head: () => ({
    meta: [
      { title: "Auditoria — Stayo Admin" },
      {
        name: "description",
        content: "Histórico de ações sensíveis da Central Comercial e de Onboarding.",
      },
      { property: "og:title", content: "Auditoria — Stayo Admin" },
      {
        property: "og:description",
        content: "Histórico de ações sensíveis da Central Comercial e de Onboarding.",
      },
    ],
  }),
  component: AuditoriaPage,
});

const surface = { backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" };

function AuditoriaPage() {
  const query = useQuery(auditLogQuery());
  const rows = query.data ?? [];
  const usingSupabase = isSupabaseConfigured();

  return (
    <>
      <PageHeader title="Auditoria">
        <Link
          to="/configuracoes"
          className="text-sm underline"
          style={{ color: "var(--stayo-ink-muted)" }}
        >
          Voltar para configurações
        </Link>
      </PageHeader>

      <p className="mb-4 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
        {usingSupabase
          ? "Fonte: banco protegido do Stayo Admin."
          : "Fonte: armazenamento local do navegador — some ao limpar dados do site. Configure VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY para persistência real e compartilhada entre usuários."}
      </p>

      <Panel>
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <ErrorRows onRetry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyRows message="Nenhum evento de auditoria registrado ainda" />
        ) : (
          <>
            <ul className="divide-y divide-[var(--stayo-border)] md:hidden">
              {rows.map((entry) => (
                <li key={entry.id} className="space-y-3 px-4 py-4 text-sm">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <strong className="min-w-0 break-words font-medium text-[var(--stayo-ink)]">
                      {eventLabels[entry.event] ?? entry.event}
                    </strong>
                    <time className="shrink-0 text-right text-xs text-[var(--stayo-ink-muted)]">
                      {new Date(entry.createdAt).toLocaleString("pt-BR")}
                    </time>
                  </div>
                  <dl className="grid gap-2 text-xs">
                    <div>
                      <dt className="text-[var(--stayo-ink-muted)]">Entidade</dt>
                      <dd className="break-all text-[var(--stayo-ink)]">
                        {entry.entityType}{entry.entityId ? ` · ${entry.entityId}` : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--stayo-ink-muted)]">Detalhes</dt>
                      <dd className="mt-1 max-h-40 overflow-auto rounded-md bg-[var(--stayo-bg)] p-2 font-mono text-[11px] leading-relaxed text-[var(--stayo-ink)] [overflow-wrap:anywhere]">
                        {Object.keys(entry.metadata).length > 0
                          ? JSON.stringify(entry.metadata, null, 2)
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[42rem] text-sm">
              <thead>
                <tr style={{ color: "var(--stayo-ink-muted)" }}>
                  <th className="py-2 text-left text-xs font-normal">Data/hora</th>
                  <th className="py-2 text-left text-xs font-normal">Evento</th>
                  <th className="py-2 text-left text-xs font-normal">Entidade</th>
                  <th className="py-2 text-left text-xs font-normal">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
                {rows.map((entry) => (
                  <tr key={entry.id} style={{ color: "var(--stayo-ink)" }}>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleString("pt-BR")}
                    </td>
                    <td className="py-2 pr-3">{eventLabels[entry.event] ?? entry.event}</td>
                    <td className="py-2 pr-3">
                      {entry.entityType}
                      {entry.entityId ? ` · ${entry.entityId}` : ""}
                    </td>
                    <td className="py-2" style={{ color: "var(--stayo-ink-muted)" }}>
                      {Object.keys(entry.metadata).length > 0
                        ? JSON.stringify(entry.metadata)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
      </Panel>
    </>
  );
}
