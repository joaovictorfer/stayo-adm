import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { OwnerOnboardingJourney } from "../components/portal/OwnerOnboardingJourney";
import { PortalShell, PortalSkeleton } from "../components/portal/PortalExperience";
import { ownerOnboardingLinkByTokenQuery } from "../lib/api/queries";
import { ownerOnboardingLinkStatus } from "../types/owner-onboarding";

export const Route = createFileRoute("/portal/implantacao/$token")({
  head: () => ({
    meta: [
      { title: "Sua jornada com a STAYO" },
      {
        name: "description",
        content: "Confira sua proposta, complete seus dados e prepare seu acesso à STAYO.",
      },
      { property: "og:title", content: "Sua jornada com a STAYO" },
      {
        property: "og:description",
        content: "Proposta, cadastro do proprietário, imóvel e acesso em um único lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OwnerJourneyPortalPage,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell
      width="medium"
      context="Jornada do proprietário"
      footer="STAYO · Gestão profissional para seu imóvel"
      framed={false}
      showBrand={false}
    >
      {children}
    </PortalShell>
  );
}

function OwnerJourneyPortalPage() {
  const { token } = Route.useParams();
  const linkQuery = useQuery(ownerOnboardingLinkByTokenQuery(token));

  if (linkQuery.isPending)
    return (
      <Shell>
        <PortalSkeleton />
      </Shell>
    );

  if (linkQuery.isError)
    return (
      <AccessMessage
        title="Não conseguimos confirmar este acesso agora"
        text="Nada foi alterado. Verifique sua conexão e tente novamente em alguns instantes."
      />
    );

  if (!linkQuery.data)
    return (
      <AccessMessage
        title="Este acesso não está disponível"
        text="Não conseguimos reconhecer este link. Peça um novo acesso à equipe STAYO."
      />
    );

  const status = ownerOnboardingLinkStatus(linkQuery.data);
  if (status === "expirado" || status === "revogado")
    return (
      <AccessMessage
        title={status === "expirado" ? "Este acesso venceu" : "Este acesso foi encerrado"}
        text="Seus dados continuam protegidos. Peça um novo link à equipe STAYO para continuar."
      />
    );

  return (
    <Shell>
      <OwnerOnboardingJourney implementationId={linkQuery.data.implementationId} token={token} />
    </Shell>
  );
}

function AccessMessage({ title, text }: { title: string; text: string }) {
  return (
    <Shell>
      <div className="mx-auto max-w-lg px-5 py-12 text-center sm:px-8">
        <h1 className="text-xl font-semibold text-[var(--portal-navy)]">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--portal-muted)]">{text}</p>
      </div>
    </Shell>
  );
}
