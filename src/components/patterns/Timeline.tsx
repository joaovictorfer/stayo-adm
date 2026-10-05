import { formatDateTime } from "@/lib/format-datetime";

export interface TimelineEntry {
  id: string;
  label: string;
  timestamp: string;
  actor?: string | null;
}

/**
 * Linha do tempo vertical simples — usada pra histórico de eventos reais
 * (ex: itens de checklist concluídos). Não inventa dado: quem chama decide
 * o que vira entrada, a partir de campos que já existem no contrato.
 */
export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--stayo-ink-muted)" }}>
        Nenhuma atividade registrada ainda.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-4">
      {entries.map((entry, i) => (
        <li key={entry.id} className="relative flex gap-3 pl-1">
          <div className="flex flex-col items-center">
            <span
              className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: "var(--stayo-forest)" }}
            />
            {i < entries.length - 1 && (
              <span
                className="mt-1 w-px flex-1"
                style={{ backgroundColor: "var(--stayo-border)" }}
              />
            )}
          </div>
          <div className="-mt-0.5 pb-1">
            <p className="text-sm" style={{ color: "var(--stayo-ink)" }}>
              {entry.label}
            </p>
            <p className="mt-0.5 text-xs" style={{ color: "var(--stayo-ink-muted)" }}>
              {formatDateTime(entry.timestamp)}
              {entry.actor ? ` · ${entry.actor}` : ""}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
