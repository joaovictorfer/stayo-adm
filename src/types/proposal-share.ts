import type { EntityId } from "./core";

/**
 * Link público para o proprietário visualizar (e aceitar) a proposta
 * comercial da implantação. Mesmo raciocínio do link de onboarding: não
 * existe endpoint no Core pra isso ainda, vive em `local-store.ts`.
 */
export interface ProposalShareLink {
  implementationId: EntityId;
  token: string;
  createdAt: string;
}
