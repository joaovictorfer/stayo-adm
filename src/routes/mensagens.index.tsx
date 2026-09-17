import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { MessageCircle, MailWarning } from "lucide-react";

import {
  EmptyRows,
  ErrorRows,
  ListSkeleton,
  PageHeader,
  Panel,
} from "../components/data/ListStates";
import { IndicatorCard } from "../components/patterns/IndicatorCard";
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
  const unread = rows.filter((c) => c.unreadCount > 0).length;

  return (
    <>
      <PageHeader title="Mensagens" count={query.isSuccess ? rows.length : undefined} />
      <p className="mb-4 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
        Este módulo passará a ler as conversas da Central de Mensagens do STAYO.APP.
      </p>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <IndicatorCard icon={MessageCircle} label="Conversas" value={rows.length} />
        <IndicatorCard
          icon={MailWarning}
          label="Com mensagens não lidas"
          value={unread}
          tone={unread > 0 ? "warning" : "neutral"}
        />
      </div>

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
                  {c.unreadCount > 0 && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px]"
                      style={{
                        backgroundColor: "var(--stayo-gold-soft)",
                        color: "var(--stayo-warning)",
                      }}
                    >
                      {c.unreadCount} não lida{c.unreadCount > 1 ? "s" : ""}
                    </span>
                  )}
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
