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
  "pendente" | "em_andamento" | "concluido" | "bloqueado" | "nao_aplicavel" | "pulado";

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
  /** Preenchido quando o proprietário já foi vinculado ao imóvel oficial. */
  ownerId: EntityId | null;
  ownerName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Condominium {
  id: EntityId;
  name: string;
  city: string | null;
  /** Imagem institucional do empreendimento, quando exposta pelo Core. */
  coverImage: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Status do web check-in feito pelo hóspede antes da chegada — não é
 * controle de acesso, só indica se falta ação do hóspede antes do check-in.
 */
export type ReservationWebCheckinStatus = "pendente" | "concluido" | "nao_aplicavel";

export interface Reservation {
  id: EntityId;
  externalId: string | null;
  propertyId: EntityId;
  propertyName: string | null;
  guestId: EntityId | null;
  guestName: string | null;
  source: string | null;
  channel: string | null;
  checkin: string;
  checkout: string;
  adultsCount: number | null;
  childrenCount: number | null;
  petsCount: number | null;
  /** Horário previsto de chegada informado pelo hóspede, ex: "15:00". */
  expectedArrivalTime: string | null;
  webCheckin: ReservationWebCheckinStatus;
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
  /** FK para `OwnerRecord` (src/types/admin.ts) — nunca objeto embutido. */
  ownerId: EntityId | null;
  ownerName: string | null;
  ownerPhone: string | null;
  /** URL externa ou caminho privado da capa escolhida para a implantação. */
  coverImage: string | null;
  /** Apelido interno do pré-imóvel, ex: "Cobertura vista mar". */
  nickname: string | null;
  condominiumName: string | null;
  unit: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  capacity: number | null;
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

  /**
   * Override formal de prontidão (seção 12 do plano): sem isto, um item
   * "pulado" com `blocker`/`mandatory` continua contando como pendência de
   * prontidão — "pulado" nunca significa "resolvido" automaticamente.
   */
  readinessOverrideReason: string | null;
  readinessOverrideBy: string | null;
  readinessOverrideAt: string | null;
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
  /** Nome digitado pelo proprietário ao marcar "li e concordo" — não é assinatura jurídica. */
  acceptedName: string | null;
  createdAt: string;
}

export type InspectionType =
  "implantacao" | "entrada" | "saida" | "periodica" | "manutencao" | "inventario";

export interface Inspection {
  id: EntityId;
  type: InspectionType;
  propertyId: EntityId;
  propertyName: string | null;
  /** Preenchido quando a vistoria nasce de uma implantação. */
  implementationId: EntityId | null;
  /** Preenchido quando a vistoria é de entrada/saída de uma reserva. */
  reservationId: EntityId | null;
  reservationCode: string | null;
  scheduledFor: string | null;
  responsibleUserId: EntityId | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Prestador de serviço (limpeza, manutenção etc.) — pessoa ou empresa
 * externa à equipe interna, que recebe por rotinas executadas. Mesmo
 * cadastro usado tanto para atribuir rotinas quanto para os fechamentos
 * financeiros pagos a ele.
 */
export interface ServiceProvider {
  id: EntityId;
  name: string;
  /** CPF ou CNPJ, sem formatação garantida. */
  document: string | null;
  pixKey: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Um prestador atribuído a uma rotina operacional, com o percentual e o
 * valor que cabe a ele no custo total da rotina (handoff: cada rotina pode
 * ser dividida entre mais de um prestador, sempre com um líder marcado).
 */
export interface OperationTaskAssignment {
  providerId: EntityId;
  providerName: string | null;
  /** Percentual do valor total que cabe a este prestador (0-100). */
  share: number;
  amount: number | null;
  lead: boolean;
}

/** Pendência operacional do dia a dia (limpeza, manutenção, check-in etc.). */
export interface OperationTask {
  id: EntityId;
  title: string;
  kind: string;
  propertyId: EntityId | null;
  propertyName: string | null;
  reservationId: EntityId | null;
  reservationCode: string | null;
  dueDate: string | null;
  /** Horário previsto de execução no dia, ex: "11:00". */
  scheduledTime: string | null;
  responsibleUserId: EntityId | null;
  status: string;
  priority: string | null;
  /** Valor total da rotina, dividido entre `assignments`. Nulo = sem custo. */
  totalAmount: number | null;
  assignments: OperationTaskAssignment[];
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
  propertyName: string | null;
  reservationId: EntityId | null;
  reservationCode: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export type ConversationMessageSender = "hospede" | "equipe" | "sistema";

/** Mensagem individual de uma conversa — o formato aqui é provisório até o STAYO.APP expor a Central de Mensagens de verdade. */
export interface ConversationMessage {
  id: EntityId;
  conversationId: EntityId;
  sender: ConversationMessageSender;
  body: string;
  sentAt: string;
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

/** Conteúdo editorial do Guia do hóspede (administração, não o guia público). */
export interface GuideEntry {
  id: EntityId;
  title: string;
  category: string | null;
  propertyId: EntityId | null;
  propertyName: string | null;
  /** Escopo: conteúdo global da operação ou específico de um imóvel. */
  scope: string;
  status: string;
  language: string | null;
  order: number | null;
  summary: string | null;
  updatedAt: string;
  createdAt: string;
}

/** Produto ou serviço de upsell oferecido ao hóspede. */
export interface UpsellProduct {
  id: EntityId;
  name: string;
  category: string | null;
  description: string | null;
  price: number | null;
  currency: string | null;
  unit: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/** As três etapas de uma fatura de serviço, na ordem em que acontecem. */
export type ServiceInvoiceStage = "emissao" | "envio" | "recebimento";

export interface ServiceInvoiceItem {
  description: string;
  quantity: number;
  unitValue: number;
  total: number;
}

/**
 * Fatura de cobrança de serviços realizados num imóvel (ex: limpeza),
 * emitida para o proprietário. Distinta do repasse (`Payout`, que é o
 * valor que sai da operação para o proprietário) — aqui é o contrário,
 * o proprietário paga a operação por um serviço prestado.
 */
export interface ServiceInvoice {
  id: EntityId;
  code: string; // ex: FSR-00039
  title: string; // ex: "Limpeza H203"
  propertyId: EntityId | null;
  propertyName: string | null;
  ownerId: EntityId | null;
  ownerName: string | null;
  /** Mês de competência do serviço, ex: "2026-09". */
  referenceMonth: string | null;
  issuedAt: string | null;
  dueDate: string | null;
  items: ServiceInvoiceItem[];
  total: number;
  stage: ServiceInvoiceStage;
  sentAt: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SettlementStatus = "aberto" | "pago";

export interface SettlementItem {
  date: string;
  propertyId: EntityId | null;
  propertyName: string | null;
  description: string;
  amount: number;
}

/**
 * Fechamento — agrupa as rotinas operacionais já concluídas por um
 * prestador num período, para pagamento único. Gera um recibo (`code`,
 * ex: BAL-20260830-001) que soma os itens. Distinto da fatura de serviço
 * (`ServiceInvoice`, cobrada do proprietário): aqui é a operação pagando
 * o prestador pelo trabalho executado.
 */
export interface Settlement {
  id: EntityId;
  code: string;
  providerId: EntityId;
  providerName: string | null;
  periodStart: string;
  periodEnd: string;
  items: SettlementItem[];
  total: number;
  status: SettlementStatus;
  paymentMethod: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Repasse ao proprietário.
 *
 * Princípio do menor privilégio: este módulo enxerga imóvel, reserva,
 * canal, valor e proprietário. Nenhum dado de hóspede — e nunca
 * documento ou selfie — existe neste tipo, de propósito.
 */
export interface Payout {
  id: EntityId;
  propertyId: EntityId | null;
  propertyName: string | null;
  reservationId: EntityId | null;
  reservationCode: string | null;
  channel: string | null;
  /** Requer scope financial.read. */
  amount: number | null;
  currency: string | null;
  ownerId: EntityId | null;
  ownerName: string | null;
}

export type ExpenseStatus = "aberto" | "pago";

/** Despesa operacional (manutenção, compra, serviço) lançada contra um imóvel. */
export interface Expense {
  id: EntityId;
  propertyId: EntityId | null;
  propertyName: string | null;
  category: string;
  description: string;
  amount: number;
  dueDate: string | null;
  paidAt: string | null;
  status: ExpenseStatus;
  createdAt: string;
  updatedAt: string;
}
