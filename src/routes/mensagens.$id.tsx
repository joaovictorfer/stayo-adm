import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import {
  DetailSkeleton,
  ErrorRows,
  Field,
  NotFoundPanel,
  PageHeader,
} from "../components/data/ListStates";
import { conversationQuery } from "../lib/api/queries";

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
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ID" value={conversation.id} />
          <Field label="Canal" value={conversation.channel} />
          <Field label="Assunto" value={conversation.subject} />
          <Field label="Participante" value={conversation.participantName} />
          <Field label="Imóvel" value={conversation.propertyId} />
          <Field label="Reserva" value={conversation.reservationId} />
          <Field label="Última mensagem" value={conversation.lastMessagePreview} />
          <Field label="Recebida em" value={conversation.lastMessageAt} />
          <Field label="Não lidas" value={conversation.unreadCount} />
          <Field label="Status" value={conversation.status} />
          <Field label="Criada em" value={conversation.createdAt} />
          <Field label="Atualizada em" value={conversation.updatedAt} />
        </div>
      )}
    </>
  );
}
