import { useQuery } from "@tanstack/react-query";
import { useAdminCoverUrl } from "../CoverPicker";
import { getPropertyDetails } from "../../../lib/api/owner-portal-data";

export type PropertyPendencyKey = "cover" | "wifi" | "access";

/** Fonte única das pendências do Imóvel (aba Imóvel e Resumo). Somente leitura. */
export function usePropertyPendencies(implementationId: string | undefined) {
  const adminCover = useAdminCoverUrl(implementationId);
  const detailsQ = useQuery({
    queryKey: ["implementation-property-details", implementationId],
    queryFn: () => getPropertyDetails(implementationId!),
    enabled: Boolean(implementationId),
  });
  const d = detailsQ.data;
  const keys: PropertyPendencyKey[] = [];
  if (!adminCover) keys.push("cover");
  if (d !== undefined && (!d?.wifiNetwork || !d?.wifiPassword)) keys.push("wifi");
  if (d !== undefined && !d?.accessType) keys.push("access");
  return { keys, details: d, detailsQ, adminCover };
}
