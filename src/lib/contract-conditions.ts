import { formatBRL } from "./money";
import type { ProposalSnapshotContractConditions } from "../types/commercial-proposal";

export type InitialCleaningOption =
  | "owner_delivers"
  | "stayo_initial"
  | "stayo_post_construction"
  | "other"
  | "tbd";
export type CostBearer = "owner" | "stayo";
export type TurnoverPayer = "guest" | "owner";

export const INITIAL_CLEANING_LABELS: Record<InitialCleaningOption, string> = {
  owner_delivers: "Imóvel entregue limpo pelo proprietário",
  stayo_initial: "Limpeza inicial convencional",
  stayo_post_construction: "Limpeza pós-obra",
  other: "Outra condição",
  tbd: "A decidir",
};

export const COST_BEARER_LABELS: Record<CostBearer, string> = {
  owner: "Proprietário",
  stayo: "STAYO",
};

export const TURNOVER_PAYER_LABELS: Record<TurnoverPayer, string> = {
  guest: "Paga pelo hóspede, como taxa de limpeza na reserva",
  owner: "Paga pelo proprietário, descontada do repasse",
};

export const DEFAULT_TURNOVER_TEAM = "Equipe própria STAYO";

export const DEFAULT_PAYOUT_RULE =
  "Automático pela plataforma (Airbnb); demais locações até o dia 10 (Booking, reservas diretas etc.)";

export function formatPercent(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value)}%`;
}

/** Separa a regra de repasse em Airbnb e Booking/diretas quando o texto segue o padrão. */
export function splitPayoutRule(
  text: string | null | undefined,
): { airbnb: string; others: string } | null {
  if (!text) return null;
  const match = text.match(
    /Reservas pelo Airbnb:\s*(.+?)\s*Reservas pelo Booking e reservas diretas:\s*(.+)$/is,
  );
  if (!match?.[1] || !match[2]) return null;
  return { airbnb: match[1].trim(), others: match[2].trim() };
}

export function initialCleaningText(c: ProposalSnapshotContractConditions): string | null {
  const opt = c.initialCleaningOption as InitialCleaningOption | null | undefined;
  if (!opt) return null;
  const base =
    opt === "other" ? c.initialCleaningOther?.trim() || "Outra condição" : INITIAL_CLEANING_LABELS[opt];
  const bearer = c.initialCleaningCostBearer as CostBearer | null | undefined;
  if (opt === "owner_delivers" || opt === "tbd") return base;
  const parts = [base];
  if (c.initialCleaningFee != null) parts.push(formatBRL(c.initialCleaningFee));
  if (bearer) parts.push(`paga por ${COST_BEARER_LABELS[bearer]}`);
  return parts.join(" · ");
}

export function turnoverCleaningText(c: ProposalSnapshotContractConditions): string | null {
  const parts: string[] = [];
  if (c.turnoverCleaningTeam?.trim()) parts.push(c.turnoverCleaningTeam.trim());
  const fee = commercialCleaningFee(c);
  if (fee != null) {
    const payer = c.turnoverCleaningPayer as TurnoverPayer | null | undefined;
    parts.push(
      `Limpeza comercial ${formatBRL(fee)}${payer ? ` — ${TURNOVER_PAYER_LABELS[payer].toLowerCase()}` : ""}`,
    );
  }
  return parts.length ? parts.join(". ") : null;
}

export type OwnerUseLimitMode = "unlimited" | "limited" | "tbd";
export type AssignmentMode = "allowed" | "not_allowed" | "tbd";

export const OWNER_USE_LIMIT_LABELS: Record<OwnerUseLimitMode, string> = {
  unlimited: "Sem limite contratual de dias",
  limited: "Limite de dias definido",
  tbd: "A decidir",
};
export const ASSIGNMENT_LABELS: Record<AssignmentMode, string> = {
  allowed: "Permitida",
  not_allowed: "Não permitida",
  tbd: "A decidir",
};

export const DEFAULT_ASSIGNMENT_WHO =
  "Familiares ou pessoas indicadas pelo proprietário, sem cobrança de hospedagem.";
export const DEFAULT_ASSIGNMENT_PROCEDURE =
  "Solicitação à STAYO informando nome do usuário e datas; a STAYO confirma após verificar a disponibilidade.";

export const AVAILABILITY_RULE =
  "A solicitação depende da disponibilidade do imóvel. Datas com reserva confirmada não podem ser bloqueadas por um pedido posterior, e nenhuma data fica bloqueada antes de a STAYO verificar a disponibilidade e confirmar.";

/** Valor da limpeza comercial (padrão do imóvel). Snapshots antigos só têm turnoverCleaningFee. */
export function commercialCleaningFee(c: ProposalSnapshotContractConditions): number | null {
  return c.commercialCleaningFee ?? c.turnoverCleaningFee ?? null;
}

export interface ConditionItem {
  label: string;
  value: string;
  help?: string;
  tbd?: boolean;
}
export interface ConditionSection {
  key: "management" | "cleaning" | "owner_use" | "assignment";
  title: string;
  items: ConditionItem[];
  note?: string;
}

const days = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;

/** Quadro-resumo das condições, igual na ficha, na prévia e no link público. */
export function conditionSections(c: ProposalSnapshotContractConditions): ConditionSection[] {
  const fee = commercialCleaningFee(c);
  const feeItem = (label: string, help: string): ConditionItem =>
    fee != null
      ? { label, value: formatBRL(fee), help }
      : { label, value: "Valor a definir", help, tbd: true };

  const management: ConditionItem[] = [];
  const admin = formatPercent(c.administrationFee);
  if (admin) management.push({ label: "Taxa de administração", value: admin, help: "Sobre o valor das hospedagens." });
  const split = splitPayoutRule(c.payoutRule);
  if (split) {
    management.push({ label: "Repasse — Airbnb", value: split.airbnb });
    management.push({ label: "Repasse — Booking e diretas", value: split.others });
  } else if (c.payoutRule?.trim()) {
    management.push({ label: "Repasse", value: c.payoutRule.trim() });
  }
  if (c.exclusivity != null)
    management.push({
      label: "Exclusividade",
      value: c.exclusivity ? "Sim" : "Não",
      ...(c.exclusivity
        ? { help: "Durante o contrato, só a STAYO anuncia e administra o imóvel para aluguel por temporada." }
        : {}),
    });
  if (c.durationMonths) management.push({ label: "Vigência", value: `${c.durationMonths} meses` });
  if (c.noticePeriodDays) management.push({ label: "Aviso prévio para encerrar", value: days(c.noticePeriodDays) });
  if (c.maintenanceLimit != null)
    management.push({
      label: "Manutenção sem autorização prévia",
      value: `até ${formatBRL(c.maintenanceLimit)}`,
      help: "Limite para pequenos reparos; acima disso a STAYO pede sua autorização.",
    });

  const ownerUseSet = Boolean(c.ownerUseLimitMode || c.ownerUseNoticeDays != null || c.ownerUseNotes?.trim());
  const assignmentSet = Boolean(c.assignmentMode);

  const cleaning: ConditionItem[] = [];
  if (fee != null || c.turnoverCleaningTeam?.trim() || ownerUseSet || assignmentSet)
    cleaning.push(feeItem("Limpeza comercial", "Limpeza padrão do apartamento, usada após hospedagens, uso próprio e cessão."));
  if (c.turnoverCleaningTeam?.trim() || c.turnoverCleaningPayer) {
    const payer = c.turnoverCleaningPayer as TurnoverPayer | null | undefined;
    cleaning.push({
      label: "Limpeza entre hospedagens",
      value: c.turnoverCleaningTeam?.trim() || "A definir",
      ...(payer ? { help: `${TURNOVER_PAYER_LABELS[payer]}, no valor da limpeza comercial.` } : {}),
    });
  } else if (c.cleaningResponsibility?.trim()) {
    cleaning.push({ label: "Limpeza entre hospedagens", value: c.cleaningResponsibility.trim() });
  }
  const opt = c.initialCleaningOption as InitialCleaningOption | null | undefined;
  if (opt) {
    const bearer = c.initialCleaningCostBearer as CostBearer | null | undefined;
    const helps: string[] = [];
    if (opt !== "owner_delivers" && opt !== "tbd") {
      helps.push(c.initialCleaningFee != null ? `Valor: ${formatBRL(c.initialCleaningFee)}` : "Valor a definir");
      if (bearer) helps.push(`paga por ${COST_BEARER_LABELS[bearer]}`);
    }
    cleaning.push({
      label: "Limpeza de implantação",
      value: opt === "other" ? c.initialCleaningOther?.trim() || "Outra condição" : INITIAL_CLEANING_LABELS[opt],
      ...(helps.length ? { help: `${helps.join(" · ")}. Preparação inicial, separada da limpeza comercial.` } : {}),
      ...(opt === "tbd" ? { tbd: true } : {}),
    });
  }

  const ownerUse: ConditionItem[] = [];
  if (ownerUseSet) {
    const mode = c.ownerUseLimitMode as OwnerUseLimitMode | null | undefined;
    if (mode === "limited" && c.ownerUseLimitDays != null)
      ownerUse.push({
        label: "Limite de uso próprio",
        value: `Até ${days(c.ownerUseLimitDays)}${c.ownerUseLimitPeriod?.trim() ? ` ${c.ownerUseLimitPeriod.trim()}` : ""}`,
      });
    else if (mode === "unlimited") ownerUse.push({ label: "Limite de uso próprio", value: OWNER_USE_LIMIT_LABELS.unlimited });
    else ownerUse.push({ label: "Limite de uso próprio", value: "A decidir", tbd: true });
    ownerUse.push(
      c.ownerUseNoticeDays != null
        ? { label: "Antecedência para pedir", value: `${days(c.ownerUseNoticeDays)} antes` }
        : { label: "Antecedência para pedir", value: "A decidir", tbd: true },
    );
    ownerUse.push(feeItem("Limpeza após o uso", "Cobrada a cada uso, no valor da limpeza comercial do imóvel."));
    if (c.ownerUseNotes?.trim()) ownerUse.push({ label: "Condições específicas", value: c.ownerUseNotes.trim() });
  }

  const assignment: ConditionItem[] = [];
  if (assignmentSet) {
    const mode = c.assignmentMode as AssignmentMode;
    assignment.push({
      label: "Cessão de uso",
      value: ASSIGNMENT_LABELS[mode] ?? "A decidir",
      help: "Quando você autoriza um familiar ou outra pessoa a usar o imóvel. Não é hospedagem comercial nem uso próprio.",
      ...(mode === "tbd" ? { tbd: true } : {}),
    });
    if (mode === "allowed") {
      if (c.assignmentWho?.trim()) assignment.push({ label: "Para quem", value: c.assignmentWho.trim() });
      assignment.push(
        c.assignmentNoticeDays != null
          ? { label: "Antecedência para pedir", value: `${days(c.assignmentNoticeDays)} antes` }
          : { label: "Antecedência para pedir", value: "A decidir", tbd: true },
      );
      if (c.assignmentProcedure?.trim()) assignment.push({ label: "Como pedir", value: c.assignmentProcedure.trim() });
      assignment.push(feeItem("Limpeza após a cessão", "Cobrada a cada cessão, no valor da limpeza comercial do imóvel."));
    }
  }

  const out: ConditionSection[] = [];
  if (management.length) out.push({ key: "management", title: "Gestão e condições comerciais", items: management });
  if (cleaning.length) out.push({ key: "cleaning", title: "Limpeza e operação", items: cleaning });
  if (ownerUse.length || assignment.length) {
    const showRule = ownerUse.length > 0 || c.assignmentMode === "allowed";
    out.push({
      key: "owner_use",
      title: "Uso pelo proprietário e cessão a terceiros",
      items: [...ownerUse, ...assignment],
      ...(showRule ? { note: AVAILABILITY_RULE } : {}),
    });
  }
  return out;
}

/** Condições ainda "a decidir": não devem ser apresentadas como obrigação aceita. */
export function conditionPendingIssues(c: ProposalSnapshotContractConditions): string[] {
  return conditionSections(c).flatMap((s) =>
    s.items.filter((i) => i.tbd).map((i) => `${s.title} — ${i.label}: ${i.value.toLowerCase()}`),
  );
}

/** Linhas planas (PDF e usos antigos). */
export function contractConditionRows(
  c: ProposalSnapshotContractConditions,
): Array<[string, string]> {
  return conditionSections(c).flatMap((s) => s.items.map((i): [string, string] => [i.label, i.value]));
}

/** Converte a linha do banco no formato publicado (mesmo mapeamento do servidor). */
export function contractRowToSnapshot(v: Record<string, unknown> | null | undefined): ProposalSnapshotContractConditions {
  if (!v) return {};
  const n = (k: string) => (v[k] == null ? null : Number(v[k]));
  const t = (k: string) => (v[k] == null ? null : String(v[k]));
  return {
    administrationFee: n("administration_fee"),
    cleaningResponsibility: t("cleaning_responsibility"),
    payoutRule: t("payout_rule"),
    maintenanceLimit: n("maintenance_limit"),
    exclusivity: v.exclusivity == null ? null : Boolean(v.exclusivity),
    durationMonths: n("duration_months"),
    noticePeriodDays: n("notice_period_days"),
    initialCleaningOption: t("initial_cleaning_option"),
    initialCleaningOther: t("initial_cleaning_other"),
    initialCleaningCostBearer: t("initial_cleaning_cost_bearer"),
    turnoverCleaningTeam: t("turnover_cleaning_team"),
    turnoverCleaningFee: n("turnover_cleaning_fee"),
    turnoverCleaningPayer: t("turnover_cleaning_payer"),
    commercialCleaningFee: n("turnover_cleaning_fee"),
    initialCleaningFee: n("initial_cleaning_fee"),
    ownerUseLimitMode: t("owner_use_limit_mode"),
    ownerUseLimitDays: n("owner_use_limit_days"),
    ownerUseLimitPeriod: t("owner_use_limit_period"),
    ownerUseNoticeDays: n("owner_use_notice_days"),
    ownerUseNotes: t("owner_use_notes"),
    assignmentMode: t("assignment_mode"),
    assignmentWho: t("assignment_who"),
    assignmentProcedure: t("assignment_procedure"),
    assignmentNoticeDays: n("assignment_notice_days"),
  };
}
