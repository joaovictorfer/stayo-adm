import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/configuracoes/migracao")({
  beforeLoad: () => { throw redirect({ to: "/painel-migracao" }); },
  head: () => ({ meta: [
    { title: "Complementos de migração — STAYO Admin" },
    { name: "description", content: "Acesso ao painel seguro de complementos do EXPORT." },
    { property: "og:title", content: "Complementos de migração — STAYO Admin" },
    { property: "og:description", content: "Acesso ao painel seguro de complementos do EXPORT." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});
