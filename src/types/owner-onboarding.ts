import type { EntityId } from "./core";
import type { OwnerPortalSnapshot } from "./owner-portal";

/**
 * Convite público para o proprietário se auto-cadastrar durante a
 * implantação — "owner_portal_invitations" do plano (seção 16). Guarda só
 * o hash do token, nunca o valor puro; expira e é revogável.
 *
 * Não existe endpoint no Core para isso ainda — vive em `local-store.ts`
 * até o Stayo Core (ou um projeto Supabase) ganhar esse domínio.
 */
export interface OwnerOnboardingLink {
  id: EntityId;
  implementationId: EntityId;
  /**
   * Preenchido quando o admin já sabe o proprietário no momento de gerar
   * o convite — é o que permite `owner_account_link` (Fase 17H) vincular
   * a conta do proprietário sem depender do adapter de
   * `implementation_projects` (ainda local, ver docs/DATA_PERSISTENCE.md).
   */
  ownerId: EntityId | null;
  tokenHash: string;
  createdAt: string;
  createdBy: string | null;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  lastAccessAt: string | null;
  publicSnapshot: OwnerPortalSnapshot | null;
}

export type OwnerOnboardingLinkStatus = "ativo" | "expirado" | "revogado" | "usado";

export function ownerOnboardingLinkStatus(
  link: Pick<OwnerOnboardingLink, "expiresAt" | "usedAt" | "revokedAt">,
  now: Date = new Date(),
): OwnerOnboardingLinkStatus {
  if (link.revokedAt) return "revogado";
  if (link.usedAt) return "usado";
  if (new Date(link.expiresAt) < now) return "expirado";
  return "ativo";
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
