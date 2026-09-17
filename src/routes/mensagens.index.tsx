import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import {
  EmptyRows,
  ErrorRows,
  ListSkeleton,
  PageHeader,
  Panel,
} from "../components/data/ListStates";
import { conversationsListQuery } from "../lib/api/queries";

export const Route = createFileRoute("/mensagens/")({
  head: () => ({
    meta: [
      { title: "Mensagens — Stayo Admin" },
      { name: "description", content: "Conversas da Central de Mensagens do STAYO.APP." },
      { property: "og:title", content: "Mensagens — Stayo Admin" },
      { property: "og:description", content: "Conversas da Central de Mensagens do STAYO.APP." },
    ],
  }),
  component: ConversationsPage,
});

function ConversationsPage() {
  const query = useQuery(conversationsListQuery());
  const rows = query.data?.data ?? [];

  return (
    <>
      <PageHeader title="Mensagens" count={query.isSuccess ? rows.length : undefined} />
      <p className="mb-4 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        Este módulo passará a ler as conversas da Central de Mensagens do STAYO.APP.
      </p>
      <Panel>
        {query.isPending ? (
          <ListSkeleton />
        ) : query.isError ? (
          <ErrorRows onRetry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyRows message="Nenhuma conversa disponível ainda" />
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--stayo-border)" }}>
            {rows.map((c) => (
              <li key={c.id}>
                <Link
                  to="/mensagens/$id"
                  params={{ id: c.id }}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"
                  style={{ color: "var(--stayo-ink)" }}
                >
                  <span className="font-medium">{c.participantName ?? c.subject ?? c.id}</span>
                  <span style={{ color: "var(--stayo-ink-muted)" }}>
                    {c.lastMessagePreview ?? "—"}
                  </span>
                  <span className="ml-auto" style={{ color: "var(--stayo-ink-muted)" }}>
                    {c.lastMessageAt ?? "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
