import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();
  // Keep short-lived administrative reads warm; existing mutation
  // invalidation and focus/reconnect refreshes remain active.
  for (const scope of ["implementations", "commercial", "owners", "admin", "properties"]) {
    queryClient.setQueryDefaults([scope], { staleTime: 30_000 });
  }

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
