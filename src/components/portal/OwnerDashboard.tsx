/**
 * Painel principal do proprietário (Fase 2) — visão geral com receita,
 * ações prioritárias e próximas movimentações. Renderizado na aba
 * "Visão geral" do portal, acima do histórico da implantação.
 *
 * Regras de dados:
 * - Receita/líquido só aparecem na fase de operação e só para papéis com
 *   `canViewFinance` (representante legal vê estado de acesso restrito).
 * - Números vêm das reservas reais; sem dados, mostramos estado vazio
 *   honesto — nunca valores inventados.
 * - Líquido estimado usa a taxa de administração das condições comerciais;
 *   sem taxa cadastrada, mostra "—" em vez de chutar.
 */

import {
  ArrowRight,
  CalendarRange,
  CircleCheckBig,
  ClipboardList,
  House,
  LockKeyhole,
  MessageCircle,
  RefreshCw,
  TrendingUp,
  WalletCards,
} from "lucide-react";

import type { OwnerPortalPermissions } from "../../lib/owner-permissions";
import type { OwnerPortalPhase } from "../../lib/owner-portal-lifecycle";
import type { PortalTimelineEvent } from "../../lib/api/owner-portal-data";
import type { Reservation } from "../../types/core";
import { PortalEmptyState, PortalSkeleton } from "./PortalExperience";

const SUPPORT_WHATSAPP = "https://wa.me/5554991403953";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const dayFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

interface DashboardTask {
  id: string;
  title: string;
}

export interface OwnerDashboardProps {
  phase: OwnerPortalPhase;
  permissions: OwnerPortalPermissions;
  propertyName: string;
  consolidated: boolean;
  propertyCount: number;
  reservations: Reservation[] | undefined;
  reservationsPending: boolean;
  reservationsError: boolean;
  onRetryReservations: () => void;
  adminFeePercent: number | null;
  pendingTasks: DashboardTask[];
  timeline: PortalTimelineEvent[];
  goTo: (tab: string) => void;
}

function monthRevenue(reservations: Reservation[]): number {
  const now = new Date();
  return reservations
    .filter((r) => {
      if (r.amount == null) return false;
      const checkin = new Date(`${r.checkin}T12:00:00`);
      return checkin.getMonth() === now.getMonth() && checkin.getFullYear() === now.getFullYear();
    })
    .reduce((sum, r) => sum + (r.amount ?? 0), 0);
}

function upcomingReservations(reservations: Reservation[]): Reservation[] {
  const today = new Date().toISOString().slice(0, 10);
  return reservations
    .filter((r) => r.checkin >= today && r.status !== "cancelled")
    .sort((a, b) => a.checkin.localeCompare(b.checkin))
    .slice(0, 3);
}

function RevenueBlock({
  permissions,
  reservations,
  reservationsPending,
  reservationsError,
  onRetryReservations,
  adminFeePercent,
}: Pick<
  OwnerDashboardProps,
  | "permissions"
  | "reservations"
  | "reservationsPending"
  | "reservationsError"
  | "onRetryReservations"
  | "adminFeePercent"
>) {
  if (!permissions.canViewFinance) {
    return (
      <PortalEmptyState
        icon={<LockKeyhole />}
        title="Financeiro restrito"
        description="Seu acesso como representante legal não inclui receita e repasses. O proprietário titular acompanha esses valores."
      />
    );
  }
  if (reservationsPending) return <PortalSkeleton rows={3} />;
  if (reservationsError) {
    return (
      <div className="owner-dash-error" role="alert">
        <p>Não conseguimos carregar os números do seu imóvel agora.</p>
        <button type="button" onClick={onRetryReservations} className="portal-action">
          <RefreshCw aria-hidden="true" /> Tentar novamente
        </button>
      </div>
    );
  }

  const list = reservations ?? [];
  const revenue = monthRevenue(list);
  const hasAmounts = list.some((r) => r.amount != null);
  const net = adminFeePercent != null && revenue > 0 ? revenue * (1 - adminFeePercent / 100) : null;

  if (!hasAmounts) {
    return (
      <PortalEmptyState
        positive
        icon={<TrendingUp />}
        title="Receita em apuração"
        description="Assim que as primeiras reservas com valores forem confirmadas, a receita e o seu líquido aparecem aqui."
        nextStep="Você não precisa fazer nada. A equipe Stayo mantém esta área atualizada."
      />
    );
  }

  const metrics = [
    { label: "Receita do mês", value: currency.format(revenue), icon: TrendingUp },
    {
      label: "Líquido estimado",
      value: net != null ? currency.format(net) : "—",
      icon: WalletCards,
    },
    {
      label: "Repasse",
      value: revenue > 0 ? "Em apuração" : "Sem repasse previsto",
      icon: CircleCheckBig,
    },
  ];

  return (
    <div className="portal-operation-metrics" aria-label="Resumo financeiro">
      {metrics.map(({ label, value, icon: Icon }) => (
        <div key={label}>
          <Icon aria-hidden="true" />
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function PriorityActions({
  propertyName,
  permissions,
  phase,
  goTo,
}: Pick<OwnerDashboardProps, "propertyName" | "permissions" | "phase" | "goTo">) {
  const blockMessage = encodeURIComponent(
    `Olá! Quero solicitar um bloqueio / uso próprio do imóvel ${propertyName}.`,
  );
  const actions = [
    {
      key: "bloqueio",
      icon: House,
      label: "Solicitar bloqueio ou uso próprio",
      href: `${SUPPORT_WHATSAPP}?text=${blockMessage}`,
    },
    ...(phase === "operation"
      ? [
          {
            key: "calendario",
            icon: CalendarRange,
            label: "Consultar calendário",
            tab: "calendar",
          },
        ]
      : []),
    ...(permissions.canViewFinance && phase === "operation"
      ? [
          {
            key: "demonstrativos",
            icon: WalletCards,
            label: "Ver demonstrativos",
            tab: "finance",
          },
        ]
      : []),
    {
      key: "suporte",
      icon: MessageCircle,
      label: "Falar com a equipe Stayo",
      href: SUPPORT_WHATSAPP,
    },
  ];

  return (
    <section aria-label="Ações rápidas">
      <p className="portal-milestones-eyebrow">Ações rápidas</p>
      <div className="owner-dash-actions">
        {actions.map(({ key, icon: Icon, label, ...target }) =>
          "href" in target ? (
            <a
              key={key}
              href={target.href}
              target="_blank"
              rel="noopener noreferrer"
              className="owner-dash-action portal-action"
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
              <ArrowRight aria-hidden="true" className="owner-dash-action-arrow" />
            </a>
          ) : (
            <button
              key={key}
              type="button"
              onClick={() => goTo(target.tab!)}
              className="owner-dash-action portal-action"
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
              <ArrowRight aria-hidden="true" className="owner-dash-action-arrow" />
            </button>
          ),
        )}
      </div>
    </section>
  );
}

function UpcomingMovements({
  reservations,
  pendingTasks,
  timeline,
  goTo,
}: Pick<OwnerDashboardProps, "reservations" | "pendingTasks" | "timeline" | "goTo">) {
  const nextStays = upcomingReservations(reservations ?? []);
  const items: { key: string; icon: typeof CalendarRange; title: string; detail: string }[] = [
    ...nextStays.map((r) => ({
      key: `res-${r.id}`,
      icon: CalendarRange,
      title: `Reserva de ${r.guestName ?? "hóspede"}`,
      detail: `${dayFmt.format(new Date(`${r.checkin}T12:00:00`))} → ${dayFmt.format(
        new Date(`${r.checkout}T12:00:00`),
      )}`,
    })),
    ...pendingTasks.slice(0, 2).map((t) => ({
      key: `task-${t.id}`,
      icon: ClipboardList,
      title: t.title,
      detail: "Pendência com você",
    })),
    ...timeline.slice(0, 2).map((e) => ({
      key: `tl-${e.id}`,
      icon: CircleCheckBig,
      title: e.title,
      detail: dayFmt.format(new Date(e.createdAt)),
    })),
  ].slice(0, 4);

  return (
    <section aria-label="Próximas movimentações">
      <p className="portal-milestones-eyebrow">Próximas movimentações</p>
      {items.length === 0 ? (
        <PortalEmptyState
          positive
          icon={<CircleCheckBig />}
          title="Tudo em dia"
          description="Nenhuma movimentação prevista para o seu imóvel no momento."
        />
      ) : (
        <ul className="owner-dash-next">
          {items.map(({ key, icon: Icon, title, detail }) => (
            <li key={key}>
              <Icon aria-hidden="true" />
              <div>
                <strong>{title}</strong>
                <span>{detail}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {pendingTasks.length > 0 && (
        <button type="button" className="owner-dash-link" onClick={() => goTo("visao-geral")}>
          Ver pendências <ArrowRight aria-hidden="true" />
        </button>
      )}
    </section>
  );
}

export function OwnerDashboard(props: OwnerDashboardProps) {
  return (
    <div className="owner-dash">
      {props.phase === "operation" && (
        <section aria-label="Receita e repasses">
          <p className="portal-milestones-eyebrow">
            {props.consolidated && props.propertyCount > 1
              ? `Receita consolidada · ${props.propertyCount} imóveis`
              : "Receita e repasses"}
          </p>
          <RevenueBlock
            permissions={props.permissions}
            reservations={props.reservations}
            reservationsPending={props.reservationsPending}
            reservationsError={props.reservationsError}
            onRetryReservations={props.onRetryReservations}
            adminFeePercent={props.adminFeePercent}
          />
        </section>
      )}
      <PriorityActions
        propertyName={props.propertyName}
        permissions={props.permissions}
        phase={props.phase}
        goTo={props.goTo}
      />
      <UpcomingMovements
        reservations={props.reservations}
        pendingTasks={props.pendingTasks}
        timeline={props.timeline}
        goTo={props.goTo}
      />
    </div>
  );
}
