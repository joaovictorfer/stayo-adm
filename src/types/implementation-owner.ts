/**
 * Fase 2 — vários proprietários/proponentes por implantação e estado de
 * confirmação campo a campo.
 *
 * Regra: nunca campos fixos duplicados (`owner2_name`, `owner3_name`). O
 * vínculo é uma relação, com papel, participação e endereço próprios.
 */

import type { EntityId } from "./core";

export interface ImplementationOwnerLink {
  id: EntityId;
  implementationId: EntityId;
  ownerId: EntityId;
  /** Papel livre: proprietário, proponente, procurador, cônjuge... */
  role: string;
  sharePercent: number | null;
  address: string | null;
  displayOrder: number;
  createdAt: string;
}

export interface ImplementationOwnerLinkInput {
  implementationId: EntityId;
  ownerId: EntityId;
  role: string;
  sharePercent: number | null;
  address: string | null;
  displayOrder?: number;
}

/**
 * Estado de cada informação, do que a Stayo preencheu até o que o
 * proprietário confirmou ou alterou. Nada é sobrescrito em silêncio:
 * `changed_by_owner` espera revisão do time interno.
 */
export type OwnerFieldState =
  | "not_informed"
  | "prefilled_by_stayo"
  | "confirmed_by_owner"
  | "changed_by_owner"
  | "reviewed_by_stayo";

export const ownerFieldStateLabels: Record<OwnerFieldState, string> = {
  not_informed: "Não informado",
  prefilled_by_stayo: "Preenchido pela Stayo",
  confirmed_by_owner: "Confirmado pelo proprietário",
  changed_by_owner: "Alterado pelo proprietário",
  reviewed_by_stayo: "Revisado pela Stayo",
};

export interface FieldConfirmation {
  id: EntityId;
  implementationId: EntityId;
  fieldKey: string;
  state: OwnerFieldState;
  /** Nunca guarda dado sensível (senha de Wi-Fi/fechadura, documento, selfie). */
  valueSnapshot: string | null;
  note: string | null;
  updatedAt: string;
}
