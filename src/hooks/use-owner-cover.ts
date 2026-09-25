import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getOwnerCover, type OwnerCover } from "../lib/owner-cover.functions";
import { getSupabaseBrowserClient } from "../lib/api/supabase-client";

/** Capa autorizada para quem abre um link do proprietário (token). */
export function useOwnerCoverByToken(token: string | undefined) {
  const fn = useServerFn(getOwnerCover);
  return useQuery<OwnerCover>({
    queryKey: ["owner-cover", "token", token],
    enabled: Boolean(token && token.length >= 16),
    staleTime: 30 * 60 * 1000,
    retry: false,
    queryFn: () => fn({ data: { token: token! } }).catch(() => null),
  });
}

/** Capa autorizada para o proprietário logado (ou equipe na prévia). */
export function useOwnerCoverForImplementation(implementationId: string | undefined) {
  const fn = useServerFn(getOwnerCover);
  return useQuery<OwnerCover>({
    queryKey: ["owner-cover", "implementation", implementationId],
    enabled: Boolean(implementationId),
    staleTime: 30 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const client = getSupabaseBrowserClient();
      const { data } = (await client?.auth.getSession()) ?? { data: { session: null } };
      const accessToken = data.session?.access_token;
      if (!accessToken) return null;
      return fn({ data: { implementationId: implementationId!, accessToken } }).catch(() => null);
    },
  });
}
