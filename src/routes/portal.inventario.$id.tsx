import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, RotateCcw } from "lucide-react";
import { useEffect } from "react";

import { Button } from "../components/ui/button";
import { OwnerInventoryVisual } from "@/components/portal/OwnerInventoryVisual";
import { useOwnerSession } from "../lib/auth/owner-session";
import { ownerInventoryQuery } from "../lib/api/owner-inventory";

export const Route = createFileRoute("/portal/inventario/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Inventário do imóvel — Portal do Proprietário Stayo" },
      { name: "description", content: "Informe o que já existe em cada ambiente do seu imóvel." },
      { property: "og:title", content: "Inventário do imóvel — Portal do Proprietário Stayo" },
      { property: "og:description", content: "Informe o que já existe em cada ambiente do seu imóvel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OwnerInventoryPage,
});

const muted = { color: "var(--stayo-ink-muted)" };
const border = { borderColor: "var(--stayo-border)" };

function OwnerInventoryPage() {
  const { id } = Route.useParams();
  const auth = useOwnerSession();
  const navigate = useNavigate();
  useEffect(() => {
    if (auth.status === "unauthenticated" || auth.status === "not_required") void navigate({ to: "/portal/login" });
  }, [auth.status, navigate]);

  return (
    <div className="min-h-screen w-full" style={{ background: "#faf8f4" }}>
      {auth.status === "authenticated" ? (
        <Inventory implementationId={id} />
      ) : auth.status === "unlinked" || auth.status === "error" ? (
        <p className="rounded-lg border p-4 text-sm" style={border} role="alert">{auth.message ?? "Sem acesso."}</p>
      ) : (
        <p className="flex items-center gap-2 text-sm" style={muted}><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</p>
      )}
    </div>
  );
}

function Inventory({ implementationId }: { implementationId: string }) {
  const q = useQuery(ownerInventoryQuery(implementationId));
  const navigate = useNavigate();
  if (q.isPending) return <p className="flex items-center gap-2 p-4 text-sm" style={muted} role="status"><Loader2 className="h-4 w-4 animate-spin" /> Carregando inventário…</p>;
  if (q.isError) {
    const denied = /acesso|42501|permiss/i.test(String((q.error as Error)?.message));
    return (
      <div className="m-4 space-y-2 rounded-lg border p-4 text-sm" style={border} role="alert">
        <p className="font-medium">{denied ? "Você não tem acesso a este imóvel" : "Não foi possível abrir o inventário"}</p>
        {!denied && <Button size="sm" variant="outline" onClick={() => void q.refetch()}><RotateCcw className="mr-1 h-4 w-4" /> Tentar de novo</Button>}
      </div>
    );
  }
  return <OwnerInventoryVisual implementationId={implementationId} data={q.data} onBack={() => void navigate({ to: "/portal/inicio" })} />;
}
