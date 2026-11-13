import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  FileText,
  LogOut,
  Download,
  CheckCircle2,
  ClipboardList,
  Key,
  User,
  FileSignature,
  Sparkles,
  Circle,
  LockKeyhole,
  CalendarDays,
  ArrowRight,
  Clock3,
  Eye,
  BadgeCheck,
  History,
  FileCheck2,
  FileImage,
  ExternalLink,
  ShieldCheck,
  BellRing,
  CircleCheckBig,
  CalendarRange,
  House,
  ClipboardCheck,
  Wrench,
  WalletCards,
  BedDouble,
  TrendingUp,
  RefreshCw,
  WifiOff,
  ChevronDown,
  MapPin,
  Wifi,
  DoorOpen,
  Building2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { StayoLogo } from "@/components/brand/StayoLogo";
import { toast } from "sonner";

import portalPropertyFallback from "../assets/owner-portal-property-fallback.jpg";
import { useOwnerCoverForImplementation } from "../hooks/use-owner-cover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { PostalCodeInput } from "../components/ui/postal-code-input";
import {
  OwnerWelcomeOverlay,
  PortalEmptyState,
  PortalShell,
  PortalSkeleton,
  useOwnerWelcomeState,
} from "../components/portal/PortalExperience";
import { getAttachmentSignedUrl, listOwnerAttachments } from "../lib/api/attachments";
import {
  listActiveReleases,
  type DocumentsContent,
  type OverviewContent,
  type ProposalContent,
} from "../lib/api/portal-visibility";
import { ReleasedOverview, ReleasedProposal } from "../components/portal/ReleasedBlocks";
import { OwnerOverview, type OverviewMeeting } from "../components/portal/OwnerOverview";
import { getSupabaseBrowserClient } from "../lib/api/supabase-client";
import type { Attachment } from "../lib/api/attachments";
import {
  commercialTermsQuery,
  ownerOnboardingSubmissionQuery,
  ownerQuery,
  ownerTasksQuery,
  proposalsByImplementationQuery,
  proposalShareLinkQuery,
  propertyQuery,
  reservationsListQuery,
} from "../lib/api/queries";
import {
  getPropertyDetails,
  listOwnerImplementations,
  listPortalInspections,
  listPortalTimeline,
  savePropertyDetails,
  type PortalInspection,
  type PortalTimelineEvent,
  type PropertyDetails,
  type PropertyDetailsInput,
} from "../lib/api/owner-portal-data";
import {
  isSupabaseConfigured,
  ownerSignOut,
  useOwnerSession,
  type OwnerPortalAccount,
} from "../lib/auth/owner-session";
import {
  maskOwnerDocument,
  ownerPortalPermissions,
  ownerRoleLabels,
} from "../lib/owner-permissions";
import { statusLabels } from "../lib/implementation-status";
import {
  getOwnerPortalModules,
  getOwnerPortalPhase,
  type OwnerPortalModule,
  type OwnerPortalPhase,
} from "../lib/owner-portal-lifecycle";
import type { OwnerTaskStatus } from "../types/admin";
import type { CommercialTerm } from "../types/admin";
import type { ImplementationProject, ImplementationStatus, Proposal } from "../types/core";
import { OwnerDashboard } from "../components/portal/OwnerDashboard";
import { OwnerWorkspace } from '@/components/portal/OwnerWorkspace';
import { readAccountOwnerWorkspace } from '@/lib/api/core-client';

export const Route = createFileRoute("/portal/inicio")({
  head: () => ({
    meta: [
      { title: "Meu imóvel — Portal do Proprietário Stayo" },
      {
        name: "description",
        content:
          "Acompanhe sua implantação, documentos e operação no Portal do Proprietário Stayo.",
      },
      { property: "og:title", content: "Meu imóvel — Portal do Proprietário Stayo" },
      {
        property: "og:description",
        content:
          "Acompanhe sua implantação, documentos e operação no Portal do Proprietário Stayo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OwnerHomePage,
});

const ownerTaskKindLabels: Record<string, string> = {
  banking_data: "Dados para repasse",
  wifi_info: "Wi-Fi",
  regulation_document: "Documento de regularização",
  custom: "Informação adicional",
};

const ownerTaskStatusLabels: Record<OwnerTaskStatus, string> = {
  pending: "Pendente",
  done: "Resolvida",
  dismissed: "Não necessária",
};

const stageMessages: Record<ImplementationStatus, string> = {
  prospect: "Estamos conhecendo seu imóvel e organizando os primeiros passos.",
  proposta: "Estamos preparando as condições para iniciarmos esta parceria.",
  aguardando_aprovacao: "Sua proposta está pronta para análise e aprovação.",
  aprovado: "A proposta foi aprovada e agora vamos organizar a preparação do imóvel.",
  planejamento: "Estamos coordenando os detalhes para começar a preparação do imóvel.",
  em_implantacao: "Seu imóvel está sendo preparado para receber os primeiros hóspedes.",
  validacao: "Estamos revisando os últimos detalhes antes de colocar o imóvel em operação.",
  pronto_para_operacao: "Seu imóvel está pronto para começar a receber hóspedes.",
  ativo: "Seu imóvel está em operação e sendo acompanhado pela equipe Stayo.",
  pausado: "A preparação está pausada; avisaremos assim que houver uma nova atualização.",
  nao_convertido: "A equipe Stayo está revisando os próximos passos desta implantação.",
  cancelado: "Esta implantação foi encerrada. Fale com a equipe Stayo se precisar de ajuda.",
};

const ownerMilestones = [
  { label: "Proposta", description: "Condições apresentadas e aprovação da parceria." },
  { label: "Planejamento", description: "Organização das etapas, responsáveis e previsão." },
  {
    label: "Preparação do imóvel",
    description: "Ajustes necessários para receber os primeiros hóspedes.",
  },
  { label: "Configuração", description: "Cadastro e configuração da operação do imóvel." },
  { label: "Validação", description: "Revisão final dos padrões de qualidade Stayo." },
  { label: "Pronto para operar", description: "Imóvel liberado para começar a receber hóspedes." },
] as const;

function ownerMilestoneIndex(status: ImplementationStatus): number {
  if (["prospect", "proposta", "aguardando_aprovacao"].includes(status)) return 0;
  if (["aprovado", "planejamento"].includes(status)) return 1;
  if (status === "em_implantacao") return 2;
  if (status === "validacao") return 4;
  if (["pronto_para_operacao", "ativo"].includes(status)) return 5;
  return 0;
}

function OwnerMilestones({ status }: { status: ImplementationStatus }) {
  const activeIndex = ownerMilestoneIndex(status);
  const isComplete = status === "ativo";
  const isBlocked = ["pausado", "nao_convertido", "cancelado"].includes(status);

  return (
    <section className="portal-milestones" aria-labelledby="owner-milestones-title">
      <div className="portal-milestones-heading">
        <div>
          <p className="portal-milestones-eyebrow">Acompanhamento</p>
          <h2 id="owner-milestones-title">Próximos marcos</h2>
        </div>
        <span className={`portal-milestones-summary${isBlocked ? " is-blocked" : ""}`}>
          {isBlocked
            ? statusLabels[status]
            : isComplete
              ? "Etapas concluídas"
              : `${activeIndex + 1} de ${ownerMilestones.length}`}
        </span>
      </div>

      <ol className="portal-milestones-list">
        {ownerMilestones.map((milestone, index) => {
          const state =
            isBlocked && index === activeIndex
              ? "blocked"
              : isComplete || index < activeIndex
                ? "done"
                : index === activeIndex
                  ? "current"
                  : "future";
          const stateLabel =
            state === "done"
              ? "Concluída"
              : state === "current"
                ? "Etapa atual"
                : state === "blocked"
                  ? "Bloqueada"
                  : "Próxima etapa";

          return (
            <li
              key={milestone.label}
              className={`portal-milestone is-${state}`}
              title={milestone.description}
            >
              <div className="portal-milestone-track" aria-hidden="true">
                <span className="portal-milestone-line" />
                <span className="portal-milestone-marker">
                  {state === "done" ? (
                    <CheckCircle2 />
                  ) : state === "blocked" ? (
                    <LockKeyhole />
                  ) : (
                    <Circle />
                  )}
                </span>
              </div>
              <div className="portal-milestone-copy">
                <span className="portal-milestone-state">{stateLabel}</span>
                <h3>{milestone.label}</h3>
                <p>{milestone.description}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function formatPortalDate(value: string | null): string {
  if (!value) return "A definir com você";
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "A definir com você";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function ImplementationJourney({ implementation }: { implementation: ImplementationProject }) {
  const activeIndex = ownerMilestoneIndex(implementation.status);
  const isComplete = implementation.status === "ativo";
  const isBlocked = ["pausado", "nao_convertido", "cancelado"].includes(implementation.status);
  const completed = isComplete ? ownerMilestones : ownerMilestones.slice(0, activeIndex);
  const nextSteps = isComplete
    ? []
    : ownerMilestones.slice(activeIndex, Math.min(activeIndex + 3, ownerMilestones.length));
  const currentMilestone = ownerMilestones[activeIndex];

  return (
    <div className="portal-implementation-journey">
      <section className={`portal-current-stage${isBlocked ? " is-blocked" : ""}`}>
        <div className="portal-current-stage-copy">
          <p className="portal-milestones-eyebrow">Etapa atual</p>
          <h2>{statusLabels[implementation.status]}</h2>
          <p>{stageMessages[implementation.status]}</p>
        </div>
        <div className="portal-current-stage-dates" aria-label="Datas previstas da implantação">
          <div>
            <CalendarDays aria-hidden="true" />
            <span>Início estimado</span>
            <strong>{formatPortalDate(implementation.startDateEstimate)}</strong>
          </div>
          <div>
            <Clock3 aria-hidden="true" />
            <span>Previsão de conclusão</span>
            <strong>{formatPortalDate(implementation.completionDateEstimate)}</strong>
          </div>
        </div>
      </section>

      <OwnerMilestones status={implementation.status} />

      <div className="portal-journey-columns">
        <section className="portal-journey-panel" aria-labelledby="completed-steps-title">
          <div className="portal-journey-panel-heading">
            <span className="portal-journey-panel-icon is-complete">
              <CheckCircle2 aria-hidden="true" />
            </span>
            <div>
              <h2 id="completed-steps-title">O que já foi feito</h2>
              <p>Veja tudo o que já avançamos juntos.</p>
            </div>
          </div>
          {completed.length > 0 ? (
            <ul className="portal-journey-list">
              {completed.map((milestone) => (
                <li key={milestone.label}>
                  <CheckCircle2 aria-hidden="true" />
                  <div>
                    <strong>{milestone.label}</strong>
                    <span>{milestone.description}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="portal-journey-note">
              Estamos organizando o primeiro marco. Você verá cada avanço por aqui.
            </p>
          )}
        </section>

        <section className="portal-journey-panel" aria-labelledby="next-steps-title">
          <div className="portal-journey-panel-heading">
            <span className="portal-journey-panel-icon">
              <ArrowRight aria-hidden="true" />
            </span>
            <div>
              <h2 id="next-steps-title">Próximos passos</h2>
              <p>O que estamos preparando a partir de agora.</p>
            </div>
          </div>
          {nextSteps.length > 0 ? (
            <ol className="portal-journey-list is-next">
              {nextSteps.map((milestone, index) => (
                <li key={milestone.label}>
                  <span className="portal-journey-number">{index + 1}</span>
                  <div>
                    <strong>
                      {milestone.label}
                      {index === 0 && !isBlocked ? " · agora" : ""}
                    </strong>
                    <span>
                      {index === 0 && isBlocked
                        ? stageMessages[implementation.status]
                        : milestone.description}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="portal-journey-note">
              A implantação foi concluída. O acompanhamento continua na área do seu imóvel.
            </p>
          )}
        </section>
      </div>

      <p className="portal-journey-context">
        {isBlocked
          ? "A equipe Stayo está acompanhando esta situação e compartilhará a próxima atualização por aqui."
          : isComplete
            ? "Seu imóvel concluiu a implantação e agora segue acompanhado pela operação Stayo."
            : `Agora, nosso foco é ${(currentMilestone?.label ?? statusLabels[implementation.status]).toLocaleLowerCase("pt-BR")}. Esta página será atualizada a cada novo avanço.`}
      </p>
    </div>
  );
}

interface ProfileStep {
  label: string;
  description: string;
  complete: boolean;
}

function OwnerDataJourney({
  name,
  email,
  phone,
  document,
  pendingKinds,
  onReviewPending,
}: {
  name: string | null | undefined;
  email: string | null | undefined;
  phone: string | null | undefined;
  document: string | null | undefined;
  /** Tipos de pendência abertos pela equipe; dados bancários/documentos só entram quando pedidos. */
  pendingKinds: string[];
  onReviewPending: () => void;
}) {
  const steps: (ProfileStep & { minutes: string; fields: string })[] = [
    {
      label: "Identificação",
      description: "Quem é o proprietário",
      fields: "Nome completo e CPF ou CNPJ",
      minutes: "1 min",
      complete: Boolean(name && document),
    },
    {
      label: "Contato",
      description: "Como falamos com você",
      fields: "E-mail e telefone",
      minutes: "1 min",
      complete: Boolean(email && phone),
    },
  ];
  if (pendingKinds.includes("banking_data"))
    steps.push({
      label: "Conta para repasse",
      description: "Pedido pela equipe STAYO",
      fields: "Banco ou chave PIX do titular",
      minutes: "2 min",
      complete: false,
    });
  if (pendingKinds.includes("regulation_document"))
    steps.push({
      label: "Documentos",
      description: "Pedido pela equipe STAYO",
      fields: "Arquivos solicitados",
      minutes: "3 min",
      complete: false,
    });
  const current = steps.find((step) => !step.complete);

  return (
    <section className="portal-profile-journey" aria-labelledby="profile-journey-title">
      <div className="portal-profile-intro">
        <div>
          <p className="portal-milestones-eyebrow">Meus dados</p>
          <h2 id="profile-journey-title">Seu cadastro, passo a passo</h2>
          <p>Só pedimos o essencial agora. Outras informações entram quando forem necessárias.</p>
        </div>
      </div>

      {current ? (
        <div className="portal-profile-next">
          <div>
            <span>Etapa atual · cerca de {current.minutes}</span>
            <strong>{current.label}</strong>
            <p>{current.fields}.</p>
          </div>
          <Button
            type="button"
            onClick={onReviewPending}
            className="portal-action min-h-11 bg-[var(--portal-navy)] text-[var(--portal-hero-foreground)] hover:bg-[var(--portal-navy-strong)]"
          >
            Ver o que falta <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="portal-profile-success" role="status">
          <CheckCircle2 aria-hidden="true" />
          <div>
            <strong>Cadastro em dia</strong>
            <p>Sua ficha tem o que precisamos agora. Se faltar algo, avisamos você.</p>
          </div>
        </div>
      )}

      <ol className="portal-profile-checklist is-compact">
        {steps.map((step, index) => (
          <li
            key={step.label}
            aria-current={current?.label === step.label ? "step" : undefined}
            className={
              step.complete
                ? "is-complete"
                : current?.label === step.label
                  ? "is-current"
                  : "is-pending"
            }
          >
            <span className="portal-profile-step-marker">
              {step.complete ? <CheckCircle2 aria-hidden="true" /> : index + 1}
            </span>
            <div>
              <strong>{step.label}</strong>
              {current?.label === step.label && <p>{step.description}</p>}
            </div>
            <span className="portal-profile-step-status">
              {step.complete ? "Na sua ficha" : current?.label === step.label ? "Agora" : "Depois"}
            </span>
          </li>
        ))}
      </ol>

      <p className="portal-profile-save-note">
        <Clock3 aria-hidden="true" /> Pode continuar depois. O que já está na sua ficha fica
        guardado.
      </p>
    </section>
  );
}

const portalCurrency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function describeCommercialTerm(term: CommercialTerm): string {
  if (term.chargeType === "percentage") return `${term.value}%`;
  if (["fixed_once", "per_reservation", "monthly"].includes(term.chargeType))
    return portalCurrency.format(term.value);
  if (term.chargeType === "optional") return "Opcional";
  return term.notes || "Incluído";
}

function OwnerProposal({
  proposal,
  versions,
  terms,
  shareToken,
}: {
  proposal: Proposal;
  versions: Proposal[];
  terms: CommercialTerm[];
  shareToken: string | undefined;
}) {
  const proposalUrl = shareToken ? `/portal/proposta/${encodeURIComponent(shareToken)}` : null;

  return (
    <section className="portal-proposal-showcase" aria-labelledby="owner-proposal-title">
      <div className="portal-proposal-heading">
        <div>
          <p className="portal-milestones-eyebrow">Proposta comercial</p>
          <h2 id="owner-proposal-title">Uma proposta pensada para o seu imóvel</h2>
          <p>
            Confira valores e condições no seu tempo. Se surgir qualquer dúvida, estamos por perto.
          </p>
        </div>
        <span className={`portal-proposal-status${proposal.acceptedAt ? " is-accepted" : ""}`}>
          {proposal.acceptedAt ? <BadgeCheck aria-hidden="true" /> : <Clock3 aria-hidden="true" />}
          {proposal.acceptedAt ? "Aceita" : "Pronta para você"}
        </span>
      </div>

      <div className="portal-proposal-summary">
        <div className="portal-proposal-total">
          <span>Valor da proposta</span>
          <strong>{portalCurrency.format(proposal.total)}</strong>
          <small>
            Versão {proposal.version} ·{" "}
            {new Intl.DateTimeFormat("pt-BR").format(new Date(proposal.createdAt))}
          </small>
        </div>
        <div className="portal-proposal-terms">
          <span>Condições principais</span>
          {terms.length > 0 ? (
            <ul>
              {terms.slice(0, 4).map((term) => (
                <li key={term.id}>
                  <strong>{term.label}</strong>
                  <span>{describeCommercialTerm(term)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>As condições completas estão organizadas no documento da proposta.</p>
          )}
        </div>
      </div>

      <div className="portal-proposal-actions">
        {proposalUrl ? (
          <Button
            asChild
            className="portal-action bg-[var(--portal-navy)] text-[var(--portal-hero-foreground)] hover:bg-[var(--portal-navy-strong)]"
          >
            <a href={proposalUrl}>
              <Eye className="h-4 w-4" /> Ver proposta completa
            </a>
          </Button>
        ) : (
          <p>
            O documento está sendo preparado para visualização. Avisaremos assim que estiver
            disponível.
          </p>
        )}
        {!proposal.acceptedAt && proposalUrl && (
          <span>Você poderá confirmar o aceite depois de conferir todos os detalhes.</span>
        )}
        {proposal.acceptedAt && (
          <span>
            Aceita em {new Intl.DateTimeFormat("pt-BR").format(new Date(proposal.acceptedAt))}.
          </span>
        )}
      </div>

      {versions.length > 1 && (
        <details className="portal-proposal-history">
          <summary>
            <History aria-hidden="true" /> Histórico de versões <span>{versions.length}</span>
          </summary>
          <ol>
            {versions.map((version) => (
              <li key={version.id}>
                <div>
                  <strong>Versão {version.version}</strong>
                  <span>
                    {new Intl.DateTimeFormat("pt-BR").format(new Date(version.createdAt))}
                  </span>
                </div>
                <span>{portalCurrency.format(version.total)}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}

const documentCategoryLabels: Record<string, string> = {
  contract: "Contrato",
  proposal: "Proposta",
  identity: "Identificação",
  property: "Imóvel",
  regulation: "Regularização",
  banking: "Dados para repasse",
  inspection: "Vistoria",
  other: "Documento",
};

function documentType(attachment: Attachment): string {
  return (
    documentCategoryLabels[attachment.category.toLowerCase()] ??
    attachment.category.replace(/[_-]/g, " ")
  );
}

function DocumentIcon({ attachment }: { attachment: Attachment }) {
  return attachment.mimeType.startsWith("image/") ? (
    <FileImage aria-hidden="true" />
  ) : (
    <FileCheck2 aria-hidden="true" />
  );
}

const moduleTabValue: Partial<Record<OwnerPortalModule, string>> = {
  overview: "visao-geral",
  implementation: "implantacao",
  profile: "dados",
  proposal: "proposta",
  documents: "documentos",
};
const tabValueOf = (module: OwnerPortalModule) => moduleTabValue[module] ?? module;

const portalModuleShortLabels: Partial<Record<OwnerPortalModule, string>> = {
  implementation: "Implantação",
  property: "Imóvel",
  profile: "Dados",
  documents: "Docs",
};

const portalModuleLabels: Record<OwnerPortalModule, string> = {
  overview: "Visão geral",
  implementation: "Minha implantação",
  profile: "Meus dados",
  proposal: "Proposta",
  reservations: "Reservas",
  calendar: "Calendário",
  property: "Meu imóvel",
  inspections: "Vistorias",
  maintenance: "Manutenções",
  finance: "Financeiro",
  documents: "Documentos",
};

function PortalPhaseIndicator({ phase }: { phase: OwnerPortalPhase }) {
  const activeIndex = phase === "implementation" ? 0 : phase === "ready" ? 1 : 2;
  const labels = ["Implantação", "Pronto para operar", "Em operação"];
  const hint = (index: number) =>
    index < activeIndex
      ? "Concluída"
      : index === activeIndex
        ? "Etapa atual"
        : "Ainda não iniciada";
  return (
    <div className="portal-phase-indicator" aria-label={`Etapa atual: ${labels[activeIndex]}`}>
      {labels.map((label, index) => (
        <div
          key={label}
          aria-current={index === activeIndex ? "step" : undefined}
          className={
            index < activeIndex ? "is-complete" : index === activeIndex ? "is-current" : "is-future"
          }
        >
          <span>{index < activeIndex ? <CheckCircle2 aria-hidden="true" /> : index + 1}</span>
          <strong>
            {label}
            <small className="block text-[10px] font-normal opacity-70">{hint(index)}</small>
          </strong>
        </div>
      ))}
    </div>
  );
}

function ReadyTransition({ implementation }: { implementation: ImplementationProject }) {
  return (
    <section className="portal-transition-banner">
      <span className="portal-transition-icon">
        <Sparkles aria-hidden="true" />
      </span>
      <div>
        <p className="portal-milestones-eyebrow">Próximo momento</p>
        <h2>A implantação está na reta final.</h2>
        <p>
          A operação ainda não começou. Ela só começa depois da ativação feita pela equipe Stayo,
          quando o imóvel for registrado oficialmente. Até lá, reservas e financeiro não aparecem
          aqui.
        </p>
      </div>
      <dl>
        <div>
          <dt>Ativação</dt>
          <dd>{formatPortalDate(implementation.completionDateEstimate)}</dd>
        </div>
        <div>
          <dt>Próximo passo</dt>
          <dd>Ativação operacional pela equipe Stayo</dd>
        </div>
      </dl>
    </section>
  );
}

function OperationalOverview({ reservationCount }: { reservationCount: number }) {
  const indicators = [
    {
      label: "Reservas",
      value: reservationCount > 0 ? String(reservationCount) : "Sem dados",
      icon: BedDouble,
    },
    { label: "Ocupação", value: "Aguardando dados", icon: CalendarRange },
    { label: "Receita do mês", value: "Aguardando dados", icon: TrendingUp },
    { label: "Próximo repasse", value: "Aguardando dados", icon: WalletCards },
  ];
  return (
    <div className="portal-operation-overview">
      <section className="portal-operation-welcome">
        <div>
          <p className="portal-milestones-eyebrow">Seu imóvel em operação</p>
          <h2>Acompanhamento que continua com você</h2>
          <p>
            Agora, além do histórico da implantação, este espaço reúne o dia a dia do seu imóvel
            conforme os dados oficiais ficam disponíveis.
          </p>
        </div>
        <BadgeCheck aria-hidden="true" />
      </section>
      <div className="portal-operation-metrics">
        {indicators.map(({ label, value, icon: Icon }) => (
          <div key={label}>
            <Icon aria-hidden="true" />
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <PortalEmptyState
        positive
        icon={<CircleCheckBig />}
        title="Operação acompanhada de perto"
        description="Os primeiros indicadores aparecerão aqui assim que houver movimentação oficial do imóvel."
        nextStep="Você não precisa fazer nada agora. A equipe Stayo mantém esta área atualizada para você."
      />
    </div>
  );
}

function OperationalPlaceholder({
  module,
}: {
  module: Exclude<
    OwnerPortalModule,
    "overview" | "implementation" | "profile" | "proposal" | "documents" | "reservations"
  >;
}) {
  const content = {
    calendar: {
      icon: <CalendarRange />,
      title: "Seu calendário estará aqui",
      description:
        "Datas ocupadas e disponibilidade aparecerão conforme as reservas forem confirmadas.",
    },
    property: {
      icon: <House />,
      title: "Tudo sobre o seu imóvel",
      description: "As informações oficiais do imóvel serão organizadas aqui para consulta.",
    },
    inspections: {
      icon: <ClipboardCheck />,
      title: "Nenhuma vistoria liberada",
      description:
        "Quando houver uma vistoria disponível para você, ela aparecerá aqui com seu status.",
    },
    maintenance: {
      icon: <Wrench />,
      title: "Nenhuma manutenção para acompanhar",
      description: "Ocorrências compartilhadas com você ficarão reunidas nesta área.",
    },
    finance: {
      icon: <WalletCards />,
      title: "Seu financeiro está sendo preparado",
      description:
        "Repasses, demonstrativos e documentos financeiros aparecerão aqui quando houver dados oficiais.",
    },
  }[module];
  return (
    <PortalEmptyState
      icon={content.icon}
      title={content.title}
      description={content.description}
      nextStep="Esta área faz parte do mesmo portal e será atualizada automaticamente."
    />
  );
}

function propertyName(implementation: ImplementationProject | undefined): string {
  if (!implementation) return "Seu imóvel";
  if (implementation.nickname) return implementation.nickname;
  return (
    [implementation.condominiumName, implementation.unit].filter(Boolean).join(" · ") ||
    "Seu imóvel"
  );
}

function PortalHero({
  firstName,
  implementation,
  onSignOut,
  preview = false,
  onPrimary,
  accessLabel = null,
}: {
  firstName: string;
  implementation: ImplementationProject | undefined;
  onSignOut: () => void;
  preview?: boolean;
  onPrimary?: () => void;
  accessLabel?: string | null;
}) {
  const status = implementation?.status ?? "prospect";
  // Só é "foto do imóvel" quando há imagem autorizada na implantação;
  // caso contrário, é explicitamente o visual institucional da STAYO.
  const cover = useOwnerCoverForImplementation(implementation?.id);
  const [coverBroken, setCoverBroken] = useState(false);
  const coverData = coverBroken ? null : (cover.data ?? null);
  const hasPropertyPhoto = coverData?.source === "implementation";
  const hasCondoPhoto = coverData?.source === "condominium";
  const image = coverData?.url ?? portalPropertyFallback;

  return (
    <header className={`portal-property-hero${coverData ? " has-photo" : ""}`}>
      <img
        src={image}
        onError={() => setCoverBroken(true)}
        alt={
          hasPropertyPhoto && implementation
            ? `Foto de ${propertyName(implementation)}`
            : hasCondoPhoto
              ? `Foto do ${coverData?.label ?? "condomínio"}`
              : "Visual institucional STAYO (não é foto do imóvel)"
        }
        width={1600}
        height={700}
        className="portal-property-hero-image"
      />
      <div className="portal-property-hero-overlay" />
      {!coverData && <span className="portal-hero-image-note">Imagem institucional STAYO</span>}
      {hasCondoPhoto && <span className="portal-hero-image-note">{coverData?.label}</span>}
      <div className="portal-property-hero-content">
        <div className="flex items-start justify-between gap-4">
          <div className="portal-property-brand">
            <StayoLogo variant="white" className="h-auto w-24 sm:w-28" />
            <div>
              <span className="mt-1 block text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--portal-hero-muted)]">
                Portal do proprietário
              </span>
            </div>
          </div>
          {preview ? (
            <span className="portal-hero-signout portal-action shrink-0 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-[var(--portal-hero-muted)]">
              Pré-visualização
            </span>
          ) : (
            <Button
              type="button"
              onClick={onSignOut}
              variant="outline"
              size="sm"
              className="portal-hero-signout portal-action shrink-0 rounded-full"
              aria-label="Sair da conta"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          )}
        </div>

        <div className="portal-property-hero-copy">
          <div className="portal-property-status">
            <span className="portal-property-status-dot" />
            {statusLabels[status]}
          </div>
          <p className="portal-property-greeting">Olá, {firstName}.</p>
          {accessLabel && <span className="portal-property-role">{accessLabel}</span>}
          <h1 className="portal-property-title">{propertyName(implementation)}</h1>
          <p className="portal-property-moment">{stageMessages[status]}</p>
          {implementation?.completionDateEstimate && (
            <p className="portal-property-estimate">
              Previsão ·{" "}
              {new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
                new Date(`${implementation.completionDateEstimate}T12:00:00`),
              )}
            </p>
          )}
          {onPrimary && (
            <button type="button" onClick={onPrimary} className="portal-hero-primary portal-action">
              Ver próximo passo <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function PropertySwitcher({
  implementations,
  selectedId,
  onSelect,
}: {
  implementations: ImplementationProject[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="portal-property-switcher" aria-label="Selecionar imóvel">
      <span className="portal-property-switcher-icon">
        <Building2 aria-hidden="true" />
      </span>
      <div>
        <small>Imóvel acompanhado</small>
        <strong>{implementations.length} imóveis no seu portal</strong>
      </div>
      <label>
        <span className="sr-only">Selecionar imóvel</span>
        <select value={selectedId} onChange={(event) => onSelect(event.target.value)}>
          {implementations.map((item) => (
            <option key={item.id} value={item.id}>
              {propertyName(item)}
              {item.city ? ` · ${item.city}` : ""}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden="true" />
      </label>
    </section>
  );
}

function PortalTimeline({
  events,
  loading,
  compact = false,
}: {
  events: PortalTimelineEvent[];
  loading: boolean;
  compact?: boolean;
}) {
  if (loading) return <PortalSkeleton rows={compact ? 2 : 4} />;
  if (events.length === 0)
    return (
      <PortalEmptyState
        icon={<History />}
        title="A primeira atualização está sendo preparada"
        description="Orçamentos, etapas, previsões e vistorias aparecerão aqui em ordem cronológica."
        nextStep="A equipe Stayo publica somente informações relevantes para você."
      />
    );
  const visible = compact ? events.slice(0, 3) : events;
  const kindLabels: Record<PortalTimelineEvent["kind"], string> = {
    update: "Atualização",
    budget: "Orçamento",
    stage: "Etapa",
    forecast: "Previsão",
    inspection: "Vistoria",
    document: "Documento",
  };
  return (
    <section
      className="portal-timeline"
      aria-labelledby={`timeline-${compact ? "summary" : "full"}`}
    >
      {!compact && (
        <div className="portal-timeline-heading">
          <div>
            <p className="portal-milestones-eyebrow">Histórico do imóvel</p>
            <h2 id="timeline-full">Linha do tempo</h2>
          </div>
          <span>{events.length} atualizações</span>
        </div>
      )}
      <ol>
        {visible.map((event) => (
          <li key={event.id}>
            <span className={`portal-timeline-marker is-${event.kind}`} aria-hidden="true" />
            <div>
              <div className="portal-timeline-meta">
                <span>{kindLabels[event.kind]}</span>
                <time dateTime={event.date}>{formatPortalDate(event.date)}</time>
              </div>
              <h3>{event.title}</h3>
              {event.description && <p>{event.description}</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

const emptyPropertyDetails: PropertyDetailsInput = {
  postalCode: null,
  street: null,
  number: null,
  complement: null,
  district: null,
  city: null,
  state: null,
  propertyType: null,
  bedrooms: null,
  suites: null,
  bathrooms: null,
  parkingSpots: null,
  accessType: null,
  accessNotes: null,
  accessCode: null,
  wifiNetwork: null,
  wifiPassword: null,
  notes: null,
};

function PropertyDetailsPanel({
  implementation,
  details,
  loading,
  readOnly = false,
}: {
  implementation: ImplementationProject;
  details: PropertyDetails | null;
  loading: boolean;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [draft, setDraft] = useState<PropertyDetailsInput>(emptyPropertyDetails);
  useEffect(() => {
    setDraft(details ? { ...details } : { ...emptyPropertyDetails });
  }, [details, implementation.id]);
  const save = useMutation({
    mutationFn: () => savePropertyDetails(implementation.id, draft),
    onSuccess: () => {
      setEditing(false);
      toast.success("Dados do imóvel atualizados");
    },
    onError: () => toast.error("Não foi possível salvar os dados do imóvel"),
  });
  if (loading) return <PortalSkeleton rows={5} />;
  const address = [
    details?.street ?? implementation.address,
    details?.number,
    details?.complement,
    details?.district,
    details?.city ?? implementation.city,
    details?.state,
  ]
    .filter(Boolean)
    .join(", ");
  const field = (
    key: keyof PropertyDetailsInput,
    label: string,
    type: "text" | "number" = "text",
  ) => (
    <label className="portal-property-field">
      <span>{label}</span>
      <input
        type={type}
        value={draft[key] ?? ""}
        onChange={(event) =>
          setDraft((current) => ({
            ...current,
            [key]:
              type === "number"
                ? event.target.value
                  ? Number(event.target.value)
                  : null
                : event.target.value || null,
          }))
        }
      />
    </label>
  );
  return (
    <section className="portal-property-details">
      <div className="portal-property-details-heading">
        <div>
          <p className="portal-milestones-eyebrow">Meu imóvel</p>
          <h2>{propertyName(implementation)}</h2>
          <p>Ficha compartilhada entre você e a equipe STAYO.</p>
        </div>
        {!readOnly && (
          <Button
            variant={editing ? "ghost" : "outline"}
            className="min-h-11"
            onClick={() => setEditing((value) => !value)}
          >
            {editing ? "Cancelar" : "Editar dados"}
          </Button>
        )}
      </div>
      <p className="portal-property-flow-note">
        {editing
          ? "Ao salvar, a alteração entra direto na ficha e a equipe STAYO vê na hora. Não há etapa de revisão antes."
          : "O que aparece aqui é o que está salvo na ficha agora. Ainda não mostramos, por item, o que está em revisão ou aprovado pela equipe."}
      </p>
      {editing ? (
        <div className="portal-property-form">
          <div className="portal-property-form-grid">
            <div className="portal-property-field">
              <span>CEP</span>
              <PostalCodeInput value={draft.postalCode ?? ""} disabled={save.isPending}
                onChange={postalCode => setDraft(current => ({ ...current, postalCode }))}
                onAddress={patch => setDraft(current => ({ ...current, ...patch }))} />
            </div>
            {field("street", "Endereço")}
            {field("number", "Número")}
            {field("complement", "Complemento")}
            {field("district", "Bairro")}
            {field("city", "Cidade")}
            {field("state", "UF")}
            {field("propertyType", "Tipo de imóvel")}
            {field("bedrooms", "Quartos", "number")}
            {field("suites", "Suítes", "number")}
            {field("bathrooms", "Banheiros", "number")}
            {field("parkingSpots", "Vagas", "number")}
          </div>
          <div className="portal-property-form-grid">
            <label className="portal-property-field">
              <span>Forma de acesso</span>
              <select
                value={draft.accessType ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    accessType: (event.target.value || null) as PropertyDetailsInput["accessType"],
                  }))
                }
              >
                <option value="">Selecione</option>
                <option value="key">Chave</option>
                <option value="lock">Fechadura digital</option>
                <option value="concierge">Portaria</option>
                <option value="other">Outro</option>
              </select>
            </label>
            {field("accessNotes", "Orientações de acesso")}
            {field("accessCode", "Senha da fechadura")}
            {field("wifiNetwork", "Rede Wi-Fi")}
            {field("wifiPassword", "Senha do Wi-Fi")}
          </div>
          <div className="portal-property-form-actions">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="portal-property-sections">
          <div>
            <span className="portal-property-section-icon">
              <MapPin />
            </span>
            <h3>Endereço</h3>
            <p>{address || "Endereço ainda não informado"}</p>
          </div>
          <div>
            <span className="portal-property-section-icon">
              <House />
            </span>
            <h3>Características</h3>
            <p>
              {[
                details?.propertyType ?? implementation.propertyType,
                details?.bedrooms ? `${details.bedrooms} quartos` : null,
                details?.bathrooms ? `${details.bathrooms} banheiros` : null,
              ]
                .filter(Boolean)
                .join(" · ") || "Características ainda não informadas"}
            </p>
          </div>
          <div>
            <span className="portal-property-section-icon">
              <DoorOpen />
            </span>
            <h3>Acesso</h3>
            <p>
              {details?.accessNotes
                ? "Orientações registradas"
                : "Forma de acesso ainda não informada"}
            </p>
            {details?.accessNotes && (
              <SecretValue label="Orientações" value={details.accessNotes} visible={showSecrets} />
            )}
            {details?.accessCode && (
              <SecretValue
                label="Senha da fechadura"
                value={details.accessCode}
                visible={showSecrets}
              />
            )}
          </div>
          <div>
            <span className="portal-property-section-icon">
              <Wifi />
            </span>
            <h3>Wi-Fi</h3>
            <p>{details?.wifiNetwork ? "Rede registrada" : "Rede ainda não informada"}</p>
            {details?.wifiNetwork && (
              <SecretValue label="Rede" value={details.wifiNetwork} visible={showSecrets} />
            )}
            {details?.wifiPassword && (
              <SecretValue label="Senha" value={details.wifiPassword} visible={showSecrets} />
            )}
          </div>
          {(details?.accessCode ||
            details?.wifiPassword ||
            details?.wifiNetwork ||
            details?.accessNotes) && (
            <Button
              variant="ghost"
              className="min-h-11"
              aria-pressed={showSecrets}
              onClick={() => setShowSecrets((value) => !value)}
            >
              <LockKeyhole className="h-4 w-4" />
              {showSecrets ? "Ocultar dados protegidos" : "Mostrar dados protegidos"}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function SecretValue({
  label,
  value,
  visible,
}: {
  label: string;
  value: string;
  visible: boolean;
}) {
  return (
    <small>
      {label}: <strong>{visible ? value : "Protegido"}</strong>
    </small>
  );
}

function InspectionsPanel({
  inspections,
  attachments,
  loading,
  error = false,
  onRetry,
  onOpen,
}: {
  inspections: PortalInspection[];
  attachments: Attachment[];
  loading: boolean;
  error?: boolean;
  onRetry?: () => void;
  onOpen: (path: string) => void;
}) {
  if (loading) return <PortalSkeleton rows={4} />;
  if (error)
    return (
      <PortalEmptyState
        icon={<ClipboardCheck />}
        title="Não conseguimos carregar as vistorias agora"
        description="Isso não quer dizer que não existam vistorias."
        nextStep="Tente de novo em alguns instantes."
        {...(onRetry ? { action: { label: "Tentar de novo", onClick: onRetry } } : {})}
      />
    );
  if (inspections.length === 0)
    return (
      <PortalEmptyState
        icon={<ClipboardCheck />}
        title="Nenhuma vistoria registrada ainda"
        description="A vistoria é marcada pela equipe STAYO durante a implantação."
        nextStep="Quando houver data, ela aparece aqui. O relatório entra depois que a equipe liberar."
      />
    );
  const status = {
    scheduled: "Agendada",
    in_progress: "Em andamento",
    completed: "Concluída",
    cancelled: "Cancelada",
  };
  return (
    <section className="portal-inspections">
      <div className="portal-operational-heading">
        <p className="portal-milestones-eyebrow">Acompanhamento técnico</p>
        <h2>Vistorias do imóvel</h2>
        <p>Resumos e documentos liberados pela equipe.</p>
      </div>
      <div className="portal-inspection-list">
        {inspections.map((inspection) => {
          const files = attachments.filter((item) => item.inspectionId === inspection.id);
          return (
            <article key={inspection.id}>
              <div className="portal-inspection-head">
                <span>
                  <ClipboardCheck />
                </span>
                <div>
                  <small>{inspection.type.replace(/_/g, " ")}</small>
                  <h3>{status[inspection.status]}</h3>
                </div>
                <time>{formatPortalDate(inspection.completedAt ?? inspection.scheduledFor)}</time>
              </div>
              {inspection.publicNotes && <p>{inspection.publicNotes}</p>}
              {files.length > 0 && (
                <div className="portal-inspection-files">
                  {files.map((file) => (
                    <Button
                      key={file.id}
                      variant="outline"
                      size="sm"
                      onClick={() => onOpen(file.storagePath)}
                    >
                      <FileText /> {file.filename}
                    </Button>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell framed={false} showBrand={false}>
      {children}
    </PortalShell>
  );
}

function LoadingBlock() {
  return <PortalSkeleton />;
}

function PortalAccessState({
  kind,
  onRetry,
  onSignOut,
}: {
  kind: "unlinked" | "error";
  onRetry: () => void;
  onSignOut: () => void;
}) {
  const connectionError = kind === "error";
  return (
    <div className="portal-access-state">
      <div className="portal-access-brand">
        <StayoLogo className="h-auto w-28" />
        <span>Portal do proprietário</span>
      </div>
      <div className="portal-access-icon">{connectionError ? <WifiOff /> : <Key />}</div>
      <p className="portal-milestones-eyebrow">Seu acesso</p>
      <h1>
        {connectionError
          ? "Não conseguimos abrir seu portal agora"
          : "Seu acesso precisa ser concluído"}
      </h1>
      <p>
        {connectionError
          ? "Sua conta está segura. Verifique sua conexão e tente novamente."
          : "A conta existe, mas ainda não encontramos o vínculo com o seu imóvel. Entre novamente pelo link enviado pela Stayo ou fale com a nossa equipe."}
      </p>
      <div className="portal-access-actions">
        <Button type="button" onClick={onRetry} className="portal-action">
          <RefreshCw /> Tentar novamente
        </Button>
        <Button type="button" onClick={onSignOut} variant="outline" className="portal-action">
          <LogOut /> Sair da conta
        </Button>
      </div>
    </div>
  );
}

function OwnerHomePage() {
  const navigate = useNavigate();
  const auth = useOwnerSession();

  useEffect(() => {
    if (auth.status === "unauthenticated" || auth.status === "not_required") {
      void navigate({ to: "/portal/login" });
    }
  }, [auth.status, navigate]);

  const signOut = useMutation({
    mutationFn: () => ownerSignOut(),
    onSuccess: () => void navigate({ to: "/portal/login" }),
  });

  if (!isSupabaseConfigured() || auth.status === "loading") {
    return (
      <Shell>
        <LoadingBlock />
      </Shell>
    );
  }

  if (auth.status === "unlinked" || auth.status === "error") {
    return (
      <Shell>
        <PortalAccessState
          kind={auth.status}
          onRetry={auth.retry}
          onSignOut={() => signOut.mutate()}
        />
      </Shell>
    );
  }

  if (auth.status !== "authenticated" || !auth.account) return null;

  return (
    <Shell>
      <OwnerHomeContent
        ownerId={auth.account.ownerId}
        account={auth.account}
        onSignOut={() => signOut.mutate()}
      />
    </Shell>
  );
}

export function OwnerHomeContent({
  ownerId,
  account = null,
  onSignOut,
  preview = false,
  previewImplementationId,
}: {
  ownerId: string;
  account?: OwnerPortalAccount | null;
  onSignOut: () => void;
  preview?: boolean;
  previewImplementationId?: string;
}) {
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [consolidated, setConsolidated] = useState(false);
  const [selectedImplementationId, setSelectedImplementationId] = useState(() =>
    previewImplementationId
      ? previewImplementationId
      : typeof window === "undefined"
        ? ""
        : (window.localStorage.getItem("stayo-owner-property") ?? ""),
  );
  const tabsListRef = useRef<HTMLDivElement>(null);
  const ownerQ = useQuery(ownerQuery(ownerId));
  const tasksQ = useQuery(ownerTasksQuery(ownerId));
  const implementationsQ = useQuery({
    queryKey: ["owner-portal", "implementations", ownerId, previewImplementationId ?? "all"],
    queryFn: listOwnerImplementations,
    staleTime: 30_000,
  });
  const allImplementations = implementationsQ.data ?? [];
  const ownerImplementations = previewImplementationId
    ? allImplementations.filter((item) => item.id === previewImplementationId)
    : allImplementations;
  const implementation =
    ownerImplementations.find((item) => item.id === selectedImplementationId) ??
    ownerImplementations[0];

  const publishedWorkspace=useQuery({queryKey:['owner-published-workspace',ownerId,implementation?.id],enabled:Boolean(implementation?.id)&&!preview,
    queryFn:()=>readAccountOwnerWorkspace({data:{implementationId:implementation?.id??''}}),retry:false});

  const portalPhase = getOwnerPortalPhase(implementation);
  const permissions = ownerPortalPermissions(account?.role ?? "titular");
  const portalModules = getOwnerPortalModules(portalPhase).filter(
    (module) => module !== "finance" || permissions.canViewFinance,
  );
  const corePropertyId =
    portalPhase === "operation" ? (implementation?.corePropertyId ?? null) : null;
  const propertyQ = useQuery({
    ...propertyQuery(corePropertyId ?? ""),
    enabled: Boolean(corePropertyId),
  });
  const reservationsQ = useQuery({
    ...reservationsListQuery(),
    enabled: portalPhase === "operation",
  });
  const submissionQ = useQuery({
    ...ownerOnboardingSubmissionQuery(implementation?.id ?? ""),
    enabled: Boolean(implementation?.id),
  });
  const proposalsQ = useQuery({
    ...proposalsByImplementationQuery(implementation?.id ?? ""),
    enabled: Boolean(implementation?.id),
  });
  const commercialTermsQ = useQuery({
    ...commercialTermsQuery(implementation?.id ?? ""),
    enabled: Boolean(implementation?.id),
  });
  const proposalVersions = [...(proposalsQ.data ?? [])].sort((a, b) => b.version - a.version);
  const currentProposal = proposalVersions[0];
  const proposalLinkQ = useQuery({
    ...proposalShareLinkQuery(currentProposal?.id ?? ""),
    enabled: Boolean(currentProposal?.id),
  });
  const attachmentsQ = useQuery({
    queryKey: ["owner-attachments", ownerId],
    queryFn: () => listOwnerAttachments(ownerId),
  });
  const propertyDetailsQ = useQuery({
    queryKey: ["owner-portal", "property-details", implementation?.id],
    queryFn: () => getPropertyDetails(implementation?.id ?? ""),
    enabled: Boolean(implementation?.id) && activeTab === "property",
  });
  const timelineQ = useQuery({
    queryKey: ["owner-portal", "timeline", implementation?.id],
    queryFn: () => listPortalTimeline(implementation?.id ?? ""),
    enabled:
      Boolean(implementation?.id) && (activeTab === "implantacao" || activeTab === "visao-geral"),
    staleTime: 20_000,
  });
  const inspectionsQ = useQuery({
    queryKey: ["owner-portal", "inspections", implementation?.id],
    queryFn: () => listPortalInspections(implementation?.id ?? ""),
    enabled: Boolean(implementation?.id) && activeTab === "inspections",
  });
  const releasesQ = useQuery({
    queryKey: ["portal-visibility", implementation?.id],
    queryFn: () => listActiveReleases(implementation?.id ?? ""),
    enabled: Boolean(implementation?.id),
  });
  const meetingQ = useQuery({
    queryKey: ["owner-portal", "next-meeting", implementation?.id],
    enabled: Boolean(implementation?.id),
    queryFn: async (): Promise<OverviewMeeting | null> => {
      const db = getSupabaseBrowserClient();
      if (!db) throw new Error("Banco indisponível");
      const { data, error } = await db.rpc("owner_next_meeting", {
        p_implementation_id: implementation?.id ?? "",
      });
      if (error) throw error;
      return (data as OverviewMeeting | null) ?? null;
    },
  });
  const releasedOverview = releasesQ.data?.find((r) => r.block === "overview")?.content as
    OverviewContent | undefined;
  const releasedProposal = releasesQ.data?.find((r) => r.block === "proposal")?.content as
    ProposalContent | undefined;
  const releasedDocIds = new Set(
    (
      (
        releasesQ.data?.find((r) => r.block === "documents")?.content as
          DocumentsContent | undefined
      )?.documents ?? []
    ).map((d) => d.attachmentId),
  );
  const releasedDocs = (attachmentsQ.data ?? []).filter((a) => releasedDocIds.has(a.id));
  const download = useMutation({
    mutationFn: (storagePath: string) => getAttachmentSignedUrl(storagePath),
    onSuccess: (url) => {
      window.open(url, "_blank", "noopener,noreferrer");
      toast.success("Documento aberto", { description: "O arquivo foi aberto em uma nova aba." });
    },
    onError: () =>
      toast.error("Não foi possível abrir o documento", {
        description: "Tente novamente em alguns instantes.",
      }),
  });

  const pending = (tasksQ.data ?? []).filter((t) => t.status === "pending");
  const allReservations = reservationsQ.data?.data ?? [];
  const dashboardReservations = consolidated
    ? allReservations
    : allReservations.filter((r) => r.propertyId === corePropertyId);
  const adminFeePercent =
    commercialTermsQ.data?.find(
      (term) => term.chargeType === "percentage" && /administra/i.test(term.label),
    )?.value ?? null;
  const firstName = ownerQ.data?.name?.split(" ")[0] ?? "proprietário";
  const accessLabel = account
    ? `${ownerRoleLabels[account.role]}${
        account.role === "coproprietario" && account.sharePercent != null
          ? ` · ${account.sharePercent}% de participação`
          : ""
      }`
    : null;
  const welcome = useOwnerWelcomeState();

  useEffect(() => {
    if (!portalModules.some((module) => tabValueOf(module) === activeTab))
      setActiveTab("visao-geral");
  }, [activeTab, portalModules]);

  useEffect(() => {
    if (!implementation?.id || selectedImplementationId === implementation.id) return;
    setSelectedImplementationId(implementation.id);
  }, [implementation?.id, selectedImplementationId]);

  const selectImplementation = (id: string) => {
    setSelectedImplementationId(id);
    window.localStorage.setItem("stayo-owner-property", id);
    setActiveTab("visao-geral");
  };

  return (
    <div className="portal-dashboard">
      {welcome.showWelcome && welcome.ready && !preview && (
        <OwnerWelcomeOverlay
          firstName={firstName}
          propertyName={propertyName(implementation)}
          onStart={() => welcome.dismiss()}
        />
      )}
      <PortalHero
        firstName={firstName}
        implementation={implementation}
        onSignOut={onSignOut}
        preview={preview}
        onPrimary={() => setActiveTab("implantacao")}
        accessLabel={preview ? null : accessLabel}
      />

      {ownerImplementations.length > 1 && (
        <PropertySwitcher
          implementations={ownerImplementations}
          selectedId={implementation?.id ?? ""}
          onSelect={selectImplementation}
        />
      )}
      {ownerImplementations.length > 1 && portalPhase === "operation" && (
        <div className="owner-dash-view-toggle" role="group" aria-label="Visão do painel">
          <button
            type="button"
            aria-pressed={!consolidated}
            onClick={() => setConsolidated(false)}
          >
            Por imóvel
          </button>
          <button type="button" aria-pressed={consolidated} onClick={() => setConsolidated(true)}>
            Consolidado
          </button>
        </div>
      )}
      <PortalPhaseIndicator phase={portalPhase} />
      {portalPhase === "ready" && implementation && (
        <ReadyTransition implementation={implementation} />
      )}

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value);
          requestAnimationFrame(() => {
            tabsListRef.current
              ?.querySelector<HTMLElement>('[data-state="active"]')
              ?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
          });
        }}
        className="portal-dashboard-tabs"
      >
        <div className="portal-nav-wrap">
          <TabsList
            ref={tabsListRef}
            aria-label="Navegação do Portal"
            className="portal-tabs-list hide-scrollbar scroll-mask flex h-auto w-full snap-x snap-mandatory scroll-px-2 scroll-smooth justify-start gap-1 overflow-x-auto overflow-y-hidden bg-transparent p-0"
          >
            {portalModules.map((module) => {
              const locked =
                !releasesQ.isPending &&
                ((module === "proposal" && !releasedProposal) ||
                  (module === "documents" && releasedDocs.length === 0));
              return (
                <TabsTrigger
                  key={module}
                  value={tabValueOf(module)}
                  className={`stayo-tab portal-tab snap-start${locked ? " is-locked" : ""}`}
                  aria-label={
                    locked
                      ? `${portalModuleLabels[module]} — ainda não liberado`
                      : portalModuleLabels[module]
                  }
                >
                  {locked && <LockKeyhole aria-hidden="true" className="portal-tab-lock" />}
                  <span className="portal-tab-full">{portalModuleLabels[module]}</span>
                  <span className="portal-tab-short">
                    {portalModuleShortLabels[module] ?? portalModuleLabels[module]}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <TabsContent value="visao-geral" className="tab-content-anim space-y-6">
          {publishedWorkspace.data && permissions.canViewFinance && <OwnerWorkspace snapshot={publishedWorkspace.data}/>}
          <OwnerDashboard
            phase={portalPhase}
            permissions={permissions}
            propertyName={propertyName(implementation)}
            consolidated={consolidated}
            propertyCount={ownerImplementations.length}
            reservations={dashboardReservations}
            reservationsPending={reservationsQ.isPending && portalPhase === "operation"}
            reservationsError={reservationsQ.isError}
            onRetryReservations={() => void reservationsQ.refetch()}
            adminFeePercent={adminFeePercent}
            pendingTasks={pending}
            timeline={timelineQ.data ?? []}
            goTo={setActiveTab}
          />
          {portalPhase === "operation" && (
            <OperationalOverview
              reservationCount={
                reservationsQ.data?.data.filter(
                  (reservation) => reservation.propertyId === corePropertyId,
                ).length ?? 0
              }
            />
          )}
          <OwnerOverview
            propertyLabel={[propertyName(implementation), implementation?.code]
              .filter(Boolean)
              .join(" · ")}
            stageLabel={statusLabels[implementation?.status ?? "prospect"]}
            stageMessage={stageMessages[implementation?.status ?? "prospect"]}
            tasks={{ ...tasksQ, data: tasksQ.data ? pending : undefined }}
            timeline={timelineQ}
            meeting={meetingQ}
            releasedOverview={releasedOverview}
            releasedProposal={releasedProposal}
            releasesLoading={releasesQ.isPending}
            goTo={setActiveTab}
          />
        </TabsContent>

        <>
          {portalPhase === "operation" && (
            <>
              <TabsContent value="reservations" className="tab-content-anim space-y-6">
                {reservationsQ.isPending ? (
                  <PortalSkeleton rows={4} />
                ) : reservationsQ.isError ? (
                  <PortalEmptyState
                    icon={<BedDouble />}
                    title="Não conseguimos consultar as reservas agora"
                    description="Nada foi perdido. Esta área voltará a carregar assim que a conexão for restabelecida."
                    nextStep="Tente novamente em alguns instantes."
                  />
                ) : (reservationsQ.data?.data ?? []).filter(
                    (reservation) => reservation.propertyId === corePropertyId,
                  ).length === 0 ? (
                  <PortalEmptyState
                    icon={<BedDouble />}
                    title="As próximas reservas aparecerão aqui"
                    description="Ainda não há reservas oficiais para mostrar neste imóvel."
                    nextStep="Quando uma reserva for confirmada, você verá datas, canal, status e valores permitidos nesta área."
                  />
                ) : (
                  <section
                    className="portal-operational-list"
                    aria-labelledby="owner-reservations-title"
                  >
                    <div className="portal-operational-heading">
                      <p className="portal-milestones-eyebrow">Operação</p>
                      <h2 id="owner-reservations-title">Reservas do imóvel</h2>
                      <p>Informações essenciais, sem expor dados privados dos hóspedes.</p>
                    </div>
                    <ul>
                      {(reservationsQ.data?.data ?? [])
                        .filter((reservation) => reservation.propertyId === corePropertyId)
                        .map((reservation) => (
                          <li key={reservation.id}>
                            <div>
                              <strong>
                                {new Intl.DateTimeFormat("pt-BR").format(
                                  new Date(reservation.checkin),
                                )}{" "}
                                —{" "}
                                {new Intl.DateTimeFormat("pt-BR").format(
                                  new Date(reservation.checkout),
                                )}
                              </strong>
                              <span>
                                {reservation.channel ?? reservation.source ?? "Canal não informado"}{" "}
                                · {reservation.status}
                              </span>
                            </div>
                            <span>
                              {reservation.amount == null
                                ? "Valor não disponível"
                                : portalCurrency.format(reservation.amount)}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </section>
                )}
              </TabsContent>
              <TabsContent value="calendar" className="tab-content-anim space-y-6">
                <OperationalPlaceholder module="calendar" />
              </TabsContent>
              <TabsContent value="maintenance" className="tab-content-anim space-y-6">
                <OperationalPlaceholder module="maintenance" />
              </TabsContent>
              <TabsContent value="finance" className="tab-content-anim space-y-6">
                <OperationalPlaceholder module="finance" />
              </TabsContent>
            </>
          )}
          <TabsContent value="property" className="tab-content-anim space-y-6">
            {implementation && (
              <PropertyDetailsPanel
                implementation={implementation}
                details={propertyDetailsQ.data ?? null}
                loading={propertyDetailsQ.isPending}
                readOnly={!permissions.canEditPropertyData}
              />
            )}
          </TabsContent>
          <TabsContent value="inspections" className="tab-content-anim space-y-6">
            <InspectionsPanel
              inspections={inspectionsQ.data ?? []}
              attachments={(attachmentsQ.data ?? []).filter(
                (attachment) => attachment.implementationId === implementation?.id,
              )}
              loading={inspectionsQ.isPending || attachmentsQ.isPending}
              error={inspectionsQ.isError}
              onRetry={() => void inspectionsQ.refetch()}
              onOpen={(path) => download.mutate(path)}
            />
          </TabsContent>
        </>

        <TabsContent value="implantacao" className="tab-content-anim space-y-6">
          {implementationsQ.isPending ? (
            <PortalSkeleton rows={4} />
          ) : implementation ? (
            <>
              <ImplementationJourney implementation={implementation} />
              {!preview && (
                <a
                  href={`/portal/inventario/${implementation.id}`}
                  className="flex items-center justify-between rounded-xl border px-4 py-3 text-sm"
                  style={{ borderColor: "var(--stayo-border)" }}
                >
                  <span>
                    <b className="block">Inventário do imóvel</b>
                    <small style={{ color: "var(--stayo-ink-muted)" }}>Marque o que já existe em cada ambiente</small>
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </a>
              )}
              <PortalTimeline events={timelineQ.data ?? []} loading={timelineQ.isPending} />
            </>
          ) : (
            <PortalEmptyState
              icon={<Key />}
              title="Estamos preparando seu acompanhamento"
              description="Os dados adicionais do seu imóvel ainda estão sendo organizados pela equipe Stayo."
              nextStep="Assim que os próximos marcos forem definidos, você acompanhará cada avanço nesta área."
            />
          )}
        </TabsContent>

        <TabsContent value="dados" className="tab-content-anim space-y-6">
          {ownerQ.isPending || attachmentsQ.isPending || submissionQ.isPending ? (
            <PortalSkeleton rows={4} />
          ) : (
            <OwnerDataJourney
              name={ownerQ.data?.name}
              email={ownerQ.data?.email}
              phone={ownerQ.data?.phone}
              document={
                permissions.showFullDocument
                  ? ownerQ.data?.document
                  : maskOwnerDocument(ownerQ.data?.document)
              }
              pendingKinds={pending.map((task) => task.kind)}
              onReviewPending={() => setActiveTab("visao-geral")}
            />
          )}
        </TabsContent>

        <TabsContent value="proposta" className="tab-content-anim space-y-6">
          {releasesQ.isPending ? (
            <PortalSkeleton rows={4} />
          ) : releasesQ.isError ? (
            <PortalEmptyState
              icon={<FileSignature />}
              title="Não conseguimos consultar a proposta agora"
              description="Isso não quer dizer que ela não exista."
              nextStep="Tente de novo em alguns instantes."
              action={{ label: "Tentar de novo", onClick: () => void releasesQ.refetch() }}
            />
          ) : releasedProposal ? (
            <ReleasedProposal content={releasedProposal} />
          ) : (
            <PortalEmptyState
              icon={<FileSignature />}
              title="A proposta ainda está sendo preparada"
              description="Avisaremos você quando estiver disponível."
              nextStep="Ela aparece aqui com valores e condições assim que a equipe STAYO liberar."
              action={{
                label: "Acompanhar implantação",
                onClick: () => setActiveTab("implantacao"),
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="documentos" className="tab-content-anim space-y-6">
          <section className="portal-documents" aria-labelledby="portal-documents-title">
            <div className="portal-documents-heading">
              <div className="portal-documents-heading-icon">
                <ShieldCheck aria-hidden="true" />
              </div>
              <div>
                <p className="portal-milestones-eyebrow">Pasta segura</p>
                <h2 id="portal-documents-title">Seus documentos</h2>
                <p>
                  Arquivos importantes liberados pela equipe Stayo, organizados para uma consulta
                  simples e segura.
                </p>
              </div>
            </div>
            {attachmentsQ.isPending || releasesQ.isPending ? (
              <PortalSkeleton rows={3} />
            ) : attachmentsQ.isError || releasesQ.isError ? (
              <PortalEmptyState
                icon={<FileText />}
                title="Não foi possível abrir sua pasta agora"
                description="Seus documentos continuam protegidos."
                nextStep="Tente novamente em alguns instantes. Se o problema continuar, fale com a equipe Stayo."
              />
            ) : releasedDocs.length === 0 ? (
              <PortalEmptyState
                icon={<FileText />}
                title="Nenhum documento por aqui ainda"
                description="Os arquivos entram nesta pasta só depois que a equipe STAYO libera."
                nextStep="Avisaremos você quando houver um documento para consultar."
                action={{
                  label: "Ver minhas pendências",
                  onClick: () => setActiveTab("visao-geral"),
                }}
              />
            ) : (
              <ul className="portal-document-list">
                {releasedDocs.map((attachment) => (
                  <li key={attachment.id} className="portal-document-row portal-interactive-row">
                    <span className="portal-document-icon">
                      <DocumentIcon attachment={attachment} />
                    </span>
                    <div className="portal-document-copy">
                      <strong>{attachment.filename}</strong>
                      <span>
                        {documentType(attachment)} ·{" "}
                        {attachment.mimeType === "application/pdf"
                          ? "PDF"
                          : attachment.mimeType.startsWith("image/")
                            ? "Imagem"
                            : "Arquivo"}
                      </span>
                    </div>
                    <div className="portal-document-meta">
                      <span className="portal-document-status">
                        <CheckCircle2 aria-hidden="true" /> Disponível
                      </span>
                      <time dateTime={attachment.createdAt}>
                        {new Intl.DateTimeFormat("pt-BR").format(new Date(attachment.createdAt))}
                      </time>
                    </div>
                    <Button
                      type="button"
                      onClick={() => download.mutate(attachment.storagePath)}
                      disabled={download.isPending}
                      variant="outline"
                      size="sm"
                      className="portal-action portal-document-action shrink-0 border-[var(--portal-border)] text-[var(--portal-navy)] hover:bg-[var(--portal-surface-soft)]"
                    >
                      {attachment.mimeType.startsWith("image/") ||
                      attachment.mimeType === "application/pdf" ? (
                        <ExternalLink className="h-3.5 w-3.5" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      {download.isPending ? "Abrindo..." : "Abrir"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {download.isError && (
              <p className="portal-document-error" role="alert">
                Não conseguimos abrir este arquivo agora. Tente novamente em alguns instantes.
              </p>
            )}
            <p className="portal-documents-trust">
              <LockKeyhole aria-hidden="true" /> Somente documentos liberados para você aparecem
              nesta área.
            </p>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
