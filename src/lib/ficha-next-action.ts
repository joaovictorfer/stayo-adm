import type { CommercialProposalStatus } from "../types/commercial-proposal";

export const FICHA_SECTIONS = [
  { id: "visao", label: "Resumo" },
  { id: "proposta", label: "Comercial" },
  { id: "proprietario", label: "Proprietários" },
  { id: "imovel", label: "Imóvel" },
  { id: "implantacao", label: "Implantação" },
  { id: "historico", label: "Histórico" },
] as const;
export type FichaSection = (typeof FICHA_SECTIONS)[number]["id"];

export function toFichaSection(value: unknown): FichaSection | undefined {
  if (value === "contrato") return "proposta"; // Contrato foi unificado em Comercial
  if (value === "portal") return "proprietario"; // Preserva links antigos após remoção da aba
  return FICHA_SECTIONS.some((s) => s.id === value) ? (value as FichaSection) : undefined;
}

export interface FichaState {
  hasOwnerName: boolean;
  hasOwnerPhone: boolean;
  missingPropertyFields: number;
  /** Status da versão mais recente da proposta; null quando não existe. */
  proposalStatus: CommercialProposalStatus | null;
  intakeSubmitted: boolean;
  pendingItems: number;
  pendingBlockers: number;
  /** Próxima ação comercial definida pela equipe (tem prioridade). */
  commercialAction?: string | null;
}

export interface NextAction {
  title: string;
  detail: string;
  section: FichaSection;
  cta: string;
}

/** Uma única próxima ação, na ordem do fluxo comercial → implantação. */
export function nextAction(s: FichaState): NextAction {
  if (s.commercialAction)
    return { title: s.commercialAction, detail: "Próxima ação comercial definida pela equipe.", section: "visao", cta: "Ver reuniões" };
  if (!s.hasOwnerName || !s.hasOwnerPhone)
    return {
      title: !s.hasOwnerName ? "Completar nome do proprietário" : "Completar telefone do proprietário",
      detail: "Sem contato não é possível enviar a proposta.",
      section: "proprietario",
      cta: "Resolver agora",
    };
  if (!s.proposalStatus)
    return { title: "Montar a proposta", detail: "Defina serviços, valores e condições.", section: "proposta", cta: "Resolver agora" };
  if (s.proposalStatus === "draft")
    return { title: "Publicar proposta", detail: "O rascunho ainda não foi enviado ao proprietário.", section: "proposta", cta: "Resolver agora" };
  if (s.proposalStatus === "published")
    return { title: "Aguardar aceite da proposta", detail: "Envie o link de acesso logo abaixo e acompanhe.", section: "proposta", cta: "Ver condições" };
  if (!s.intakeSubmitted)
    return { title: "Acompanhar cadastro do proprietário", detail: "Proposta aceita; o cadastro ainda não foi enviado.", section: "proprietario", cta: "Ver proprietário" };
  if (s.pendingBlockers > 0)
    return {
      title: `Resolver ${s.pendingBlockers} bloqueador${s.pendingBlockers > 1 ? "es" : ""}`,
      detail: "Itens que impedem a operação.",
      section: "implantacao",
      cta: "Resolver agora",
    };
  if (s.missingPropertyFields > 0)
    return {
      title: "Completar dados do imóvel",
      detail: `${s.missingPropertyFields} informação(ões) em aberto.`,
      section: "imovel",
      cta: "Resolver agora",
    };
  if (s.pendingItems > 0)
    return { title: `Concluir ${s.pendingItems} pendência(s)`, detail: "Checklist da implantação.", section: "implantacao", cta: "Resolver agora" };
  return { title: "Tudo em dia", detail: "Nenhuma ação pendente agora.", section: "visao", cta: "" };
}

export const proposalStatusLabel: Record<CommercialProposalStatus, string> = {
  draft: "Rascunho",
  published: "Publicada",
  accepted: "Aceita",
  superseded: "Substituída",
};
