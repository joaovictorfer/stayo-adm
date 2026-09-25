import { FileText, Sparkles } from "lucide-react";

import { ProposalPresentationView } from "../implantacao/ProposalPresentationView";
import type {
  DocumentsContent,
  OverviewContent,
  ProposalContent,
} from "../../lib/api/portal-visibility";

/** Renderizadores únicos: a prévia do Admin e o portal usam exatamente estes. */
export function ReleasedOverview({ content }: { content: OverviewContent }) {
  return (
    <section className="portal-card">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--stayo-forest-soft)] text-[var(--stayo-forest)]">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{content.title}</h2>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-[var(--stayo-ink-muted)]">
            {content.message}
          </p>
          {content.nextStep && (
            <p className="mt-3 text-sm">
              <strong>Próximo passo:</strong> {content.nextStep}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export function ReleasedProposal({ content }: { content: ProposalContent }) {
  return <ProposalPresentationView snapshot={content.snapshot} />;
}

export function ReleasedDocumentsList({
  content,
  onOpen,
}: {
  content: DocumentsContent;
  onOpen?: (attachmentId: string) => void;
}) {
  return (
    <ul className="divide-y divide-[var(--stayo-border)] rounded-2xl border border-[var(--stayo-border)] bg-[var(--stayo-surface)]">
      {content.documents.map((d) => (
        <li key={d.attachmentId} className="flex items-center gap-3 px-4 py-3">
          <FileText className="size-4 shrink-0 text-[var(--stayo-ink-muted)]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{d.filename}</p>
            <p className="text-xs text-[var(--stayo-ink-muted)]">
              {new Intl.DateTimeFormat("pt-BR").format(new Date(d.createdAt))}
            </p>
          </div>
          {onOpen && (
            <button
              type="button"
              onClick={() => onOpen(d.attachmentId)}
              className="rounded-full border border-[var(--stayo-border)] px-3 py-1 text-xs font-medium"
            >
              Abrir
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
