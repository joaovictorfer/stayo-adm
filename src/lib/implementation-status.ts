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
 * Prontidão operacional NÃO é progresso: basta um item bloqueador ou
 * obrigatório em aberto para a implantação não estar apta, mesmo com 95%
 * do checklist concluído.
 */
export function computeReadiness(
  items: { status: ImplementationItemStatus; mandatory: boolean; blocker: boolean }[],
): { ready: boolean; pendingBlockers: number; pendingMandatory: number } {
  const open = items.filter((i) => countsForProgress(i.status) && i.status !== "concluido");
  const pendingBlockers = open.filter((i) => i.blocker).length;
  const pendingMandatory = open.filter((i) => i.mandatory).length;
  return {
    ready: pendingBlockers === 0 && pendingMandatory === 0,
    pendingBlockers,
    pendingMandatory,
  };
}

export function nextImplementationCode(existingCodes: string[]): string {
  const numbers = existingCodes
    .map((c) => Number.parseInt(c.replace(/\D/g, ""), 10))
    .filter((n) => Number.isFinite(n));
  const next = (numbers.length > 0 ? Math.max(...numbers) : 0) + 1;
  return `IMP-${String(next).padStart(5, "0")}`;
}
