import { createFileRoute } from "@tanstack/react-router";
import { SurveyExperience } from "@/components/field/SurveyExperience";
export const Route = createFileRoute("/vistoria-implantacao/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Vistoria de implantação · STAYO Gramado" },
      {
        name: "description",
        content: "Preenchimento passo a passo do inventário do imóvel durante a vistoria.",
      },
      { property: "og:title", content: "Vistoria de implantação · STAYO Gramado" },
      {
        property: "og:description",
        content: "Inventário por ambiente com fotos, marca e estado de uso.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SurveyPage,
});

function SurveyPage() {
  const { token } = Route.useParams();
  return <SurveyExperience token={token} />;
}
