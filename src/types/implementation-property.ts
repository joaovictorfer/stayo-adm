/**
 * Fase 3 — cadastro estruturado do imóvel dentro da implantação.
 *
 * Wi-Fi, fechadura e chaves são dados protegidos: existem aqui para a
 * operação, mas nunca vão para audit log, PDF público ou portal aberto.
 */

import type { EntityId } from "./core";

export interface ImplementationPropertyDetails {
  implementationId: EntityId;
  postalCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  suites: number | null;
  bathrooms: number | null;
  parkingSpots: number | null;
  accessNotes: string | null;
  wifiNetwork: string | null;
  wifiPassword: string | null;
  notes: string | null;
  updatedAt: string;
}

export type ImplementationPropertyDetailsInput = Partial<
  Omit<ImplementationPropertyDetails, "implementationId" | "updatedAt">
>;

export interface ImplementationRoom {
  id: EntityId;
  implementationId: EntityId;
  name: string;
  /** quarto, banheiro, sala, cozinha, área externa... — livre, nada fixo no código. */
  kind: string;
  beds: string | null;
  capacity: number | null;
  displayOrder: number;
  notes: string | null;
  createdAt: string;
}

export interface ImplementationRoomInput {
  implementationId: EntityId;
  name: string;
  kind: string;
  beds: string | null;
  capacity: number | null;
  displayOrder?: number;
  notes?: string | null;
}
