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
          ? "Fonte: Supabase (audit_logs, protegido por RLS)."
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
          <div className="overflow-x-auto">
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
        )}
      </Panel>
    </>
  );
}
