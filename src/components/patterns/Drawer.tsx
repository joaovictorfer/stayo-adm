import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

const surface = {
  backgroundColor: "var(--stayo-surface)",
  borderColor: "var(--stayo-border)",
};

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
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(20, 23, 19, 0.5)" }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="absolute right-0 top-0 flex h-full w-full flex-col border-l sm:w-[28rem]"
        style={surface}
      >
        <div
          className="flex items-start justify-between gap-3 border-b p-4"
          style={{ borderColor: "var(--stayo-border)", backgroundColor: "var(--stayo-forest)" }}
        >
          <div>
            {eyebrow && (
              <p className="text-xs uppercase tracking-wide" style={{ color: "var(--stayo-gold)" }}>
                {eyebrow}
              </p>
            )}
            <h2
              className="mt-0.5 text-lg"
              style={{ fontFamily: "var(--stayo-font-display)", color: "#fdfdfb" }}
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-[var(--radius-control)] p-1.5"
            style={{ color: "#fdfdfb" }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">{children}</div>

        {footer && (
          <div className="border-t p-4" style={{ borderColor: "var(--stayo-border)" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
