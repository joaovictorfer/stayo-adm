import type { EntityId } from "./core";

/**
 * Link público para o proprietário visualizar (e aceitar) uma VERSÃO
 * específica da proposta comercial — nunca a implantação em geral.
 *
 * Isso é intencional (ver docs/OWNER_IMPLEMENTATION_AUDIT.md §4.1): um
 * link enviado para a v1 tem que continuar mostrando a v1 para sempre,
 * mesmo que uma v2 seja criada depois. Cada versão tem seu próprio link.
 *
 * Mesmo raciocínio do link de onboarding: não existe endpoint no Core pra
 * isso ainda, vive em `local-store.ts`.
 */
export interface ProposalShareLink {
  proposalId: EntityId;
  /** Denormalizado só para exibição/filtro — a fonte da verdade é `proposalId`. */
  implementationId: EntityId;
  token: string;
  createdAt: string;
}
