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
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import portalPropertyFallback from "../assets/owner-portal-property-fallback.jpg";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { PortalEmptyState, PortalShell, PortalSkeleton } from "../components/portal/PortalExperience";
import { getAttachmentSignedUrl, listOwnerAttachments } from "../lib/api/attachments";
import { implementationsListQuery, ownerQuery, ownerTasksQuery } from "../lib/api/queries";
import { isSupabaseConfigured, ownerSignOut, useOwnerSession } from "../lib/auth/owner-session";
import { statusLabels } from "../lib/implementation-status";
import type { OwnerTaskStatus } from "../types/admin";
import type { ImplementationProject, ImplementationStatus } from "../types/core";

export const Route = createFileRoute("/portal/inicio")({
  head: () => ({
    meta: [{ title: "Minha conta — Portal do Proprietário Stayo" }],
  }),
  component: OwnerHomePage,
});

const ownerTaskKindLabels: Record<string, string> = {
  banking_data: "Dado bancário",
  wifi_info: "Wi-Fi",
  regulation_document: "Documento de regularização",
  custom: "Outro",
};

const ownerTaskStatusLabels: Record<OwnerTaskStatus, string> = {
  pending: "Pendente",
  done: "Resolvida",
  dismissed: "Dispensada",
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
  { label: "Preparação do imóvel", description: "Ajustes necessários para receber os primeiros hóspedes." },
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
          {isBlocked ? statusLabels[status] : isComplete ? "Etapas concluídas" : `${activeIndex + 1} de ${ownerMilestones.length}`}
        </span>
      </div>

      <ol className="portal-milestones-list">
        {ownerMilestones.map((milestone, index) => {
          const state = isBlocked && index === activeIndex
            ? "blocked"
            : isComplete || index < activeIndex
              ? "done"
              : index === activeIndex
                ? "current"
                : "future";
          const stateLabel = state === "done" ? "Concluída" : state === "current" ? "Etapa atual" : state === "blocked" ? "Bloqueada" : "Próxima etapa";

          return (
            <li key={milestone.label} className={`portal-milestone is-${state}`} title={milestone.description}>
              <div className="portal-milestone-track" aria-hidden="true">
                <span className="portal-milestone-line" />
                <span className="portal-milestone-marker">
                  {state === "done" ? <CheckCircle2 /> : state === "blocked" ? <LockKeyhole /> : <Circle />}
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
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

function ImplementationJourney({ implementation }: { implementation: ImplementationProject }) {
  const activeIndex = ownerMilestoneIndex(implementation.status);
  const isComplete = implementation.status === "ativo";
  const isBlocked = ["pausado", "nao_convertido", "cancelado"].includes(implementation.status);
  const completed = isComplete ? ownerMilestones : ownerMilestones.slice(0, activeIndex);
  const nextSteps = isComplete ? [] : ownerMilestones.slice(activeIndex, Math.min(activeIndex + 3, ownerMilestones.length));
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
            <span className="portal-journey-panel-icon is-complete"><CheckCircle2 aria-hidden="true" /></span>
            <div>
              <h2 id="completed-steps-title">O que já foi feito</h2>
              <p>Cada avanço concluído fica registrado aqui.</p>
            </div>
          </div>
          {completed.length > 0 ? (
            <ul className="portal-journey-list">
              {completed.map((milestone) => (
                <li key={milestone.label}>
                  <CheckCircle2 aria-hidden="true" />
                  <div><strong>{milestone.label}</strong><span>{milestone.description}</span></div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="portal-journey-note">Estamos organizando o primeiro marco. Você verá cada avanço por aqui.</p>
          )}
        </section>

        <section className="portal-journey-panel" aria-labelledby="next-steps-title">
          <div className="portal-journey-panel-heading">
            <span className="portal-journey-panel-icon"><ArrowRight aria-hidden="true" /></span>
            <div>
              <h2 id="next-steps-title">Próximos passos</h2>
              <p>O caminho previsto a partir do momento atual.</p>
            </div>
          </div>
          {nextSteps.length > 0 ? (
            <ol className="portal-journey-list is-next">
              {nextSteps.map((milestone, index) => (
                <li key={milestone.label}>
                  <span className="portal-journey-number">{index + 1}</span>
                  <div>
                    <strong>{milestone.label}{index === 0 && !isBlocked ? " · agora" : ""}</strong>
                    <span>{index === 0 && isBlocked ? stageMessages[implementation.status] : milestone.description}</span>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="portal-journey-note">A implantação foi concluída. O acompanhamento continua na área do seu imóvel.</p>
          )}
        </section>
      </div>

      <p className="portal-journey-context">
        {isBlocked
          ? "A equipe Stayo está acompanhando esta situação e compartilhará a próxima atualização por aqui."
          : isComplete
            ? "Seu imóvel concluiu a implantação e agora segue acompanhado pela operação Stayo."
            : `Neste momento, nosso foco é ${(currentMilestone?.label ?? statusLabels[implementation.status]).toLocaleLowerCase("pt-BR")}. Atualizaremos esta página conforme cada marco for concluído.`}
      </p>
    </div>
  );
}

function propertyName(implementation: ImplementationProject | undefined): string {
  if (!implementation) return "Seu imóvel";
  if (implementation.nickname) return implementation.nickname;
  return [implementation.condominiumName, implementation.unit].filter(Boolean).join(" · ") || "Seu imóvel";
}

function PortalHero({
  firstName,
  implementation,
  onSignOut,
}: {
  firstName: string;
  implementation: ImplementationProject | undefined;
  onSignOut: () => void;
}) {
  const status = implementation?.status ?? "prospect";
  const image = implementation?.coverImage?.startsWith("http")
    ? implementation.coverImage
    : portalPropertyFallback;

  return (
    <header className="portal-property-hero">
      <img
        src={image}
        alt={implementation ? `Vista de ${propertyName(implementation)}` : "Imóvel acompanhado pela Stayo"}
        width={1600}
        height={700}
        className="portal-property-hero-image"
      />
      <div className="portal-property-hero-overlay" />
      <div className="portal-property-hero-content">
        <div className="flex items-start justify-between gap-4">
          <div className="portal-property-brand">
            <img src="/favicon.ico" alt="" aria-hidden="true" className="h-8 w-8 object-contain sm:h-9 sm:w-9" />
            <div>
              <span className="block text-base font-semibold leading-none text-[var(--portal-hero-foreground)]">STAYO</span>
              <span className="mt-1 block text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--portal-hero-muted)]">Portal do proprietário</span>
            </div>
          </div>
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
        </div>

        <div className="portal-property-hero-copy">
          <div className="portal-property-status">
            <span className="portal-property-status-dot" />
            {statusLabels[status]}
          </div>
          <p className="portal-property-greeting">Olá, {firstName}.</p>
          <h1 className="portal-property-title">{propertyName(implementation)}</h1>
          <p className="portal-property-moment">{stageMessages[status]}</p>
          {implementation?.completionDateEstimate && (
            <p className="portal-property-estimate">
              Previsão · {new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(`${implementation.completionDateEstimate}T12:00:00`))}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}

const StyleInjection = () => (
  <style>{`
    .stayo-tab {
      flex: 1 0 auto;
      min-height: 42px;
      color: var(--portal-muted);
      border: none !important;
      transition: color 180ms ease, background-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
      border-radius: 10px !important;
      padding: 0.65rem 1rem;
      font-weight: 500;
      font-size: 0.875rem;
      line-height: 1.25rem;
      white-space: nowrap;
      background: transparent !important;
      box-shadow: none !important;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .stayo-tab:hover {
      color: var(--portal-navy);
      background-color: var(--portal-surface) !important;
    }
    .stayo-tab:active {
      transform: scale(0.985);
    }
    .stayo-tab:focus-visible {
      outline: 2px solid var(--portal-gold);
      outline-offset: 2px;
    }
    .stayo-tab[data-state="active"] {
      color: var(--portal-navy) !important;
      font-weight: 600 !important;
      background: var(--portal-surface) !important;
      box-shadow: 0 5px 18px color-mix(in srgb, var(--portal-navy) 10%, transparent), 0 0 0 1px var(--portal-border) !important;
    }
    .hide-scrollbar::-webkit-scrollbar {
      display: none;
    }
    .hide-scrollbar {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
    .tab-content-anim {
      animation: tabFadeIn 260ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
      opacity: 0;
      will-change: opacity, transform;
    }
    @keyframes tabFadeIn {
      from { opacity: 0; transform: translateY(5px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @media (prefers-reduced-motion: reduce) {
      .tab-content-anim { animation: none; opacity: 1; }
      .stayo-tab { transition: none; }
    }
    /* Fade mask for horizontal scrolling clear feedback on mobile */
    .scroll-mask {
      mask-image: linear-gradient(to right, black 82%, transparent 100%);
      -webkit-mask-image: linear-gradient(to right, black 82%, transparent 100%);
    }
    @media (min-width: 640px) {
      .scroll-mask {
        mask-image: none;
        -webkit-mask-image: none;
      }
    }
    @media (max-width: 639px) {
      .stayo-tab {
        flex-basis: auto;
        font-size: 0.875rem;
        padding: 0.68rem 0.9rem;
        min-height: 44px;
      }
    }
  `}</style>
);

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StyleInjection />
      <PortalShell framed={false} showBrand={false}>{children}</PortalShell>
    </>
  );
}

function LoadingBlock() {
  return <PortalSkeleton />;
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

  if (auth.status !== "authenticated" || !auth.account) {
    return (
      <Shell>
        <PortalSkeleton rows={2} />
      </Shell>
    );
  }

  return (
    <Shell>
      <OwnerHomeContent ownerId={auth.account.ownerId} onSignOut={() => signOut.mutate()} />
    </Shell>
  );
}

function OwnerHomeContent({ ownerId, onSignOut }: { ownerId: string; onSignOut: () => void }) {
  const [activeTab, setActiveTab] = useState("visao-geral");
  const tabsListRef = useRef<HTMLDivElement>(null);
  const ownerQ = useQuery(ownerQuery(ownerId));
  const tasksQ = useQuery(ownerTasksQuery(ownerId));
  const implementationsQ = useQuery(implementationsListQuery());
  const attachmentsQ = useQuery({
    queryKey: ["owner-attachments", ownerId],
    queryFn: () => listOwnerAttachments(ownerId),
  });
  const download = useMutation({
    mutationFn: (storagePath: string) => getAttachmentSignedUrl(storagePath),
    onSuccess: (url) => window.open(url, "_blank", "noopener,noreferrer"),
  });
  
  const pending = (tasksQ.data ?? []).filter((t) => t.status === "pending");
  const firstName = ownerQ.data?.name?.split(" ")[0] ?? "proprietário";
  const implementation = implementationsQ.data?.data.find((item) => item.ownerId === ownerId);

  return (
    <div className="space-y-2">
      <PortalHero firstName={firstName} implementation={implementation} onSignOut={onSignOut} />

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
        className="mt-5 w-full sm:mt-7"
      >
        <div 
          className="sticky top-2 z-20 mb-7 max-w-full overflow-hidden rounded-[14px] border border-[var(--portal-border)] bg-[color-mix(in_srgb,var(--portal-bg)_88%,transparent)] p-1.5 shadow-[0_8px_26px_color-mix(in_srgb,var(--portal-navy)_7%,transparent)] backdrop-blur-xl sm:top-4 sm:mb-9"
        >
          <TabsList ref={tabsListRef} aria-label="Navegação do Portal" className="hide-scrollbar scroll-mask flex h-auto w-full snap-x snap-mandatory scroll-px-2 scroll-smooth justify-start gap-1 overflow-x-auto overflow-y-hidden bg-transparent p-0">
            <TabsTrigger value="visao-geral" className="stayo-tab snap-start">
              Visão geral
            </TabsTrigger>
            <TabsTrigger value="implantacao" className="stayo-tab snap-start">
              Minha implantação
            </TabsTrigger>
            <TabsTrigger value="dados" className="stayo-tab snap-start">
              Meus dados
            </TabsTrigger>
            <TabsTrigger value="proposta" className="stayo-tab snap-start">
              Proposta
            </TabsTrigger>
            <TabsTrigger value="documentos" className="stayo-tab snap-start">
              Documentos
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="visao-geral" className="tab-content-anim space-y-6">
          <section>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--portal-gold-soft)] text-[var(--portal-gold)]">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Precisamos de você</h2>
                <p className="text-xs text-[var(--portal-muted)]">
                  Tudo o que depende de você, reunido com clareza.
                </p>
              </div>
            </div>
            <div>
              {tasksQ.isPending ? (
                <LoadingBlock />
              ) : pending.length === 0 ? (
                <PortalEmptyState positive title="Tudo em dia por aqui" description="Você não tem nenhuma ação pendente agora. Quando precisarmos de algo, avisaremos por aqui." />
              ) : (
                <ul className="portal-card divide-y divide-[var(--portal-border)]">
                  {pending.map((task) => (
                    <li key={task.id} className="flex items-start justify-between gap-4 py-4 first:pt-1 last:pb-1">
                      <div>
                        <p className="text-sm font-medium">{task.title}</p>
                        <p className="mt-1 text-xs text-[var(--portal-muted)]">
                          {ownerTaskKindLabels[task.kind] ?? task.kind} · {ownerTaskStatusLabels[task.status]}
                        </p>
                      </div>
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--stayo-gold)]" />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="implantacao" className="tab-content-anim space-y-6">
          {implementationsQ.isPending ? (
            <PortalSkeleton rows={4} />
          ) : implementation ? (
            <ImplementationJourney implementation={implementation} />
          ) : (
            <PortalEmptyState icon={<Key />} title="Estamos preparando seu imóvel" description="Assim que os próximos marcos estiverem definidos, você poderá acompanhar cada avanço nesta área." />
          )}
        </TabsContent>

        <TabsContent value="dados" className="tab-content-anim space-y-6">
           <div className="portal-card">
             <div className="mb-6 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full"
                     style={{ backgroundColor: "var(--portal-gold-soft)", color: "var(--portal-gold)" }}
                >
                  <User className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: "var(--stayo-ink)" }}>Seus dados</h3>
                   <p className="text-xs text-[var(--portal-muted)]">Informações cadastrais e de contato.</p>
                </div>
             </div>
             
             <dl className="grid gap-6 sm:grid-cols-2">
               <div>
                 <dt className="mb-1 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--stayo-ink-muted)" }}>
                   Nome completo
                 </dt>
                  <dd className="text-sm font-medium text-[var(--portal-ink)]">
                    {ownerQ.data?.name || "Vamos completar juntos"}
                 </dd>
               </div>
               <div>
                 <dt className="mb-1 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--stayo-ink-muted)" }}>
                   E-mail
                 </dt>
                 <dd className="text-sm font-medium" style={{ color: "var(--stayo-ink)" }}>
                    {ownerQ.data?.email || "Vamos completar juntos"}
                 </dd>
               </div>
               <div>
                 <dt className="mb-1 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--stayo-ink-muted)" }}>
                   Telefone
                 </dt>
                 <dd className="text-sm font-medium" style={{ color: "var(--stayo-ink)" }}>
                    {ownerQ.data?.phone || "Vamos completar juntos"}
                 </dd>
               </div>
               <div>
                 <dt className="mb-1 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--stayo-ink-muted)" }}>
                   Documento principal
                 </dt>
                 <dd className="text-sm font-medium" style={{ color: "var(--stayo-ink)" }}>
                    {ownerQ.data?.document || "Vamos completar juntos"}
                 </dd>
               </div>
             </dl>
          </div>
        </TabsContent>

        <TabsContent value="proposta" className="tab-content-anim space-y-6">
           <PortalEmptyState icon={<FileSignature />} title="Nenhuma proposta aguardando você" description="Quando houver uma proposta pronta para leitura ou aceite, ela ficará disponível aqui." />
        </TabsContent>

        <TabsContent value="documentos" className="tab-content-anim space-y-6">
          <section>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl"
                   style={{ backgroundColor: "var(--portal-gold-soft)", color: "var(--portal-gold)" }}
              >
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Seus documentos</h2>
                <p className="text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
                  Arquivos importantes reunidos em um só lugar.
                </p>
              </div>
            </div>
            <div>
              {attachmentsQ.isPending ? (
                <LoadingBlock />
              ) : (attachmentsQ.data ?? []).length === 0 ? (
                 <PortalEmptyState icon={<FileText />} title="Sua pasta está pronta" description="Os documentos liberados pela equipe Stayo aparecerão aqui, organizados para você." />
              ) : (
                <ul className="portal-card divide-y divide-[var(--portal-border)]">
                  {(attachmentsQ.data ?? []).map((att) => (
                    <li key={att.id} className="flex items-center justify-between gap-4 py-4 first:pt-1 last:pb-1">
                      <span className="min-w-0 truncate text-sm font-medium">{att.filename}</span>
                       <Button
                        type="button"
                        onClick={() => download.mutate(att.storagePath)}
                        disabled={download.isPending}
                         variant="ghost"
                         size="sm"
                         className="portal-action shrink-0 text-[var(--portal-navy)] hover:bg-[var(--portal-surface-soft)]"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Baixar
                       </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
