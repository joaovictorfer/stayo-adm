import type { EntityId } from "./core";

/**
 * Link público para o proprietário se auto-cadastrar durante a implantação.
 * Não existe endpoint no Core para isso ainda — vive em `local-store.ts`
 * até o Stayo Core ganhar esse domínio, igual templates e propostas.
 */
export interface OwnerOnboardingLink {
  implementationId: EntityId;
  token: string;
  createdAt: string;
}

export interface OwnerOnboardingSubmission {
  implementationId: EntityId;
  fullName: string;
  document: string | null;
  email: string;
  phone: string;
  pixKey: string | null;
  submittedAt: string;
}

export type OwnerOnboardingSubmissionInput = Omit<
  OwnerOnboardingSubmission,
  "implementationId" | "submittedAt"
>;
