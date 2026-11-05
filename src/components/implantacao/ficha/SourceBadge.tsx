import type { ReactNode } from "react";
import { Button } from "../../ui/button";
import type { SourceBadge as Kind } from "../../../lib/field-sources";

const STYLE: Record<Kind, { label: string; bg: string; fg: string }> = {
  oficial: { label: "Oficial", bg: "var(--stayo-forest-soft)", fg: "var(--stayo-forest)" },
  enviado: { label: "Enviado · aguardando revisão", bg: "var(--ficha-pending-bg)", fg: "var(--ficha-pending-fg)" },
  nota: { label: "Nota interna", bg: "var(--ficha-subtle)", fg: "var(--stayo-ink-muted)" },
};

export function SourceBadge({ kind }: { kind: Kind }) {
  const s = STYLE[kind];
  return <span className="inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: s.bg, color: s.fg }}>{s.label}</span>;
}

/** Mostra os dois valores lado a lado; nada muda até a equipe escolher. */
export function DivergenceBox({ label, officialLabel = "Oficial", submittedLabel = "Enviado", official, submitted, checking, checkLabel = "Conferir no local", onOfficial, onSubmitted, onCheck, busy }: {
  label: string; officialLabel?: string; submittedLabel?: string; official: ReactNode; submitted: ReactNode; checking: boolean; checkLabel?: string;
  onOfficial: () => void; onSubmitted: () => void; onCheck: () => void; busy?: boolean;
}) {
  return <div className="col-span-full rounded-lg border p-3" style={{ borderColor: "var(--ficha-pending-fg)", backgroundColor: "var(--ficha-pending-bg)" }} role="group" aria-label={`Divergência em ${label}`}>
    <p className="text-xs font-semibold" style={{ color: "var(--ficha-pending-fg)" }}>{checking ? `${label} · ${checkLabel.toLowerCase()} (marcado)` : `${label} · valores diferentes`}</p>
    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
      <div className="min-w-0 rounded-md bg-white p-2"><p className="text-[11px]" style={{ color: "var(--stayo-ink-muted)" }}>{officialLabel}</p><p className="break-words font-medium" style={{ color: "var(--stayo-navy)" }}>{official}</p></div>
      <div className="min-w-0 rounded-md bg-white p-2"><p className="text-[11px]" style={{ color: "var(--stayo-ink-muted)" }}>{submittedLabel}</p><p className="break-words font-medium" style={{ color: "var(--stayo-navy)" }}>{submitted}</p></div>
    </div>
    <div className="mt-2 flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" className="h-10 bg-white" disabled={busy} onClick={onOfficial}>Usar {officialLabel.toLowerCase()}</Button>
      <Button type="button" size="sm" variant="outline" className="h-10 bg-white" disabled={busy} onClick={onSubmitted}>Aceitar {submittedLabel.toLowerCase()}</Button>
      {!checking && <Button type="button" size="sm" variant="ghost" className="h-10" disabled={busy} onClick={onCheck}>{checkLabel}</Button>}
    </div>
  </div>;
}
