import { type ReactNode, useState } from "react";

export interface WizardStep {
  id: string;
  label: string;
  content: ReactNode;
  /** Se retornar false, o botão "Continuar" fica desabilitado nesta etapa. */
  isValid?: boolean;
}

/**
 * Casca de formulário em etapas — um passo por tela, barra de progresso e
 * navegação Voltar/Continuar. O passo final chama `onComplete` em vez de
 * avançar. Pensado para caber dentro de um `Drawer`.
 */
export function Wizard({
  steps,
  onComplete,
  completeLabel = "Salvar",
  submitting = false,
}: {
  steps: WizardStep[];
  onComplete: () => void;
  completeLabel?: string;
  submitting?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const isLast = index === steps.length - 1;
  const isFirst = index === 0;

  if (!step) return null;

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <div
          className="flex items-center justify-between text-xs"
          style={{ color: "var(--stayo-ink-muted)" }}
        >
          <span>
            Etapa {index + 1} de {steps.length}
          </span>
          <span>{step.label}</span>
        </div>
        <div
          className="mt-2 flex gap-1"
          role="progressbar"
          aria-valuenow={index + 1}
          aria-valuemin={1}
          aria-valuemax={steps.length}
        >
          {steps.map((s, i) => (
            <span
              key={s.id}
              className="h-1 flex-1 rounded-full"
              style={{
                backgroundColor: i <= index ? "var(--stayo-forest)" : "var(--stayo-border)",
              }}
            />
          ))}
        </div>
      </div>

      <div className="flex-1">{step.content}</div>

      <div className="flex items-center gap-3">
        {!isFirst && (
          <button
            type="button"
            onClick={() => setIndex((i) => i - 1)}
            className="rounded-[var(--radius-control)] border px-3 py-2 text-sm"
            style={{ borderColor: "var(--stayo-border)", color: "var(--stayo-ink)" }}
          >
            Voltar
          </button>
        )}
        <button
          type="button"
          disabled={step.isValid === false || submitting}
          onClick={() => (isLast ? onComplete() : setIndex((i) => i + 1))}
          className="ml-auto rounded-[var(--radius-control)] px-4 py-2 text-sm disabled:opacity-60"
          style={{ backgroundColor: "var(--stayo-forest)", color: "#fdfdfb" }}
        >
          {isLast ? (submitting ? "Salvando..." : completeLabel) : "Continuar"}
        </button>
      </div>
    </div>
  );
}
