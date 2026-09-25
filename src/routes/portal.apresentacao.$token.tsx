import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Clock, Link2Off, MessageCircle, RefreshCw, ShieldOff, WifiOff } from "lucide-react";
import type { ReactNode } from "react";

import { StayoLogo } from "../components/brand/StayoLogo";
import { formatMoney } from "../lib/format";
import { resolvePresentation } from "../lib/api/presentation-invites";
import type { CommercialProposalSnapshot } from "../types/commercial-proposal";

/**
 * Página PÚBLICA de apresentação da proposta (link do convite).
 * Somente leitura: exibe a whitelist do snapshot publicado e nada mais.
 * Não autoriza cadastro, onboarding nem aceite.
 */
export const Route = createFileRoute("/portal/apresentacao/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sua proposta STAYO" },
      { name: "description", content: "Conheça a proposta de administração STAYO para o seu imóvel." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Sua proposta STAYO" },
      { property: "og:description", content: "Conheça a proposta de administração STAYO para o seu imóvel." },
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
    staleTime: 60_000,
  });

  return (
    <main className="min-h-dvh bg-[var(--stayo-bg)] text-[var(--stayo-ink)]">
      <header className="flex justify-center px-4 pb-2 pt-6">
        <StayoLogo className="h-12 w-auto" />
      </header>
      <div className="mx-auto w-full max-w-xl px-4 pb-28 pt-2 md:max-w-2xl">
        {q.isPending ? (
          <Loading />
        ) : !q.data || q.data.state === "network" ? (
          <StateCard
            icon={<WifiOff className="size-6" />}
            title="Sem conexão no momento"
            text="Não conseguimos carregar a proposta. Verifique sua internet e tente de novo."
            action={
              <button
                type="button"
                onClick={() => void q.refetch()}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--stayo-forest-strong)] px-5 py-2.5 text-sm font-semibold text-[var(--stayo-surface)]"
              >
                <RefreshCw className="size-4" /> Tentar de novo
              </button>
            }
          />
        ) : q.data.state === "expired" ? (
          <StateCard
            icon={<Clock className="size-6" />}
            title="Este link expirou"
            text="O prazo deste link terminou. Peça um novo link a quem enviou a proposta."
          />
        ) : q.data.state === "revoked" ? (
          <StateCard
            icon={<ShieldOff className="size-6" />}
            title="Este link foi desativado"
            text="Existe uma versão mais recente ou o link foi encerrado. Peça o link atualizado a quem enviou a proposta."
          />
        ) : q.data.state === "invalid" ? (
          <StateCard
            icon={<Link2Off className="size-6" />}
            title="Link inválido"
            text="Não encontramos uma proposta para este endereço. Confira se o link foi copiado por inteiro."
          />
        ) : (
          <Presentation snapshot={q.data.snapshot} />
        )}
      </div>
    </main>
  );
}

function Loading() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Carregando proposta">
      {[140, 90, 180].map((h) => (
        <div
          key={h}
          className="animate-pulse rounded-2xl bg-[var(--stayo-surface)]"
          style={{ height: h }}
        />
      ))}
    </div>
  );
}

function StateCard({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <section className="mt-6 rounded-2xl border border-[var(--stayo-border)] bg-[var(--stayo-surface)] px-6 py-10 text-center shadow-sm">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--stayo-bg)] text-[var(--stayo-ink-muted)]">
        {icon}
      </div>
      <h1 className="mt-4 text-lg font-semibold">{title}</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--stayo-ink-muted)]">{text}</p>
      {action}
    </section>
  );
}

function Presentation({ snapshot }: { snapshot: CommercialProposalSnapshot }) {
  const c = snapshot.contractConditions ?? {};
  const conditions = (
    [
      ["Taxa de administração", c.administrationFee != null ? `${c.administrationFee}%` : null],
      ["Limpeza", c.cleaningResponsibility ?? null],
      ["Repasse", c.payoutRule ?? null],
      ["Manutenção sem autorização", c.maintenanceLimit != null ? `até ${formatMoney(c.maintenanceLimit)}` : null],
      ["Vigência", c.durationMonths ? `${c.durationMonths} meses` : null],
      ["Aviso prévio", c.noticePeriodDays ? `${c.noticePeriodDays} dias` : null],
    ] as Array<[string, string | null]>
  ).filter(([, v]) => v);
  const content = [...(snapshot.content ?? [])].sort((a, b) => a.displayOrder - b.displayOrder);
  const items = snapshot.items ?? [];
  const published = snapshot.publishedAt
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(
        new Date(snapshot.publishedAt),
      )
    : null;

  return (
    <article className="space-y-4">
      <section className="rounded-2xl bg-[var(--stayo-forest-strong)] px-5 py-6 text-[var(--stayo-surface)] shadow-sm sm:px-7">
        <p className="text-xs uppercase tracking-[0.16em] opacity-75">
          Proposta · versão {snapshot.version}
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
          {snapshot.opportunity?.title || "Sua proposta STAYO"}
        </h1>
        {published && <p className="mt-2 text-sm opacity-75">Publicada em {published}</p>}
        {items.length > 0 && (
          <div className="mt-5 border-t border-white/15 pt-4">
            <p className="text-xs opacity-75">Investimento inicial</p>
            <p className="text-3xl font-semibold">{formatMoney(snapshot.total)}</p>
          </div>
        )}
      </section>

      {content.map((block, i) => (
        <Card key={i} title={block.title}>
          <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--stayo-ink-muted)]">
            {block.body}
          </p>
        </Card>
      ))}

      {items.length > 0 && (
        <Card title="O que está incluído">
          <ul className="divide-y divide-[var(--stayo-border)]">
            {items.map((item, i) => (
              <li key={i} className="flex items-start justify-between gap-4 py-2.5 text-sm">
                <span>
                  {item.quantity > 1 ? `${item.quantity}× ` : ""}
                  {item.description}
                </span>
                <span className="shrink-0 font-semibold">{formatMoney(item.total)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {conditions.length > 0 && (
        <Card title="Condições">
          <dl className="grid gap-x-6 sm:grid-cols-2">
            {conditions.map(([k, v]) => (
              <div key={k} className="border-b border-[var(--stayo-border)] py-2.5 text-sm last:border-0">
                <dt className="text-xs text-[var(--stayo-ink-muted)]">{k}</dt>
                <dd className="mt-0.5 font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      {snapshot.responsibilities?.length > 0 && (
        <Card title="Como a STAYO cuida do seu imóvel">
          <ul className="space-y-2 text-sm text-[var(--stayo-ink-muted)]">
            {snapshot.responsibilities.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--stayo-forest)]" />
                {r}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-[var(--stayo-border)] bg-[var(--stayo-surface)]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-3 md:max-w-2xl">
          <MessageCircle className="size-5 shrink-0 text-[var(--stayo-forest)]" />
          <p className="text-sm">
            <strong>Próximo passo:</strong> responda a mensagem que você recebeu para tirar dúvidas
            ou seguir com o cadastro.
          </p>
        </div>
      </div>
    </article>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--stayo-border)] bg-[var(--stayo-surface)] px-5 py-5 shadow-sm sm:px-7">
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}
