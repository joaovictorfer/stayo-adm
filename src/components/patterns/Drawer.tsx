import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { Button } from "../ui/button";

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
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
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
        aria-label={typeof title === "string" ? title : eyebrow ?? "Painel"}
        className="absolute right-0 top-0 flex h-dvh w-full min-w-0 flex-col border-l sm:w-[28rem]"
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
          <Button
            ref={closeButtonRef}
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Fechar"
            className="min-h-11 min-w-11 shrink-0 text-[var(--primary-foreground)] hover:bg-[color-mix(in_srgb,var(--stayo-surface)_14%,transparent)] hover:text-[var(--primary-foreground)]"
          >
            <X size={18} />
          </Button>
        </div>

        <div className="min-w-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>

        {footer && (
          <div className="border-t p-4" style={{ borderColor: "var(--stayo-border)" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
