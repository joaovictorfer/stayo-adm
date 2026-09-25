import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FileWarning, WifiOff } from "lucide-react";

import { PortalEmptyState, PortalShell, PortalSkeleton } from "../components/portal/PortalExperience";
import { PublicProposalPresentation } from "../components/portal/PublicProposalPresentation";
import { resolvePublicProposalByToken } from "../lib/api/public-proposal";

export const Route = createFileRoute("/portal/proposta/$token")({
  head: () => ({
    meta: [
      { title: "Proposta comercial — Stayo" },
      {
        name: "description",
        content: "Apresentação da proposta comercial publicada pela Stayo.",
      },
    ],
  }),
  component: ProposalPortalPage,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell
      width="wide"
      framed={false}
      context="Proposta comercial"
      footer="Leia no seu tempo. Se surgir qualquer dúvida sobre a proposta, fale com a equipe Stayo."
    >
      {children}
    </PortalShell>
  );
}

function StateCard({ children }: { children: React.ReactNode }) {
  return <div className="portal-shell-surface p-5 sm:p-8">{children}</div>;
}

function ProposalPortalPage() {
  const { token } = Route.useParams();
  const proposalQuery = useQuery({
    queryKey: ["public-proposal", token],
    queryFn: () => resolvePublicProposalByToken(token),
    retry: false,
  });

  if (proposalQuery.isPending) {
    return (
      <Shell>
        <StateCard>
          <PortalSkeleton rows={5} />
        </StateCard>
      </Shell>
    );
  }

  if (proposalQuery.isError) {
    return (
      <Shell>
        <StateCard>
          <PortalEmptyState
            icon={<WifiOff aria-hidden="true" />}
            title="Não foi possível carregar a proposta"
            description="Houve uma falha de conexão com o serviço de apresentação. Nenhuma informação foi alterada."
            nextStep="Confira sua conexão e tente novamente em alguns instantes."
            action={{
              label: proposalQuery.isFetching ? "Tentando novamente…" : "Tentar novamente",
              onClick: () => {
                void proposalQuery.refetch();
              },
            }}
          />
        </StateCard>
      </Shell>
    );
  }

  if (proposalQuery.data === null) {
    return (
      <Shell>
        <StateCard>
          <PortalEmptyState
            icon={<FileWarning aria-hidden="true" />}
            title="Esta proposta não está disponível"
            description="O link é inválido, expirou, foi revogado ou não corresponde a uma apresentação publicada."
            nextStep="Peça à equipe Stayo um novo link de apresentação."
          />
        </StateCard>
      </Shell>
    );
  }

  return (
    <Shell>
      <PublicProposalPresentation snapshot={proposalQuery.data} />
    </Shell>
  );
}
