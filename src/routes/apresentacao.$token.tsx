import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { ProposalPresentationView } from "../components/implantacao/ProposalPresentationView";
import { StayoLogo } from "../components/brand/StayoLogo";
import { resolvePresentation } from "../lib/api/presentation-invites";

export const Route = createFileRoute("/apresentacao/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Proposta STAYO" },
      {
        name: "description",
        content: "Conheça a proposta de administração STAYO para o seu imóvel.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Proposta STAYO" },
      { property: "og:description", content: "Conheça a proposta de administração STAYO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PresentationPage,
});

function PresentationPage() {
  const { token } = Route.useParams();
  const q = useQuery({
    queryKey: ["public-presentation", token],
    queryFn: () => resolvePresentation(token),
    retry: false,
  });
  return (
    <main className="min-h-screen bg-[var(--stayo-bg)] px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex justify-center">
          <StayoLogo />
        </div>
        <div className="rounded-[var(--radius-card)] border border-[var(--stayo-border)] bg-[var(--stayo-surface)] p-5 shadow-sm sm:p-8">
          {q.isPending ? (
            <p className="text-sm text-[var(--stayo-ink-muted)]">Carregando proposta…</p>
          ) : q.data ? (
            <ProposalPresentationView snapshot={q.data} />
          ) : (
            <div className="text-center">
              <h1 className="text-lg font-semibold text-[var(--stayo-ink)]">Link indisponível</h1>
              <p className="mt-2 text-sm text-[var(--stayo-ink-muted)]">
                Este link expirou, foi desativado ou não existe. Peça um novo link à equipe STAYO.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
