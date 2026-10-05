import { ChevronRight, Globe } from "lucide-react";

import { Button } from "../../ui/button";

/** Proprietário mostra só o status do Portal; convites e liberações vivem na aba Portal. */
export function PortalStatusCard({ status, onOpen }: { status: string; onOpen: () => void }) {
  return (
    <section className="rounded-xl border bg-white p-4" style={{ borderColor: "var(--stayo-border)" }}>
      <h3 className="flex items-center gap-2 text-base font-semibold" style={{ color: "var(--stayo-navy)" }}>
        <Globe className="size-4" /> Portal do proprietário
      </h3>
      <p className="mt-1 text-sm" style={{ color: "var(--stayo-ink-muted)" }}>{status}</p>
      <Button variant="link" size="sm" className="px-0" onClick={onOpen}>Abrir aba Portal <ChevronRight /></Button>
    </section>
  );
}
