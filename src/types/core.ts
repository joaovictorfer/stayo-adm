/**
 * Contratos de dados do Stayo Core API (v1).
 *
 * Estes tipos representam o CONTRATO EXTERNO exposto pelo Core — não a
 * estrutura interna real das tabelas do STAYO.APP. O Admin nunca deve
 * assumir nomes de coluna ou tabela do banco interno; ele só conhece
 * estes formatos.
 *
 * Fonte conceitual: HANDOFF_MASTER seção 10 (Contrato de dados).
 * Os nomes de campo aqui são um ponto de partida e devem ser
 * reconciliados com a Fase 1 (mapa de domínios) antes de virarem
 * contrato definitivo — ver `docs/STAYO_ADMIN_ARCHITECTURE.md`.
 */

export type EntityId = string;

export type ImplementationStatus =
  | "prospect"
  | "proposta"
  | "aguardando_aprovacao"
  | "aprovado"
  | "planejamento"
  | "em_implantacao"
  | "validacao"
  | "pronto_para_operacao"
  | "ativo"
  | "pausado"
  | "nao_convertido"
  | "cancelado";

export type ImplementationItemStatus =
  | "pendente"
  | "em_andamento"
  | "concluido"
  | "bloqueado"
  | "nao_aplicavel"
  | "pulado";

export interface Property {
  id: EntityId;
  externalCode: string;
  name: string;
  condominiumId: EntityId | null;
  condominiumName: string | null;
  unit: string | null;
  city: string | null;
  status: string;
  capacity: number | null;
  checkinTime: string | null;
  checkoutTime: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Condominium {
  id: EntityId;
  name: string;
  city: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Reservation {
  id: EntityId;
  externalId: string | null;
  propertyId: EntityId;
  guestId: EntityId | null;
  source: string | null;
  channel: string | null;
  checkin: string;
  checkout: string;
  guestsCount: number | null;
  status: string;
  amount: number | null; // presente apenas quando o scope financial.read for concedido
  createdAt: string;
  updatedAt: string;
}

export interface Guest {
  id: EntityId;
  name: string;
  phone: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
  // Campos sensíveis (documento, selfie) NUNCA trafegam neste tipo.
  // Eles ficam atrás de um endpoint/scopo separado e mais restrito.
}

export interface Owner {
  id: EntityId;
  name: string;
  phone: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Entidade que só existe no Admin até virar Property/Owner oficiais no Core. */
export interface ImplementationProject {
  id: EntityId;
  code: string; // ex: IMP-00127
  status: ImplementationStatus;
  ownerProspect: {
    name: string;
    phone: string;
    email: string | null;
  };
  condominiumName: string | null;
  unit: string | null;
  city: string | null;
  responsibleUserId: EntityId | null;
  startDateEstimate: string | null;
  completionDateEstimate: string | null;
  notes: string | null;
  origin: string | null;
  createdAt: string;
  updatedAt: string;

  // Preenchidos somente após a conversão (ver seção 24/62 do handoff)
  corePropertyId: EntityId | null;
  coreOwnerId: EntityId | null;
}

export interface ImplementationItem {
  id: EntityId;
  implementationId: EntityId;
  category: string;
  phase: string;
  title: string;
  description: string | null;
  order: number;
  responsibleUserId: EntityId | null;
  dueDate: string | null;
  status: ImplementationItemStatus;
  observation: string | null;
  mandatory: boolean;
  blocker: boolean;
  ownerVisible: boolean;
  completedAt: string | null;
  completedBy: EntityId | null;
}

export interface ProposalItem {
  description: string;
  quantity: number;
  unitValue: number;
  discount: number;
  total: number;
}

export interface Proposal {
  id: EntityId;
  implementationId: EntityId;
  version: number;
  items: ProposalItem[];
  total: number;
  acceptedAt: string | null;
  createdAt: string;
}

export type InspectionType =
  | "implantacao"
  | "entrada"
  | "saida"
  | "periodica"
  | "manutencao"
  | "inventario";

export interface Inspection {
  id: EntityId;
  type: InspectionType;
  propertyId: EntityId;
  propertyName: string | null;
  /** Preenchido quando a vistoria nasce de uma implantação. */
  implementationId: EntityId | null;
  /** Preenchido quando a vistoria é de entrada/saída de uma reserva. */
  reservationId: EntityId | null;
  scheduledFor: string | null;
  responsibleUserId: EntityId | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Pendência operacional do dia a dia (limpeza, manutenção, check-in etc.). */
export interface OperationTask {
  id: EntityId;
  title: string;
  kind: string;
  propertyId: EntityId | null;
  propertyName: string | null;
  reservationId: EntityId | null;
  dueDate: string | null;
  responsibleUserId: EntityId | null;
  status: string;
  priority: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Conversa da Central de Mensagens do STAYO.APP.
 * Placeholder: este módulo passará a ler do Core no futuro.
 */
export interface Conversation {
  id: EntityId;
  channel: string | null;
  subject: string | null;
  participantName: string | null;
  propertyId: EntityId | null;
  reservationId: EntityId | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Contract {
  id: EntityId;
  code: string;
  ownerId: EntityId;
  ownerName: string | null;
  propertyId: EntityId | null;
  propertyName: string | null;
  type: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  signedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
