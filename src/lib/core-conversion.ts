/**
 * Preparação para a conversão de uma Implantação em Property/Owner oficiais
 * do Stayo Core (Fase 11 — seção 24/62 do handoff).
 *
 * O Core ainda não expõe nenhum endpoint de ESCRITA (`coreApi` é Grupo B,
 * só-leitura por contrato — ver docs/OWNER_IMPLEMENTATION_AUDIT.md). Este
 * serviço define o contrato que a conversão real vai usar assim que esse
 * endpoint existir, mas nunca fabrica `corePropertyId`/`coreOwnerId`: fica
 * atrás da flag `VITE_ENABLE_CORE_CONVERSION` (default desligada) e, mesmo
 * com a flag ligada, `createOwner`/`createProperty`/`linkImplementation`
 * lançam um erro claro em vez de inventar um endpoint que não existe.
 *
 * `convertImplementation` é idempotente: se a implantação já tem
 * `corePropertyId`/`coreOwnerId`, retorna o resultado existente sem
 * disparar nenhuma chamada nova.
 */

import { adminApi, coreApi } from "./api/queries";
import type { EntityId, ImplementationProject, Owner, Property } from "../types/core";

export function isCoreConversionEnabled(): boolean {
  return import.meta.env["VITE_ENABLE_CORE_CONVERSION"] === "true";
}

export class CoreConversionNotAvailableError extends Error {}

export interface CoreConversionResult {
  corePropertyId: EntityId;
  coreOwnerId: EntityId;
}

export interface CoreConversionService {
  /** Busca por proprietário já existente no Core — sempre roda antes de criar, nunca duplica. */
  searchOwner(implementation: ImplementationProject): Promise<Owner[]>;
  /** Busca por imóvel já existente no Core — sempre roda antes de criar, nunca duplica. */
  searchProperty(implementation: ImplementationProject): Promise<Property[]>;
  createOwner(implementation: ImplementationProject): Promise<Owner>;
  createProperty(implementation: ImplementationProject): Promise<Property>;
  linkImplementation(
    implementationId: EntityId,
    result: CoreConversionResult,
  ): Promise<ImplementationProject>;
  /** Orquestra search-first → create → link. Idempotente por implementação. */
  convertImplementation(implementation: ImplementationProject): Promise<CoreConversionResult>;
}

const NOT_AVAILABLE_MESSAGE =
  "Conversão para o Core ainda não está disponível: não existe endpoint de escrita real do Core (properties/owners) — ver docs/OWNER_IMPLEMENTATION_AUDIT.md.";

export const coreConversionService: CoreConversionService = {
  async searchOwner(implementation) {
    const q = implementation.ownerPhone ?? implementation.ownerName ?? "";
    if (!q) return [];
    return coreApi.owners.search(q);
  },

  async searchProperty(implementation) {
    const q =
      implementation.address ?? implementation.nickname ?? implementation.condominiumName ?? "";
    if (!q) return [];
    const page = await coreApi.properties.list({ q });
    return page.data;
  },

  async createOwner() {
    throw new CoreConversionNotAvailableError(NOT_AVAILABLE_MESSAGE);
  },

  async createProperty() {
    throw new CoreConversionNotAvailableError(NOT_AVAILABLE_MESSAGE);
  },

  async linkImplementation() {
    throw new CoreConversionNotAvailableError(NOT_AVAILABLE_MESSAGE);
  },

  async convertImplementation(implementation) {
    if (implementation.corePropertyId && implementation.coreOwnerId) {
      return {
        corePropertyId: implementation.corePropertyId,
        coreOwnerId: implementation.coreOwnerId,
      };
    }

    await adminApi.audit.log({
      actorId: null,
      event: "core_conversion.requested",
      entityType: "implementation",
      entityId: implementation.id,
      metadata: { enabled: isCoreConversionEnabled() },
    });

    if (!isCoreConversionEnabled()) {
      throw new CoreConversionNotAvailableError(NOT_AVAILABLE_MESSAGE);
    }

    // Mesmo com a flag ligada: sem endpoint de escrita real, não há como
    // buscar-ou-criar sem risco de fabricar um ID que o Core não reconhece.
    throw new CoreConversionNotAvailableError(NOT_AVAILABLE_MESSAGE);
  },
};
