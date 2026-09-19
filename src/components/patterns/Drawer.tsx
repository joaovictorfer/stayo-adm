import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

/**
 * Painel lateral deslizante — usado para detalhe/criação sem sair da lista
 * (ex: nova implantação, detalhe de uma rotina). Sempre pela direita,
 * largura fixa no desktop, tela cheia no mobile.
 */
export function Drawer({
  open,
  onClose,
  title,
  eyebrow,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Fechar painel" className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="absolute right-0 top-0 flex h-full w-full flex-col border-l border-border bg-card text-card-foreground shadow-[var(--shadow-float)] sm:w-[28rem]"
      >
        <div
          className="flex items-start justify-between gap-3 border-b border-border bg-card p-4"
        >
          <div>
            {eyebrow && (
              <p className="text-xs font-semibold uppercase text-premium">
                {eyebrow}
              </p>
            )}
            <h2
              className="mt-0.5 font-display text-lg font-semibold text-foreground"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-[var(--radius-control)] p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">{children}</div>

        {footer && (
          <div className="border-t border-border bg-card p-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
