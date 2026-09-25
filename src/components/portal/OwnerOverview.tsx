import {
  ArrowRight,
  CalendarClock,
  FileSignature,
  RefreshCw,
  Video,
  MapPin,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

import type { OverviewContent, ProposalContent } from "../../lib/api/portal-visibility";
import { formatMoney } from "../../lib/format";

export interface OverviewTask {
  id: string;
  title: string;
  kind: string;
}
export interface OverviewEvent {
  id: string;
  title: string;
  date: string;
}
export interface OverviewMeeting {
  startsAt: string;
  timeZone: string;
  mode: "video" | "in_person";
  joinUrl: string | null;
  hasJoinUrl: boolean;
}

type Q<T> = { data: T | undefined; isPending: boolean; isError: boolean; refetch: () => unknown };

const taskTab: Record<string, { tab: string; label: string }> = {
  banking_data: { tab: "dados", label: "Informar dados de repasse" },
  regulation_document: { tab: "documentos", label: "Enviar documento" },
  wifi_info: { tab: "property", label: "Completar dados do imóvel" },
};

const fmtDay = (v: string, tz = "America/Sao_Paulo") =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: tz }).format(
    new Date(v),
  );
const fmtMeeting = (v: string, tz: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz || "America/Sao_Paulo",
  }).format(new Date(v));

/**
 * Visão geral: etapa, o que a STAYO está fazendo, o que o proprietário precisa
 * fazer e o próximo contato. Só dados reais; blocos liberados aparecem só
 * quando liberados; erro nunca vira "sem pendência".
 */
export function OwnerOverview({
  propertyLabel,
  stageLabel,
  stageMessage,
  tasks,
  timeline,
  meeting,
  releasedOverview,
  releasedProposal,
  releasesLoading,
  goTo,
}: {
  propertyLabel: string;
  stageLabel: string;
  stageMessage: string;
  tasks: Q<OverviewTask[]>;
  timeline: Q<OverviewEvent[]>;
  meeting: Q<OverviewMeeting | null>;
  releasedOverview: OverviewContent | undefined;
  releasedProposal: ProposalContent | undefined;
  releasesLoading: boolean;
  goTo: (tab: string) => void;
}) {
  const pending = tasks.data ?? [];
  const first = pending[0];
  const nextMeeting = meeting.data ?? null;
  const nextUpdate = nextMeeting
    ? `Nosso próximo contato é a reunião de ${fmtMeeting(nextMeeting.startsAt, nextMeeting.timeZone)}.`
    : releasedOverview?.nextStep
      ? releasedOverview.nextStep
      : "Quando houver novidade, avisamos por aqui e pelo WhatsApp.";

  return (
    <div className="owner-overview">
      {/* 1. Onde estamos */}
      <section className="owner-overview-stage" aria-label="Etapa atual">
        <p className="owner-overview-eyebrow">{propertyLabel}</p>
        <p className="owner-overview-stage-name">
          Etapa atual: <strong>{stageLabel}</strong>
        </p>
        <p className="owner-overview-muted">{releasedOverview?.message ?? stageMessage}</p>
      </section>

      {/* 2. Seu próximo passo */}
      <section className="owner-overview-next" aria-live="polite">
        <p className="owner-overview-eyebrow">Seu próximo passo</p>
        {tasks.isPending ? (
          <Skeleton lines={2} />
        ) : tasks.isError ? (
          <ErrorLine
            text="Não conseguimos verificar suas pendências agora. Isso não quer dizer que está tudo em dia."
            onRetry={tasks.refetch}
          />
        ) : first ? (
          <>
            <h2 className="owner-overview-title">{first.title}</h2>
            {pending.length > 1 && (
              <p className="owner-overview-muted">E mais {pending.length - 1} depois desta.</p>
            )}
            <button
              type="button"
              className="owner-overview-cta portal-action"
              onClick={() => goTo(taskTab[first.kind]?.tab ?? "dados")}
            >
              {taskTab[first.kind]?.label ?? "Resolver agora"}{" "}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </>
        ) : (
          <>
            <h2 className="owner-overview-title">Por enquanto, está tudo com a equipe STAYO.</h2>
            <p className="owner-overview-muted">
              {meeting.isError
                ? "Quando houver novidade, avisamos por aqui e pelo WhatsApp."
                : nextUpdate}
            </p>
          </>
        )}
      </section>

      {/* 4. Próxima reunião */}
      {meeting.isError ? (
        <ErrorLine text="Não conseguimos consultar a agenda agora." onRetry={meeting.refetch} />
      ) : nextMeeting ? (
        <Block icon={<CalendarClock />} title="Próxima reunião">
          <p className="font-medium capitalize">
            {fmtMeeting(nextMeeting.startsAt, nextMeeting.timeZone)}
          </p>
          <p className="owner-overview-muted flex items-center gap-1.5">
            {nextMeeting.mode === "video" ? (
              <Video className="h-3.5 w-3.5" />
            ) : (
              <Users className="h-3.5 w-3.5" />
            )}
            {nextMeeting.mode === "video" ? "Por vídeo" : "Presencial"}
          </p>
          {nextMeeting.joinUrl ? (
            <a
              href={nextMeeting.joinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="owner-overview-cta portal-action mt-3"
            >
              Entrar no Google Meet <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          ) : nextMeeting.hasJoinUrl ? (
            <p className="owner-overview-muted mt-2">
              O link da reunião aparece aqui 2 horas antes.
            </p>
          ) : null}
        </Block>
      ) : null}

      {/* 3. Linha do tempo breve */}
      <Block icon={<MapPin />} title="Até aqui">
        {timeline.isPending ? (
          <Skeleton lines={3} />
        ) : timeline.isError ? (
          <ErrorLine
            text="Não conseguimos carregar o histórico agora."
            onRetry={timeline.refetch}
          />
        ) : (timeline.data ?? []).length === 0 ? (
          <p className="owner-overview-muted">Os marcos da sua implantação vão aparecer aqui.</p>
        ) : (
          <ol className="owner-overview-timeline">
            {(timeline.data ?? []).slice(0, 4).map((e) => (
              <li key={e.id}>
                <time dateTime={e.date}>{fmtDay(e.date)}</time>
                <span>{e.title}</span>
              </li>
            ))}
          </ol>
        )}
        {(timeline.data ?? []).length > 4 && (
          <button type="button" className="owner-overview-link" onClick={() => goTo("implantacao")}>
            Ver tudo
          </button>
        )}
      </Block>

      {/* 5. Proposta, só se liberada */}
      {!releasesLoading && releasedProposal && (
        <Block icon={<FileSignature />} title="Sua proposta">
          <p className="font-medium">
            Versão {releasedProposal.snapshot.version}
            {releasedProposal.snapshot.items?.length
              ? ` · ${formatMoney(releasedProposal.snapshot.total)}`
              : ""}
          </p>
          <button type="button" className="owner-overview-link" onClick={() => goTo("proposta")}>
            Ver proposta
          </button>
        </Block>
      )}
    </div>
  );
}

function Block({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="owner-overview-block">
      <h3>
        <span aria-hidden="true">{icon}</span>
        {title}
      </h3>
      <div>{children}</div>
    </section>
  );
}

function Skeleton({ lines }: { lines: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="portal-skeleton h-4 rounded" style={{ width: `${90 - i * 18}%` }} />
      ))}
    </div>
  );
}

function ErrorLine({ text, onRetry }: { text: string; onRetry: () => unknown }) {
  return (
    <div className="owner-overview-error" role="alert">
      <p>{text}</p>
      <button type="button" onClick={() => void onRetry()}>
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Tentar de novo
      </button>
    </div>
  );
}
