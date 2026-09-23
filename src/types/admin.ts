/**
 * Tipos do domínio PRÓPRIO do Admin (Grupo A) que nascem a partir da
 * Fase 2 do plano de evolução da Central Comercial — ver
 * docs/OWNER_IMPLEMENTATION_AUDIT.md §6. Entidades novas deste domínio
 * entram aqui, não em `core.ts` (que é o contrato do Stayo Core, Grupo B).
 */

import type { EntityId } from "./core";

/**
 * Papéis do time interno (`admin_role` no banco — migration
 * 0001_admin_foundation.sql). Autorização real é sempre via RLS
 * (`has_admin_role(...)`) — este tipo só espelha o enum para o
 * frontend, nunca é a fonte da verdade de permissão.
 */
export type AdminRole =
  "super_admin" | "admin" | "commercial" | "operations" | "finance" | "viewer";

export interface AdminProfile {
  id: EntityId;
  fullName: string;
  role: AdminRole;
  active: boolean;
}

export type OwnerLifecycleStatus = "prospect" | "ativo" | "inativo";

/**
 * Proprietário como relacionamento comercial — existe ANTES de haver
 * imóvel oficial no Stayo Core. `coreOwnerId` só é preenchido após a
 * conversão (ver Fase 11); até lá é `null` e não há duplicidade com o
 * `Owner` de `core.ts` (esse é só leitura, do domínio Core).
 */
export interface OwnerRecord {
  id: EntityId;
  name: string;
  phone: string | null;
  email: string | null;
  document: string | null;
  lifecycleStatus: OwnerLifecycleStatus;
  coreOwnerId: EntityId | null;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerRecordInput {
  name: string;
  phone: string | null;
  email: string | null;
  document?: string | null;
}

/**
 * Cadastro mestre de condomínio. O `id` é a chave futura de integração
 * com o Guia Stayo — informações ricas (regras, áreas comuns etc.)
 * pertencem ao Guia, não aqui.
 */
export interface AdminCondominium {
  id: EntityId;
  name: string;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  hasConcierge: boolean;
  conciergePhone: string | null;
  status: "pending" | "complete";
  coverImage: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AdminCondominiumInput = Pick<AdminCondominium, "name" | "address" | "city"> & {
  neighborhood?: string | null;
  state?: string | null;
  postalCode?: string | null;
  hasConcierge?: boolean;
  conciergePhone?: string | null;
  coverImage?: string | null;
};

/** Regra única de completude do cadastro (espelhada no trigger do banco). */
export function computeCondominiumStatus(
  c: Pick<AdminCondominium, "name" | "address" | "city" | "hasConcierge" | "conciergePhone">,
): "pending" | "complete" {
  const filled = (v: string | null | undefined) => !!v && v.trim() !== "";
  return filled(c.name) &&
    filled(c.address) &&
    filled(c.city) &&
    (!c.hasConcierge || filled(c.conciergePhone))
    ? "complete"
    : "pending";
}

/**
 * Tipo de cobrança de uma condição comercial — nunca hardcodar um valor
 * (taxa, preço) no código; isso vive em `commercial_term_defaults`,
 * configurável em Configurações → Comercial.
 */
export type ChargeType =
  "percentage" | "fixed_once" | "per_reservation" | "monthly" | "optional" | "informational";

/** Default configurável — copiado (snapshot) para cada implantação nova. */
export interface CommercialTermDefault {
  id: EntityId;
  label: string;
  chargeType: ChargeType;
  /** Percentual (ex: 20 = 20%) ou valor em reais, conforme `chargeType`. */
  value: number;
  optional: boolean;
  displayOrder: number;
  notes: string | null;
}

export type CommercialTermDefaultInput = Omit<CommercialTermDefault, "id">;

/** Condição comercial de uma implantação específica — snapshot editável. */
export interface CommercialTerm {
  id: EntityId;
  implementationId: EntityId;
  label: string;
  chargeType: ChargeType;
  value: number;
  optional: boolean;
  displayOrder: number;
  notes: string | null;
}

export type OutboundMessageStatus = "draft" | "queued" | "sent" | "failed" | "cancelled";

/**
 * Mensagem para o proprietário via WhatsApp — sempre passa por um outbox
 * auditável, nunca é disparada direto de uma tela. Enquanto não houver
 * provider real configurado, o envio é sempre manual (o time abre o
 * WhatsApp com o texto pronto) — ver `src/lib/whatsapp/gateway.ts`.
 */
export interface OutboundMessage {
  id: EntityId;
  implementationId: EntityId;
  ownerId: EntityId | null;
  destination: string;
  template: string;
  body: string;
  status: OutboundMessageStatus;
  providerMessageId: string | null;
  error: string | null;
  createdAt: string;
  sentAt: string | null;
  failedAt: string | null;
}

export type OutboundMessageInput = Omit<
  OutboundMessage,
  "id" | "status" | "providerMessageId" | "error" | "createdAt" | "sentAt" | "failedAt"
>;

export type OwnerTaskStatus = "pending" | "done" | "dismissed";

/**
 * Pendência do proprietário ("Precisamos de você", seção 17I do plano) —
 * dado bancário faltando, Wi-Fi faltando, documento de regularização
 * faltando etc. Visível tanto para o admin (que cria/gerencia) quanto
 * para o próprio proprietário (só leitura — marcar como resolvida é
 * sempre o time interno confirmando, nunca um `update` do proprietário
 * sob a própria sessão).
 */
export interface OwnerTask {
  id: EntityId;
  ownerId: EntityId;
  implementationId: EntityId | null;
  kind: string;
  title: string;
  description: string | null;
  status: OwnerTaskStatus;
  createdAt: string;
  completedAt: string | null;
}

export type OwnerTaskInput = Pick<
  OwnerTask,
  "ownerId" | "implementationId" | "kind" | "title" | "description"
>;

export type InitialChargeStatus = "draft" | "issued" | "pending" | "paid" | "cancelled" | "overdue";

export interface InitialChargeItem {
  label: string;
  amount: number;
}

/**
 * Cobrança inicial (seção 25 do plano) — nasce dos itens `fixed_once` das
 * condições comerciais no momento em que a proposta é aceita. Não é nota
 * fiscal (seção 26): representa só o valor devido, uma vez.
 */
export interface InitialCharge {
  id: EntityId;
  code: string; // ex: COB-00001
  implementationId: EntityId;
  ownerId: EntityId | null;
  proposalId: EntityId;
  items: InitialChargeItem[];
  amount: number;
  status: InitialChargeStatus;
  dueAt: string | null;
  paymentReference: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
}
