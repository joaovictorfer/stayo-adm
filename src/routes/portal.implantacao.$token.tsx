import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { OwnerJourney } from "../components/portal/OwnerJourney";
import { PortalShell, PortalSkeleton } from "../components/portal/PortalExperience";
import { ownerOnboardingLinkByTokenQuery } from "../lib/api/queries";
import { ownerOnboardingLinkStatus } from "../types/owner-onboarding";

export const Route = createFileRoute("/portal/implantacao/$token")({
  head: ({ params }) => {
    const pageUrl = `https://adm.stayogramado.com.br/portal/implantacao/${encodeURIComponent(params.token)}`;
    const imageUrl = `https://adm.stayogramado.com.br/api/public/owner-cover/${encodeURIComponent(params.token)}`;
    const title = "Sua jornada com a STAYO";
    const description = "Acompanhe a implantação e as informações do seu imóvel com a STAYO.";

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: pageUrl },
        { property: "og:image", content: imageUrl },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:alt", content: "Imóvel acompanhado pela STAYO" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: imageUrl },
      ],
      links: [{ rel: "canonical", href: pageUrl }],
    };
  },
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
      <OwnerJourney implementationId={linkQuery.data.implementationId} token={token} />
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
