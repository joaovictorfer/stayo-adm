import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Flag,
  ListChecks,
  Menu,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import logoAsset from "../assets/stayo-logo-clara.png.asset.json";
import { OwnerOnboardingFlow } from "../components/portal/OwnerOnboardingFlow";
import { Button } from "../components/ui/button";
import { adminApi, ownerPortalAccessQuery } from "../lib/api/queries";
import {
  availableOwnerPortalModules,
  isOwnerPortalModuleAvailable,
  ownerPortalStage,
} from "../lib/owner-portal-lifecycle";
import { formatMoney } from "../lib/format";
import type { OwnerPortalModule, OwnerPortalSnapshot, OwnerPortalStage } from "../types/owner-portal";

export const Route = createFileRoute("/portal/implantacao/$token")({
  head: () => ({
    meta: [
      { title: "Portal do Proprietário — Stayo" },
      { name: "description", content: "Acompanhe seu imóvel em todas as etapas com a Stayo." },
      { property: "og:title", content: "Portal do Proprietário — Stayo" },
      { property: "og:description", content: "Acompanhe seu imóvel em todas as etapas com a Stayo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OwnerPortal,
});

const publicStages = ["Proposta", "Planejamento", "Preparação do imóvel", "Configuração", "Validação", "Pronto para operar"];

const moduleLabels: Record<OwnerPortalModule, string> = {
  overview: "Visão geral",
  implementation: "Minha implantação",
  profile: "Meus dados",
  proposal: "Proposta",
  reservations: "Reservas",
  calendar: "Calendário",
  property: "Meu imóvel",
  inspections: "Vistorias",
  maintenance: "Manutenções",
  financial: "Financeiro",
  documents: "Documentos",
};

function publicStageIndex(status: OwnerPortalSnapshot["status"]): number {
  if (["prospect", "proposta", "aguardando_aprovacao"].includes(status)) return 0;
  if (["aprovado", "planejamento"].includes(status)) return 1;
  if (status === "em_implantacao") return 2;
  if (status === "validacao") return 4;
  if (status === "pronto_para_operacao" || status === "ativo") return 5;
  return 0;
}

function PortalShell({ children, stage }: { children: React.ReactNode; stage?: OwnerPortalStage }) {
  return (
    <div className="stayo-owner-portal min-h-screen bg-background text-foreground">
      <header className="bg-portal-navy px-4 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <img src={logoAsset.url} alt="Stayo Gramado" className="w-28" />
          {stage ? <span className="rounded-full border border-primary-foreground/25 px-3 py-1 text-xs font-semibold text-primary-foreground">{stage === "active" ? "Imóvel ativo" : stage === "ready" ? "Pronto para operar" : "Em implantação"}</span> : null}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-9">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-center text-xs text-muted-foreground">Portal seguro Stayo</footer>
    </div>
  );
}

function OwnerPortal() {
  const { token } = Route.useParams();
  const query = useQuery(ownerPortalAccessQuery(token));

  if (query.isPending) return <PortalShell><div className="h-52 animate-pulse rounded-lg bg-card shadow-[var(--shadow-card)]" /></PortalShell>;
  if (query.isError || !query.data) {
    return <PortalShell><div className="rounded-lg border border-border bg-card p-7 shadow-[var(--shadow-card)]"><h1 className="text-xl font-semibold">Acesso indisponível</h1><p className="mt-2 text-sm text-muted-foreground">Este link expirou, foi revogado ou não existe. Solicite um novo acesso à equipe Stayo.</p></div></PortalShell>;
  }

  return <ProgressivePortal token={token} snapshot={query.data.snapshot} />;
}

function ProgressivePortal({ token, snapshot }: { token: string; snapshot: OwnerPortalSnapshot }) {
  const stage = ownerPortalStage(snapshot.status, snapshot.corePropertyId ?? null);
  const modules = useMemo(() => availableOwnerPortalModules(snapshot), [snapshot]);
  const [activeModule, setActiveModule] = useState<OwnerPortalModule>("overview");
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    if (!isOwnerPortalModuleAvailable(snapshot, activeModule)) setActiveModule("overview");
  }, [activeModule, snapshot]);

  const choose = (module: OwnerPortalModule) => {
    setActiveModule(module);
    setMobileMenu(false);
  };

  return (
    <PortalShell stage={stage}>
      <div className="space-y-6">
        <section className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-premium">{snapshot.propertyLabel}</p>
            <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Olá, {snapshot.ownerFirstName}.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{stage === "active" ? "Seu imóvel está em operação com a Stayo." : stage === "ready" ? "Seu imóvel está pronto para começar a receber hóspedes." : "Estamos preparando seu imóvel para começar a operar com a Stayo."}</p>
          </div>
          <Button variant="outline" size="icon" className="shrink-0 md:hidden" onClick={() => setMobileMenu((value) => !value)} aria-label="Abrir menu">{mobileMenu ? <X /> : <Menu />}</Button>
        </section>

        <nav aria-label="Portal do proprietário" className={`${mobileMenu ? "grid" : "hidden"} gap-1 rounded-lg border border-border bg-card p-2 shadow-[var(--shadow-card)] md:flex md:overflow-x-auto`}>
          {modules.map((module) => (
            <Button key={module} variant={activeModule === module ? "default" : "ghost"} size="sm" className="justify-start whitespace-nowrap" onClick={() => choose(module)}>{moduleLabels[module]}</Button>
          ))}
        </nav>

        {stage === "ready" && activeModule === "overview" ? <ReadyTransition snapshot={snapshot} /> : null}
        {activeModule === "overview" ? (stage === "active" ? <ActiveOverview snapshot={snapshot} /> : <ImplementationOverview snapshot={snapshot} />) : null}
        {activeModule === "implementation" ? <ImplementationDetails snapshot={snapshot} /> : null}
        {activeModule === "profile" ? <OwnerOnboardingFlow token={token} snapshot={snapshot} /> : null}
        {activeModule === "proposal" ? <Proposal token={token} snapshot={snapshot} /> : null}
        {activeModule === "reservations" ? <Reservations snapshot={snapshot} /> : null}
        {activeModule === "calendar" ? <EmptyModule icon={<CalendarDays />} title="Calendário" description="As datas das reservas aparecerão aqui quando forem recebidas do sistema oficial." /> : null}
        {activeModule === "property" ? <PropertyView snapshot={snapshot} /> : null}
        {activeModule === "inspections" ? <Inspections snapshot={snapshot} /> : null}
        {activeModule === "maintenance" ? <Maintenance snapshot={snapshot} /> : null}
        {activeModule === "financial" ? <Financial snapshot={snapshot} /> : null}
        {activeModule === "documents" ? <EmptyModule icon={<FileText />} title="Documentos" description="Nenhum documento foi liberado para este acesso." /> : null}
      </div>
    </PortalShell>
  );
}

function ReadyTransition({ snapshot }: { snapshot: OwnerPortalSnapshot }) {
  const transition = snapshot.transition;
  return (
    <section className="border-l-4 border-[#b38a44] bg-[#fffaf0] p-5 sm:p-6">
      <div className="flex gap-3"><Sparkles className="shrink-0 text-[#8a682d]" /><div><h2 className="text-lg font-semibold">Seu imóvel está pronto para começar a receber hóspedes.</h2><p className="mt-1 text-sm leading-6 text-[#6b7785]">Estamos concluindo a ativação operacional. Os novos menus serão liberados após o vínculo com o imóvel oficial.</p></div></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TransitionItem label="Data de ativação" value={snapshot.activationDate ? formatDate(snapshot.activationDate) : "A confirmar"} />
        <TransitionItem label="Vistoria inicial" value={transitionLabel(transition?.initialInspection)} />
        <TransitionItem label="Configuração Guest" value={transitionLabel(transition?.guestConfiguration)} />
        <TransitionItem label="Anúncios e canais" value={transition?.channels.length ? transition.channels.join(", ") : "Ainda não disponíveis"} />
      </div>
    </section>
  );
}

function ImplementationOverview({ snapshot }: { snapshot: OwnerPortalSnapshot }) {
  const stage = publicStageIndex(snapshot.status);
  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Summary icon={<Flag />} label="Etapa atual" value={publicStages[stage] ?? "Proposta"} />
        <Summary icon={<CheckCircle2 />} label="Progresso" value={`${snapshot.visibleProgress.percent}%`} hint={`${snapshot.visibleProgress.done} de ${snapshot.visibleProgress.total} atividades`} />
        <Summary icon={<CalendarDays />} label="Previsão" value={formatDate(snapshot.completionDateEstimate ?? snapshot.startDateEstimate)} />
        <Summary icon={<ListChecks />} label="Precisamos de você" value={String(snapshot.tasks.length)} hint="pendências visíveis" />
      </section>
      <ImplementationTimeline stage={stage} />
      <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-lg border border-[#e4e8ec] bg-white p-5 sm:p-6"><h2 className="font-semibold">Precisamos de você</h2><p className="mt-1 text-sm text-[#6b7785]">Somente tarefas compartilhadas pela equipe Stayo aparecem aqui.</p><div className="mt-4 space-y-3">{snapshot.tasks.length ? snapshot.tasks.map((task) => <div key={`${task.source}-${task.id}`} className="rounded-md border border-[#e4e8ec] p-4"><p className="text-sm font-semibold">{task.title}</p>{task.description ? <p className="mt-1 text-sm text-[#6b7785]">{task.description}</p> : null}</div>) : <p className="rounded-md bg-[#f5f7f9] p-4 text-sm text-[#6b7785]">Nenhuma pendência sua no momento.</p>}</div></section>
        <Updates snapshot={snapshot} />
      </div>
    </div>
  );
}

function ActiveOverview({ snapshot }: { snapshot: OwnerPortalSnapshot }) {
  const metrics: Array<{ label: string; value: string }> = [
    { label: "Resumo do mês", value: "Sem dados" },
    { label: "Ocupação", value: "Sem dados" },
    { label: "Receita", value: "Sem dados" },
    { label: "Diária média", value: "Sem dados" },
    { label: "Próximas reservas", value: "Sem dados" },
    { label: "Repasse previsto", value: "Sem dados" },
  ];
  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {metrics.map((metric) => <Summary key={metric.label} icon={<ReceiptText />} label={metric.label} value={metric.value} />)}
      </section>
      <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <EmptyModule icon={<CalendarDays />} title="Próximas reservas" description="As próximas reservas aparecerão quando a integração oficial fornecer os dados deste imóvel." />
        <Updates snapshot={snapshot} />
      </div>
    </div>
  );
}

function ImplementationDetails({ snapshot }: { snapshot: OwnerPortalSnapshot }) {
  return <div className="space-y-5"><ImplementationTimeline stage={publicStageIndex(snapshot.status)} /><section className="rounded-lg border border-[#e4e8ec] bg-white p-5"><h2 className="font-semibold">Resumo da implantação</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2"><Detail label="Imóvel" value={snapshot.propertyLabel} /><Detail label="Etapa" value={publicStages[publicStageIndex(snapshot.status)] ?? "Proposta"} /><Detail label="Início estimado" value={formatDate(snapshot.startDateEstimate)} /><Detail label="Conclusão estimada" value={formatDate(snapshot.completionDateEstimate)} /></dl></section></div>;
}

function Proposal({ token, snapshot }: { token: string; snapshot: OwnerPortalSnapshot }) {
  const queryClient = useQueryClient();
  const [acceptedName, setAcceptedName] = useState("");
  const accept = useMutation({ mutationFn: () => adminApi.ownerOnboarding.acceptPortalProposal(token, acceptedName.trim()), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["owner-portal", "access", token] }) });
  if (!snapshot.proposal) return <EmptyModule icon={<FileText />} title="Proposta" description="Nenhuma proposta está disponível neste momento." />;
  return <section className="rounded-lg border border-[#dfd0ad] bg-white p-5 sm:p-6"><div className="flex items-start gap-3"><FileText className="text-[#8a682d]" /><div><h2 className="font-semibold">Proposta · versão {snapshot.proposal.version}</h2><p className="mt-1 text-2xl font-semibold text-[#0b3150]">{formatMoney(snapshot.proposal.total)}</p></div></div>{snapshot.proposal.acceptedAt ? <p className="mt-4 rounded-md bg-[#edf7f2] p-3 text-sm font-medium text-[#237a57]">Proposta aceita em {new Date(snapshot.proposal.acceptedAt).toLocaleString("pt-BR")}.</p> : <div className="mt-4 border-t border-[#e4e8ec] pt-4"><label className="text-xs font-semibold text-[#6b7785]">Seu nome para confirmar o aceite</label><div className="mt-2 flex flex-col gap-2 sm:flex-row"><input value={acceptedName} onChange={(event) => setAcceptedName(event.target.value)} className="min-w-0 flex-1 rounded-md border border-[#d8dde2] bg-white px-3 py-2 text-sm" placeholder="Nome completo" /><Button onClick={() => accept.mutate()} disabled={acceptedName.trim().length < 2 || accept.isPending}>{accept.isPending ? "Confirmando..." : "Aceitar proposta"}</Button></div>{accept.isError ? <p className="mt-2 text-sm text-red-700">Não foi possível confirmar. Tente novamente.</p> : null}</div>}</section>;
}

function Reservations({ snapshot }: { snapshot: OwnerPortalSnapshot }) {
  const reservations = snapshot.operations?.reservations ?? [];
  if (!reservations.length) return <EmptyModule icon={<CalendarDays />} title="Reservas" description="Ainda não há reservas disponíveis para este imóvel." />;
  return <section className="overflow-hidden rounded-lg border border-[#e4e8ec] bg-white"><div className="border-b border-[#e4e8ec] p-5"><h2 className="font-semibold">Reservas</h2></div><div className="divide-y divide-[#e4e8ec]">{reservations.map((reservation) => <div key={reservation.id} className="grid gap-2 p-4 text-sm sm:grid-cols-5"><span>{formatDate(reservation.checkin)} — {formatDate(reservation.checkout)}</span><span>{reservation.propertyName}</span><span>{reservation.channel ?? "Canal não informado"}</span><span>{reservation.guestCount ?? "—"} hóspedes</span><span>{reservation.amount === null ? "Valor não disponível" : formatMoney(reservation.amount)}</span></div>)}</div></section>;
}

function PropertyView({ snapshot }: { snapshot: OwnerPortalSnapshot }) {
  return <section className="rounded-lg border border-[#e4e8ec] bg-white p-5 sm:p-6"><div className="flex gap-3"><Building2 className="text-[#8a682d]" /><div><h2 className="font-semibold">{snapshot.propertyLabel}</h2><p className="mt-1 text-sm text-[#6b7785]">Imóvel ativo e vinculado à operação Stayo.</p></div></div></section>;
}

function Inspections({ snapshot }: { snapshot: OwnerPortalSnapshot }) {
  return (snapshot.operations?.inspections.length ?? 0) === 0 ? <EmptyModule icon={<ShieldCheck />} title="Vistorias" description="Nenhuma vistoria foi liberada para sua visualização." /> : <EmptyModule icon={<ShieldCheck />} title="Vistorias" description="As vistorias liberadas aparecem aqui." />;
}

function Maintenance({ snapshot }: { snapshot: OwnerPortalSnapshot }) {
  return (snapshot.operations?.maintenance.length ?? 0) === 0 ? <EmptyModule icon={<Wrench />} title="Manutenções" description="Nenhuma ocorrência de manutenção está visível no momento." /> : <EmptyModule icon={<Wrench />} title="Manutenções" description="As manutenções compartilhadas aparecem aqui." />;
}

function Financial({ snapshot }: { snapshot: OwnerPortalSnapshot }) {
  const items = snapshot.operations?.financial ?? [];
  return <div className="space-y-5"><section className="grid gap-3 sm:grid-cols-3"><Summary icon={<ReceiptText />} label="Demonstrativos" value="Sem dados" /><Summary icon={<ReceiptText />} label="Repasses" value="Sem dados" /><Summary icon={<ReceiptText />} label="Despesas" value="Sem dados" /></section>{items.length ? null : <EmptyModule icon={<ReceiptText />} title="Movimentações financeiras" description="Demonstrativos, repasses, despesas e arquivos PDF/CSV aparecerão quando enviados pelo sistema financeiro oficial." />}</div>;
}

function ImplementationTimeline({ stage }: { stage: number }) {
  return <section className="rounded-lg border border-[#e4e8ec] bg-white p-5 sm:p-6"><h2 className="font-semibold">Próximos marcos</h2><div className="mt-5 grid grid-cols-3 gap-y-5 sm:grid-cols-6">{publicStages.map((label, index) => <div key={label} className="text-center"><span className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold ${index < stage ? "border-[#237a57] bg-[#237a57] text-white" : index === stage ? "border-[#0b3150] bg-[#0b3150] text-white" : "border-[#d8dde2] bg-white text-[#6b7785]"}`}>{index < stage ? "✓" : index + 1}</span><p className="mt-2 px-1 text-[11px] leading-tight text-[#6b7785]">{label}</p></div>)}</div></section>;
}

function Updates({ snapshot }: { snapshot: OwnerPortalSnapshot }) {
  return <section className="rounded-lg border border-[#e4e8ec] bg-white p-5 sm:p-6"><h2 className="font-semibold">Atualizações</h2><div className="mt-4 space-y-4">{snapshot.updates.length ? snapshot.updates.slice(0, 6).map((update) => <div key={update.id} className="flex gap-3"><Clock3 className="mt-0.5 shrink-0 text-[#237a57]" size={17} /><div><p className="text-sm font-medium">{update.title}</p><p className="text-xs text-[#6b7785]">{new Date(update.completedAt).toLocaleDateString("pt-BR")}</p></div></div>) : <p className="text-sm text-[#6b7785]">As atualizações públicas aparecerão aqui.</p>}</div></section>;
}

function EmptyModule({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <section className="rounded-lg border border-dashed border-[#cfd6dc] bg-white p-6 sm:p-8"><div className="text-[#8a682d] [&>svg]:h-5 [&>svg]:w-5">{icon}</div><h2 className="mt-3 font-semibold">{title}</h2><p className="mt-1 max-w-xl text-sm leading-6 text-[#6b7785]">{description}</p></section>;
}

function Summary({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return <div className="rounded-lg border border-[#e4e8ec] bg-white p-4"><div className="text-[#8a682d] [&>svg]:h-4 [&>svg]:w-4">{icon}</div><p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-[#6b7785]">{label}</p><p className="mt-1 text-sm font-semibold sm:text-base">{value}</p>{hint ? <p className="mt-1 text-[11px] text-[#6b7785]">{hint}</p> : null}</div>;
}

function TransitionItem({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-semibold text-[#6b7785]">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-semibold text-[#6b7785]">{label}</dt><dd className="mt-1 text-sm">{value}</dd></div>;
}

function transitionLabel(value?: "pending" | "scheduled" | "completed" | "in_progress" | "unavailable"): string {
  if (value === "completed") return "Concluída";
  if (value === "scheduled") return "Agendada";
  if (value === "in_progress") return "Em andamento";
  if (value === "pending") return "Pendente";
  return "Ainda não disponível";
}

function formatDate(value: string | null): string {
  if (!value) return "A confirmar";
  const normalized = value.length === 10 ? `${value}T12:00:00` : value;
  return new Date(normalized).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}