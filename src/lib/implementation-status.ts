import { nextSequentialCode } from "./sequential-code";
import type { ImplementationItemStatus, ImplementationStatus } from "../types/core";

/** Ciclo principal do funil de implantação, na ordem em que acontece. */
export const mainStatusFlow: ImplementationStatus[] = [
  "prospect",
  "proposta",
  "aguardando_aprovacao",
  "aprovado",
  "planejamento",
  "em_implantacao",
  "validacao",
  "pronto_para_operacao",
  "ativo",
];

/** Estados alternativos — saem da linha principal, não são etapas dela. */
export const alternateStatuses: ImplementationStatus[] = ["pausado", "nao_convertido", "cancelado"];

export const statusLabels: Record<ImplementationStatus, string> = {
  prospect: "Prospect",
  proposta: "Proposta",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovado: "Aprovado",
  planejamento: "Planejamento",
  em_implantacao: "Em implantação",
  validacao: "Validação",
  pronto_para_operacao: "Pronto para operação",
  ativo: "Ativo",
  pausado: "Pausado",
  nao_convertido: "Não convertido",
  cancelado: "Cancelado",
};

export const itemStatusLabels: Record<ImplementationItemStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  bloqueado: "Bloqueado",
  nao_aplicavel: "Não aplicável",
  pulado: "Pulado",
};

export const itemStatusColor: Record<ImplementationItemStatus, string> = {
  pendente: "var(--stayo-ink-muted)",
  em_andamento: "var(--stayo-warning)",
  concluido: "var(--stayo-success)",
  bloqueado: "var(--stayo-danger)",
  nao_aplicavel: "var(--stayo-ink-muted)",
  pulado: "var(--stayo-ink-muted)",
};

/** Itens que não contam para progresso (foram descartados do escopo). */
const countsForProgress = (status: ImplementationItemStatus) =>
  status !== "nao_aplicavel" && status !== "pulado";

export function computeProgress(items: { status: ImplementationItemStatus }[]): {
  done: number;
  total: number;
  percent: number;
} {
  const relevant = items.filter((i) => countsForProgress(i.status));
  const done = relevant.filter((i) => i.status === "concluido").length;
  const total = relevant.length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/**
 * "Pulado" NUNCA significa resolvido automaticamente — só um override
 * formal e registrado (`readinessOverrideAt`) tira um item pulado da
 * prontidão. "Não aplicável" sai do cálculo sempre (foi descartado do
 * escopo, não pulado por conveniência).
 */
function isResolvedForReadiness(item: {
  status: ImplementationItemStatus;
  readinessOverrideAt?: string | null;
}): boolean {
  if (item.status === "concluido" || item.status === "nao_aplicavel") return true;
  if (item.status === "pulado") return Boolean(item.readinessOverrideAt);
  return false;
}

/**
 * Prontidão operacional NÃO é progresso: basta um item bloqueador ou
 * obrigatório em aberto para a implantação não estar apta, mesmo com 95%
 * do checklist concluído.
 */
export type ReadinessState = "nao_avaliada" | "com_pendencias" | "bloqueada" | "apta";

export const readinessLabels: Record<ReadinessState, string> = {
  nao_avaliada: "Não avaliada",
  com_pendencias: "Com pendências",
  bloqueada: "Bloqueada",
  apta: "Apta",
};

export const readinessColors: Record<ReadinessState, string> = {
  nao_avaliada: "var(--stayo-ink-muted)",
  com_pendencias: "var(--stayo-warning)",
  bloqueada: "var(--stayo-danger)",
  apta: "var(--stayo-success)",
};

export function computeReadiness(
  items: {
    status: ImplementationItemStatus;
    mandatory: boolean;
    blocker: boolean;
    readinessOverrideAt?: string | null;
  }[],
): { ready: boolean; state: ReadinessState; pendingBlockers: number; pendingMandatory: number } {
  if (items.length === 0) {
    return { ready: false, state: "nao_avaliada", pendingBlockers: 0, pendingMandatory: 0 };
  }

  const open = items.filter((i) => !isResolvedForReadiness(i));
  const pendingBlockers = open.filter((i) => i.blocker).length;
  const pendingMandatory = open.filter((i) => i.mandatory).length;
  
  const ready = pendingBlockers === 0 && pendingMandatory === 0;

  let state: ReadinessState;
  if (pendingBlockers > 0) {
    state = "bloqueada";
  } else if (pendingMandatory > 0) {
    state = "com_pendencias";
  } else {
    state = "apta";
  }

  return { ready, state, pendingBlockers, pendingMandatory };
}

export function nextImplementationCode(existingCodes: string[]): string {
  return nextSequentialCode("IMP", existingCodes);
}
