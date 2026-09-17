/**
 * Tipos do domínio PRÓPRIO do Admin (Grupo A) que nascem a partir da
 * Fase 2 do plano de evolução da Central Comercial — ver
 * docs/OWNER_IMPLEMENTATION_AUDIT.md §6. Entidades novas deste domínio
 * entram aqui, não em `core.ts` (que é o contrato do Stayo Core, Grupo B).
 */

import type { EntityId } from "./core";

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
