import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye } from "lucide-react";

import { PortalShell, PortalSkeleton, PortalEmptyState } from "../components/portal/PortalExperience";
import { OwnerHomeContent } from "./portal.inicio";
import { implementationQuery } from "../lib/api/queries";

export const Route = createFileRoute("/portal/previa/$id")({
  head: () => ({
    meta: [
      { title: "Pré-visualização do Portal do Proprietário — Stayo" },
      {
        name: "description",
        content:
          "Veja exatamente como o proprietário enxerga a implantação no Portal do Proprietário Stayo.",
      },
      { property: "og:title", content: "Pré-visualização do Portal do Proprietário — Stayo" },
      {
        property: "og:description",
        content: "Visualização interna de como o proprietário acompanha a implantação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortalPreviewPage,
});

function PortalPreviewPage() {
  const { id } = Route.useParams();
  const implementationQ = useQuery(implementationQuery(id));
  const implementation = implementationQ.data;

  return (
    <PortalShell framed={false} showBrand={false}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--portal-border)] bg-[var(--portal-gold-soft)] px-4 py-3 text-xs">
        <span className="flex items-center gap-2 font-medium">
          <Eye className="h-4 w-4" />
          Pré-visualização interna — você está vendo o portal como o proprietário.
        </span>
        <Link
          to="/implantacao/$id"
          params={{ id }}
          className="rounded-full border border-[var(--portal-border)] px-3 py-1 font-medium"
        >
          Voltar à implantação
        </Link>
      </div>

      {implementationQ.isPending ? (
        <PortalSkeleton rows={4} />
      ) : !implementation ? (
        <PortalEmptyState
          icon={<Eye />}
          title="Implantação não encontrada"
          description="Não foi possível carregar esta implantação para pré-visualização."
          nextStep="Verifique se o link está correto e se você tem acesso a esta implantação."
        />
      ) : !implementation.ownerId ? (
        <PortalEmptyState
          icon={<Eye />}
          title="Nenhum proprietário vinculado"
          description="Esta implantação ainda não tem proprietário vinculado, então não há portal para visualizar."
          nextStep="Vincule o proprietário na aba Proprietário e volte aqui."
        />
      ) : (
        <OwnerHomeContent
          ownerId={implementation.ownerId}
          onSignOut={() => undefined}
          preview
          previewImplementationId={implementation.id}
        />
      )}
    </PortalShell>
  );
}
