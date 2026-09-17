import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import {
  DetailSkeleton,
  ErrorRows,
  Field,
  NotFoundPanel,
  PageHeader,
} from "../components/data/ListStates";
import { LinkedField } from "../components/patterns/LinkedField";
import { conversationMessagesQuery, conversationQuery } from "../lib/api/queries";
import type { ConversationMessage } from "../types/core";

const surface = { backgroundColor: "var(--stayo-surface)", borderColor: "var(--stayo-border)" };

const senderLabels: Record<ConversationMessage["sender"], string> = {
  hospede: "Hóspede",
  equipe: "Equipe",
  sistema: "Sistema",
};

export const Route = createFileRoute("/mensagens/$id")({
  head: () => ({
    meta: [
      { title: "Conversa — Stayo Admin" },
      { name: "description", content: "Detalhe de uma conversa da Central de Mensagens." },
      { property: "og:title", content: "Conversa — Stayo Admin" },
      { property: "og:description", content: "Detalhe de uma conversa da Central de Mensagens." },
    ],
  }),
  component: ConversationDetailPage,
});

function ConversationDetailPage() {
  const { id } = Route.useParams();
  const query = useQuery(conversationQuery(id));
  const messagesQuery = useQuery(conversationMessagesQuery(id));
  const conversation = query.data;

  return (
    <>
      <PageHeader title={conversation?.participantName ?? "Conversa"}>
        <Link
          to="/mensagens"
          className="text-sm underline"
          style={{ color: "var(--stayo-ink-muted)" }}
        >
          Voltar para mensagens
        </Link>
      </PageHeader>

      {query.isPending ? (
        <DetailSkeleton />
      ) : query.isError ? (
        <ErrorRows onRetry={() => void query.refetch()} />
      ) : !conversation ? (
        <NotFoundPanel message="Conversa não encontrada" />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="ID" value={conversation.id} />
            <Field label="Canal" value={conversation.channel} />
            <Field label="Assunto" value={conversation.subject} />
            <Field label="Participante" value={conversation.participantName} />
            <Field
              label="Imóvel"
              value={
                conversation.propertyId ? (
                  <LinkedField
                    to="/imoveis/$id"
                    id={conversation.propertyId}
                    label={conversation.propertyName}
                  />
                ) : null
              }
            />
            <Field
              label="Reserva"
              value={
                conversation.reservationId ? (
                  <LinkedField
                    to="/reservas/$id"
                    id={conversation.reservationId}
                    label={conversation.reservationCode}
                  />
                ) : null
              }
            />
            <Field label="Não lidas" value={conversation.unreadCount} />
            <Field label="Status" value={conversation.status} />
            <Field label="Criada em" value={conversation.createdAt} />
            <Field label="Atualizada em" value={conversation.updatedAt} />
          </div>

          <div className="rounded-[var(--radius-card)] border p-4" style={surface}>
            <h2
              className="mb-3 text-sm"
              style={{ fontFamily: "var(--stayo-font-display)", color: "var(--stayo-ink)" }}
            >
              Conversa
            </h2>
            {messagesQuery.isPending ? (
              <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                Carregando...
              </p>
            ) : (messagesQuery.data ?? []).length === 0 ? (
              <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
                Nenhuma mensagem sincronizada ainda.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {(messagesQuery.data ?? []).map((m) => (
                  <li
                    key={m.id}
                    className="max-w-[80%] rounded-[var(--radius-control)] px-3 py-2 text-sm"
                    style={{
                      alignSelf: m.sender === "hospede" ? "flex-start" : "flex-end",
                      backgroundColor:
                        m.sender === "hospede" ? "var(--stayo-bg)" : "var(--stayo-forest-soft)",
                      color: "var(--stayo-ink)",
                    }}
                  >
                    <p
                      className="mb-0.5 text-[11px] uppercase tracking-wide"
                      style={{ color: "var(--stayo-ink-muted)" }}
                    >
                      {senderLabels[m.sender]}
                    </p>
                    <p>{m.body}</p>
                    <p className="mt-0.5 text-[11px]" style={{ color: "var(--stayo-ink-muted)" }}>
                      {new Date(m.sentAt).toLocaleString("pt-BR")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
}
