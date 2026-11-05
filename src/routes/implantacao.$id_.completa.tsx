import { createFileRoute, redirect } from "@tanstack/react-router";

// A implantação completa agora vive dentro da aba Implantação da ficha; links antigos continuam funcionando.
export const Route = createFileRoute("/implantacao/$id_/completa")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/implantacao/$id", params: { id: params.id }, search: { secao: "implantacao" } as never, replace: true });
  },
});
