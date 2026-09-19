import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { DetailSkeleton, ErrorRows, NotFoundPanel } from "../components/data/ListStates";
import { OwnerWorkspace } from "../components/owners/OwnerWorkspace";
import { ownerQuery } from "../lib/api/queries";

export const Route = createFileRoute("/proprietarios/$id")({
  head: () => ({ meta: [
    { title: "Workspace do proprietário — Stayo Admin" },
    { name: "description", content: "Visão administrativa do relacionamento com o proprietário." },
    { property: "og:title", content: "Workspace do proprietário — Stayo Admin" },
    { property: "og:description", content: "Visão administrativa do relacionamento com o proprietário." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: OwnerDetailPage,
});

function OwnerDetailPage() {
  const { id } = Route.useParams();
  const query = useQuery(ownerQuery(id));
  if (query.isPending) return <DetailSkeleton />;
  if (query.isError) return <ErrorRows onRetry={() => void query.refetch()} />;
  if (!query.data) return <NotFoundPanel message="Proprietário não encontrado" />;
  return <OwnerWorkspace owner={query.data} />;
}
