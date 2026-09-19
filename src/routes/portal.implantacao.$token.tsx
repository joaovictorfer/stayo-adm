import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, CheckCircle2, Clock3, FileText, Flag, ListChecks } from "lucide-react";
import { useState } from "react";

import logoAsset from "../assets/stayo-logo-clara.png.asset.json";
import { OwnerOnboardingFlow } from "../components/portal/OwnerOnboardingFlow";
import { adminApi, ownerPortalAccessQuery } from "../lib/api/queries";
import { formatMoney } from "../lib/format";
import type { OwnerPortalSnapshot } from "../types/owner-portal";

export const Route = createFileRoute("/portal/implantacao/$token")({
  head: () => ({
    meta: [
      { title: "Implantação do seu imóvel — Stayo" },
      { name: "description", content: "Acompanhe a preparação do seu imóvel para operar com a Stayo." },
      { property: "og:title", content: "Implantação do seu imóvel — Stayo" },
      { property: "og:description", content: "Acompanhe a preparação do seu imóvel para operar com a Stayo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OwnerImplementationPortal,
});

const publicStages = ["Proposta", "Planejamento", "Preparação do imóvel", "Configuração", "Validação", "Pronto para operar"];

function publicStageIndex(status: OwnerPortalSnapshot["status"]): number {
  if (status === "prospect" || status === "proposta" || status === "aguardando_aprovacao") return 0;
  if (status === "aprovado" || status === "planejamento") return 1;
  if (status === "em_implantacao") return 2;
  if (status === "validacao") return 4;
  if (status === "pronto_para_operacao" || status === "ativo") return 5;
  return 0;
}

function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f5f7f9] text-[#17232f]">
      <header className="bg-[#0b3150] px-5 py-5">
        <div className="mx-auto max-w-5xl"><img src={logoAsset.url} alt="Stayo Gramado" className="w-28" /></div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">{children}</main>
      <footer className="mx-auto max-w-5xl px-4 pb-8 text-center text-xs text-[#6b7785]">Portal seguro Stayo · Modo implantação</footer>
    </div>
  );
}

function OwnerImplementationPortal() {
  const { token } = Route.useParams();
  const query = useQuery(ownerPortalAccessQuery(token));

  if (query.isPending) return <PortalShell><div className="h-52 animate-pulse rounded-2xl bg-white" /></PortalShell>;
  if (query.isError || !query.data) {
    return <PortalShell><div className="rounded-2xl border border-[#e4e8ec] bg-white p-7"><h1 className="text-xl font-semibold">Acesso indisponível</h1><p className="mt-2 text-sm text-[#6b7785]">Este link expirou, foi revogado ou não existe. Solicite um novo acesso à equipe Stayo.</p></div></PortalShell>;
  }

  return <PortalDashboard token={token} snapshot={query.data.snapshot} />;
}

function PortalDashboard({ token, snapshot }: { token: string; snapshot: OwnerPortalSnapshot }) {
  const queryClient = useQueryClient();
  const [acceptedName, setAcceptedName] = useState("");
  const stage = publicStageIndex(snapshot.status);
  const accept = useMutation({
    mutationFn: () => adminApi.ownerOnboarding.acceptPortalProposal(token, acceptedName.trim()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["owner-portal", "access", token] }),
  });

  return (
    <div className="space-y-5 sm:space-y-7">
      <section>
        <p className="text-sm font-semibold text-[#a17b39]">{snapshot.propertyLabel}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Olá, {snapshot.ownerFirstName}.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6b7785] sm:text-base">Estamos preparando seu imóvel para começar a operar com a Stayo.</p>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Summary icon={<Flag />} label="Etapa atual" value={publicStages[stage] ?? "Proposta"} />
        <Summary icon={<CheckCircle2 />} label="Progresso" value={`${snapshot.visibleProgress.percent}%`} hint={`${snapshot.visibleProgress.done} de ${snapshot.visibleProgress.total} atividades`} />
        <Summary icon={<CalendarDays />} label="Previsão" value={formatDate(snapshot.completionDateEstimate ?? snapshot.startDateEstimate)} />
        <Summary icon={<ListChecks />} label="Precisamos de você" value={String(snapshot.tasks.length)} hint="pendências visíveis" />
      </section>

      <section className="rounded-2xl border border-[#e4e8ec] bg-white p-5 sm:p-6">
        <h2 className="font-semibold">Próximos marcos</h2>
        <div className="mt-5 grid grid-cols-3 gap-y-5 sm:grid-cols-6">
          {publicStages.map((label, index) => (
            <div key={label} className="relative text-center">
              <span className={`relative z-10 mx-auto flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold ${index < stage ? "border-[#237a57] bg-[#237a57] text-white" : index === stage ? "border-[#0b3150] bg-[#0b3150] text-white" : "border-[#d8dde2] bg-white text-[#6b7785]"}`}>{index < stage ? "✓" : index + 1}</span>
              <p className="mt-2 px-1 text-[11px] leading-tight text-[#6b7785]">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-2xl border border-[#e4e8ec] bg-white p-5 sm:p-6">
          <h2 className="font-semibold">Precisamos de você</h2>
          <p className="mt-1 text-sm text-[#6b7785]">Somente tarefas compartilhadas pela equipe Stayo aparecem aqui.</p>
          <div className="mt-4 space-y-3">
            <OwnerOnboardingFlow token={token} snapshot={snapshot} />
            {snapshot.tasks.length ? snapshot.tasks.map((task) => <div key={`${task.source}-${task.id}`} className="rounded-xl border border-[#e4e8ec] p-4"><p className="text-sm font-semibold">{task.title}</p>{task.description ? <p className="mt-1 text-sm text-[#6b7785]">{task.description}</p> : null}</div>) : <p className="rounded-xl bg-[#f5f7f9] p-4 text-sm text-[#6b7785]">Nenhuma pendência sua no momento.</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-[#e4e8ec] bg-white p-5 sm:p-6">
          <h2 className="font-semibold">Atualizações</h2>
          <div className="mt-4 space-y-4">
            {snapshot.updates.length ? snapshot.updates.slice(0, 6).map((update) => <div key={update.id} className="flex gap-3"><Clock3 className="mt-0.5 shrink-0 text-[#237a57]" size={17} /><div><p className="text-sm font-medium">{update.title}</p><p className="text-xs text-[#6b7785]">{new Date(update.completedAt).toLocaleDateString("pt-BR")}</p></div></div>) : <p className="text-sm text-[#6b7785]">As atualizações públicas aparecerão aqui.</p>}
          </div>
        </section>
      </div>

      {snapshot.proposal ? <section className="rounded-2xl border border-[#dfd0ad] bg-white p-5 sm:p-6"><div className="flex items-start gap-3"><FileText className="text-[#a17b39]" /><div><h2 className="font-semibold">Proposta · versão {snapshot.proposal.version}</h2><p className="mt-1 text-2xl font-semibold text-[#0b3150]">{formatMoney(snapshot.proposal.total)}</p></div></div>{snapshot.proposal.acceptedAt ? <p className="mt-4 rounded-xl bg-[#edf7f2] p-3 text-sm font-medium text-[#237a57]">Proposta aceita em {new Date(snapshot.proposal.acceptedAt).toLocaleString("pt-BR")}.</p> : <div className="mt-4 border-t border-[#e4e8ec] pt-4"><label className="text-xs font-semibold text-[#6b7785]">Seu nome para confirmar o aceite</label><div className="mt-2 flex flex-col gap-2 sm:flex-row"><input value={acceptedName} onChange={(event) => setAcceptedName(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-[#d8dde2] bg-white px-3 py-2 text-sm" placeholder="Nome completo" /><button onClick={() => accept.mutate()} disabled={acceptedName.trim().length < 2 || accept.isPending} className="rounded-lg bg-[#0b3150] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{accept.isPending ? "Confirmando..." : "Aceitar proposta"}</button></div>{accept.isError ? <p className="mt-2 text-sm text-red-700">Não foi possível confirmar. Tente novamente.</p> : null}</div>}</section> : null}

      <section className="rounded-2xl border border-dashed border-[#d8dde2] p-5 text-sm text-[#6b7785]"><strong className="text-[#17232f]">Documentos</strong><p className="mt-1">Nenhum documento foi liberado para este acesso.</p></section>
    </div>
  );
}

function Summary({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return <div className="rounded-2xl border border-[#e4e8ec] bg-white p-4"><div className="text-[#a17b39] [&>svg]:h-4 [&>svg]:w-4">{icon}</div><p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-[#6b7785]">{label}</p><p className="mt-1 text-sm font-semibold text-[#17232f] sm:text-base">{value}</p>{hint ? <p className="mt-1 text-[11px] text-[#6b7785]">{hint}</p> : null}</div>;
}

function formatDate(value: string | null): string {
  if (!value) return "A confirmar";
  return new Date(`${value.length === 10 ? value + "T12:00:00" : value}`).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}