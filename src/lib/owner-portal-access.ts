export interface CreatedPortalAccess {
  linkId: string;
  token: string;
}

/**
 * Um token só pode ser usado enquanto corresponde ao acesso ativo que o
 * gerou. Tokens antigos deixam de ser recuperáveis assim que o link muda.
 */
export function availablePortalToken(
  activeLinkId: string | null,
  createdAccess: CreatedPortalAccess | null,
): string | null {
  if (!activeLinkId || createdAccess?.linkId !== activeLinkId) return null;
  return createdAccess.token;
}