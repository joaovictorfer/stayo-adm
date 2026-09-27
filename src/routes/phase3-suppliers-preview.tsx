import { createFileRoute } from "@tanstack/react-router";

import { PropertySuppliersPanel } from "@/components/suppliers/PropertySuppliersPanel";

// Rota efêmera de QA: será removida antes do diff final e não entra no routeTree versionado.
// @ts-expect-error caminho temporário fora do FileRoutesByPath gerado
export const Route = createFileRoute("/phase3-suppliers-preview")({
  ssr: false,
  component: Phase3SuppliersPreview,
});

function Phase3SuppliersPreview() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl bg-[var(--stayo-page)] px-4 py-6 sm:px-6">
      <div className="rounded-2xl border border-border bg-background p-4 sm:p-6">
        <PropertySuppliersPanel implementationId="11111111-1111-4111-8111-111111111111" />
      </div>
    </main>
  );
}
