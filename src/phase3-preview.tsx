import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "./styles.css";
import { PropertySuppliersPanel } from "@/components/suppliers/PropertySuppliersPanel";

const root = document.getElementById("root");
if (!root) throw new Error("Preview root not found");

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

createRoot(root).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <main className="min-h-screen bg-muted/30 px-3 py-4 sm:px-6">
        <section className="mx-auto max-w-3xl rounded-2xl border border-border bg-background p-4 sm:p-6">
          <div className="mb-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Implantação</p>
            <h1 className="text-xl font-semibold text-foreground">Fornecedores</h1>
          </div>
          <PropertySuppliersPanel implementationId="phase3-visual" />
        </section>
      </main>
    </QueryClientProvider>
  </React.StrictMode>,
);
