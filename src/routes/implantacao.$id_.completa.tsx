import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { FichaImplantacao } from "../components/implantacao/ficha/FichaImplantacao";
import { AmenitiesPanel } from "../components/implantacao/AmenitiesPanel";
import { implementationQuery } from "../lib/api/queries";

export const Route = createFileRoute("/implantacao/$id_/completa")({
  head: () => ({
    meta: [
      { title: "Implantação completa — Stayo Admin" },
      { name: "description", content: "Conferência de utensílios, fornecedores, equipamentos e enxoval da implantação." },
      { property: "og:title", content: "Implantação completa — Stayo Admin" },
      { property: "og:description", content: "Conferência de utensílios, fornecedores, equipamentos e enxoval da implantação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FullImplementationPage,
});

function FullImplementationPage() {
  const { id } = Route.useParams();
  const q = useQuery(implementationQuery(id));
  const impl = q.data;
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6">
      <div className="flex items-center gap-3">
        <Link to="/implantacao/$id" params={{ id }} search={{ secao: "implantacao" }} className="grid size-10 place-items-center rounded-lg border bg-white" style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-navy)" }} aria-label="Voltar à ficha">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--stayo-ink-muted)" }}>{impl?.code ?? "Implantação"}</p>
          <p className="truncate text-lg font-semibold" style={{ color: "var(--stayo-navy)" }}>{impl?.propertyName ?? (q.isError ? "Não foi possível carregar a ficha" : "Carregando…")}</p>
        </div>
      </div>
      <FichaImplantacao
        implementationId={id}
        mode="full"
        wrapInventory={(inventory) => <AmenitiesPanel implementationId={id} bedrooms={impl?.bedrooms ?? null} render={inventory} />}
      />
    </div>
  );
}
