import { createFileRoute } from "@tanstack/react-router";
import { FieldRegistrationForm } from "@/components/field/FieldRegistrationForm";
export const Route = createFileRoute("/portal/cadastro-vistoria/$token")({
  head: () => ({
    meta: [
      { title: "Cadastro e vistoria do imóvel · STAYO Gramado" },
      {
        name: "description",
        content: "Cadastro do proprietário, ambientes e inventário de implantação STAYO.",
      },
      { property: "og:title", content: "Cadastro e vistoria do imóvel · STAYO Gramado" },
      { property: "og:description", content: "Cadastro e conferência do imóvel por ambiente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Page,
});
function Page() {
  const { token } = Route.useParams();
  return <FieldRegistrationForm token={token} />;
}
