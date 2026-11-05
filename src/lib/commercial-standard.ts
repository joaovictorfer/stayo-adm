import { formatBRL } from "./money";
import { INITIAL_CLEANING_LABELS, type InitialCleaningOption, type TurnoverPayer } from "./contract-conditions";

/** Padrão comercial STAYO copiado para cada ficha (nunca lido ao vivo por outros imóveis). */
export const STAYO_STANDARD = {
  administration_fee: 20,
  duration_months: 6, // 180 dias
  turnover_cleaning_fee: 250,
  turnover_cleaning_payer: "guest" as TurnoverPayer,
  initial_cleaning_option: "stayo_initial" as InitialCleaningOption,
} as const;

export type StandardKey = keyof typeof STAYO_STANDARD;
export const STANDARD_KEYS = Object.keys(STAYO_STANDARD) as StandardKey[];
type Row = Record<string, unknown> | null | undefined;

export const STANDARD_LABELS: Record<StandardKey, string> = {
  administration_fee: "Taxa de administração",
  duration_months: "Vigência",
  turnover_cleaning_fee: "Limpeza das hospedagens",
  turnover_cleaning_payer: "Quem paga a limpeza",
  initial_cleaning_option: "Preparação inicial",
};

export function formatStandardValue(key: StandardKey, v: unknown): string {
  if (v == null || v === "") return "A definir";
  switch (key) {
    case "administration_fee": return `${String(v).replace(".", ",")}%`;
    case "duration_months": return `${Number(v) * 30} dias`;
    case "turnover_cleaning_fee": return formatBRL(Number(v));
    case "turnover_cleaning_payer": return v === "guest" ? "Hóspede" : "Proprietário";
    case "initial_cleaning_option": return INITIAL_CLEANING_LABELS[v as InitialCleaningOption] ?? String(v);
  }
}

const same = (a: unknown, b: unknown) =>
  a == null || b == null ? a == b : typeof a === "number" || typeof b === "number" ? Number(a) === Number(b) : a === b;

/** Patch para iniciar a ficha: preenche só campos vazios e guarda a cópia do padrão na própria ficha. */
export function initialStandardPatch(row: Row): Record<string, unknown> | null {
  if (row?.["standard_copy"]) return null;
  const patch: Record<string, unknown> = { standard_copy: { ...STAYO_STANDARD } };
  for (const k of STANDARD_KEYS) {
    const v = row?.[k];
    if (v == null || v === "" || v === "tbd") patch[k] = STAYO_STANDARD[k];
  }
  return patch;
}

/** Campos que divergem da cópia do padrão guardada na ficha. */
export function standardExceptions(row: Row): StandardKey[] {
  const copy = (row?.["standard_copy"] ?? null) as Record<string, unknown> | null;
  if (!copy) return [];
  return STANDARD_KEYS.filter((k) => k in copy && !same(row?.[k], copy[k]));
}

export function resetToStandardPatch(row: Row, key: StandardKey): Record<string, unknown> {
  const copy = (row?.["standard_copy"] ?? STAYO_STANDARD) as Record<string, unknown>;
  return { [key]: copy[key] ?? STAYO_STANDARD[key] };
}

export function conditionsComplete(row: Row): boolean {
  return STANDARD_KEYS.every((k) => { const v = row?.[k]; return v != null && v !== "" && v !== "tbd"; });
}

/** Mesmas chaves de valor usadas no servidor (commercial_value_fingerprint). */
export const VALUE_KEYS = [
  "administrationFee", "durationMonths", "turnoverCleaningFee", "turnoverCleaningPayer", "initialCleaningOption",
  "initialCleaningFee", "initialCleaningCostBearer", "maintenanceLimit", "noticePeriodDays", "exclusivity",
  "ownerUseLimitMode", "ownerUseLimitDays", "ownerUseNoticeDays", "assignmentMode", "assignmentNoticeDays",
  "linenMode", "advisoryMode",
] as const;

export interface VersionSnap {
  total?: number | null;
  items?: Array<{ description: string; total: number }>;
  contractConditions?: Record<string, unknown>;
  [k: string]: unknown;
}

function valueFingerprint(s: VersionSnap) {
  return JSON.stringify({
    total: Number(s.total ?? 0),
    items: (s.items ?? []).map((i) => [i.description, Number(i.total)]),
    cc: VALUE_KEYS.map((k) => s.contractConditions?.[k] ?? null),
  });
}
function fullFingerprint(s: VersionSnap) {
  const { publishedAt: _p, version: _v, proposalId: _i, ...rest } = s;
  return JSON.stringify(rest);
}

export type ChangeKind = "none" | "text" | "values";
export function classifyChange(prev: VersionSnap, next: VersionSnap): ChangeKind {
  if (fullFingerprint(prev) === fullFingerprint(next)) return "none";
  return valueFingerprint(prev) === valueFingerprint(next) ? "text" : "values";
}

export interface ProposalVersionLite {
  id: string;
  version: number;
  status: "draft" | "published" | "accepted" | "superseded";
  snapshot?: VersionSnap | null;
}

/** O link do proprietário mostra sempre a última versão publicada/aceita, nunca rascunho. */
export function versionShownOnLink(versions: ProposalVersionLite[]): ProposalVersionLite | null {
  return [...versions]
    .filter((v) => (v.status === "published" || v.status === "accepted") && v.snapshot)
    .sort((a, b) => b.version - a.version)[0] ?? null;
}

/** Depois de salvar: precisa de nova confirmação do proprietário? */
export function requiresReconfirmation(versions: ProposalVersionLite[], next: VersionSnap): boolean {
  const accepted = [...versions].filter((v) => v.status === "accepted" && v.snapshot).sort((a, b) => b.version - a.version)[0];
  if (!accepted) return true; // ainda sem aceite: a última versão aguarda confirmação
  return classifyChange(accepted.snapshot!, next) === "values";
}

export const STALE_ACCEPT_MESSAGE = "condições atualizadas";
/** Aceite enviado de versão antiga é recusado. */
export function checkAccept(versions: ProposalVersionLite[], proposalId: string): { ok: true } | { ok: false; message: string } {
  const current = versionShownOnLink(versions);
  if (!current || current.id !== proposalId) return { ok: false, message: STALE_ACCEPT_MESSAGE };
  return { ok: true };
}
