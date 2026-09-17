import type { EntityId } from "./core";

/**
 * Nota interna sobre um proprietário — domínio exclusivo do Admin (nunca
 * existirá no Core), então fica no repositório local (`local-store.ts`).
 */
export interface OwnerNote {
  ownerId: EntityId;
  content: string;
  updatedAt: string;
}
