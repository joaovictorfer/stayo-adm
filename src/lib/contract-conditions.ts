import { formatBRL } from "./money";
import type { ProposalSnapshotContractConditions } from "../types/commercial-proposal";

export type InitialCleaningOption =
  | "owner_delivers"
  | "stayo_initial"
  | "stayo_post_construction"
  | "other";
export type CostBearer = "owner" | "stayo";
export type TurnoverPayer = "guest" | "owner";

export const INITIAL_CLEANING_LABELS: Record<InitialCleaningOption, string> = {
  owner_delivers: "Imóvel será entregue limpo pelo proprietário",
  stayo_initial: "STAYO fará a limpeza inicial",
  stayo_post_construction: "STAYO fará a limpeza pós-obra",
  other: "Outra condição",
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
  "Reservas pelo Airbnb: repasse automático pela plataforma. Reservas pelo Booking e reservas diretas: repasse até o dia 10 do mês subsequente, conforme os valores efetivamente recebidos e conciliados.";

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
  if (!match) return null;
  return { airbnb: match[1].trim(), others: match[2].trim() };
}

export function initialCleaningText(c: ProposalSnapshotContractConditions): string | null {
  const opt = c.initialCleaningOption as InitialCleaningOption | null | undefined;
  if (!opt) return null;
  const base =
    opt === "other" ? c.initialCleaningOther?.trim() || "Outra condição" : INITIAL_CLEANING_LABELS[opt];
  const bearer = c.initialCleaningCostBearer as CostBearer | null | undefined;
  if (opt === "owner_delivers" || !bearer) return base;
  return `${base}. Custo: ${COST_BEARER_LABELS[bearer]}`;
}

export function turnoverCleaningText(c: ProposalSnapshotContractConditions): string | null {
  const parts: string[] = [];
  if (c.turnoverCleaningTeam?.trim()) parts.push(c.turnoverCleaningTeam.trim());
  if (c.turnoverCleaningFee != null) {
    const payer = c.turnoverCleaningPayer as TurnoverPayer | null | undefined;
    parts.push(
      `Taxa ${formatBRL(c.turnoverCleaningFee)}${payer ? ` — ${TURNOVER_PAYER_LABELS[payer].toLowerCase()}` : ""}`,
    );
  }
  return parts.length ? parts.join(". ") : null;
}

/** Linhas legíveis das condições, usadas nas prévias e no link público. */
export function contractConditionRows(
  c: ProposalSnapshotContractConditions,
): Array<[string, string]> {
  const rows: Array<[string, string | null]> = [
    ["Taxa de administração", formatPercent(c.administrationFee)],
    [
      "Manutenção sem autorização prévia",
      c.maintenanceLimit != null ? `até ${formatBRL(c.maintenanceLimit)}` : null,
    ],
    ["Limpeza inicial do imóvel", initialCleaningText(c)],
  ];
  const turnover = turnoverCleaningText(c);
  // Snapshots antigos só têm o texto livre de limpeza.
  rows.push(["Limpeza entre hospedagens", turnover ?? (c.cleaningResponsibility?.trim() || null)]);
  const split = splitPayoutRule(c.payoutRule);
  if (split) {
    rows.push(["Repasse — Airbnb", split.airbnb], ["Repasse — Booking / reservas diretas", split.others]);
  } else {
    rows.push(["Repasse", c.payoutRule?.trim() || null]);
  }
  if (c.exclusivity != null) {
    rows.push(["Exclusividade da gestão de locações por temporada", c.exclusivity ? "Sim" : "Não"]);
  }
  rows.push(
    ["Vigência", c.durationMonths ? `${c.durationMonths} meses` : null],
    ["Aviso prévio", c.noticePeriodDays ? `${c.noticePeriodDays} dias` : null],
  );
  return rows.filter((r): r is [string, string] => Boolean(r[1]));
}
