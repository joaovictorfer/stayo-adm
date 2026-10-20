/**
 * Papéis e permissões do Portal do Proprietário (Fase 1 — multi-imóvel).
 *
 * O papel vive em `owner_portal_accounts.role` (banco) e chega ao portal
 * pela sessão do proprietário. A matriz abaixo é a ÚNICA fonte de verdade
 * do que cada papel pode ver/fazer na interface — a RLS continua sendo a
 * barreira real no banco; aqui controlamos apenas o que é exibido.
 */

export type OwnerPortalRole = "titular" | "coproprietario" | "representante_legal";

export const ownerRoleLabels: Record<OwnerPortalRole, string> = {
  titular: "Proprietário titular",
  coproprietario: "Coproprietário",
  representante_legal: "Representante legal",
};

export interface OwnerPortalPermissions {
  /** Aba Financeiro (repasses, demonstrativos). */
  canViewFinance: boolean;
  /** Dados bancários / conta para repasse. */
  canViewBankingData: boolean;
  /** Editar dados do imóvel (endereço, Wi-Fi, acesso). */
  canEditPropertyData: boolean;
  /** Ver CPF/CNPJ completo; quando falso, exibe mascarado (LGPD). */
  showFullDocument: boolean;
  /** Mostrar selo de cota de participação (coproprietário). */
  showShareBadge: boolean;
}

const titularPermissions: OwnerPortalPermissions = {
  canViewFinance: true,
  canViewBankingData: true,
  canEditPropertyData: true,
  showFullDocument: true,
  showShareBadge: false,
};

export function ownerPortalPermissions(role: OwnerPortalRole): OwnerPortalPermissions {
  switch (role) {
    case "coproprietario":
      return { ...titularPermissions, showShareBadge: true };
    case "representante_legal":
      return {
        canViewFinance: false,
        canViewBankingData: false,
        canEditPropertyData: false,
        showFullDocument: false,
        showShareBadge: false,
      };
    case "titular":
    default:
      return titularPermissions;
  }
}

/**
 * Mascara CPF/CNPJ mantendo só os 3 primeiros e 2 últimos dígitos.
 * Ex.: "526.199.153-68" → "526.•••.•••-68".
 */
export function maskOwnerDocument(document: string | null | undefined): string | null {
  if (!document) return null;
  const digits = document.replace(/\D/g, "");
  if (digits.length < 5) return "•••";
  return `${digits.slice(0, 3)}${"•".repeat(Math.max(digits.length - 5, 3))}${digits.slice(-2)}`;
}
