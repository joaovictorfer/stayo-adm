import { type ReactNode, useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface WizardStep {
  id: string;
  label: string;
  content: ReactNode;
  /** Se retornar false, o botão "Continuar" fica desabilitado nesta etapa. */
  isValid?: boolean;
  invalidMessage?: string;
  hasInlineErrors?: boolean;
}

/**
 * Casca de formulário em etapas — um passo por tela, barra de progresso e
 * navegação Voltar/Continuar. O passo final chama `onComplete` em vez de
 * avançar. Pensado para caber dentro de um `Drawer`.
 */
export function Wizard({
  steps,
  onComplete,
  onStepChange,
  initialStep = 0,
  completeLabel = "Salvar",
  submitting = false,
  hideProgress = false,
}: {
  steps: WizardStep[];
  onComplete: () => void;
  onStepChange?: (step: number) => void;
  initialStep?: number;
  completeLabel?: string;
  submitting?: boolean;
  hideProgress?: boolean;
}) {
  const [index, setIndex] = useState(initialStep);
  const [visited, setVisited] = useState<number[]>([]);
  const step = steps[index];
  const isLast = index === steps.length - 1;
  const isFirst = index === 0;

  useEffect(() => {
    setIndex(Math.max(0, Math.min(initialStep, steps.length - 1)));
  }, [initialStep, steps.length]);

  const moveTo = (next: number) => {
    setIndex(next);
    onStepChange?.(next);
  };

  if (!step) return null;

  return (
    <div className="flex h-full flex-col gap-4">
      {!hideProgress && (
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
      )}

      <div className="flex-1">{step.content}</div>

      {step.isValid === false && step.invalidMessage && !step.hasInlineErrors && (
        <p className="text-xs text-[var(--portal-danger)]" role="status">
          {step.invalidMessage}
        </p>
      )}
      <div className="portal-form-actions flex items-center gap-3">
        {!isFirst && (
          <Button
            type="button"
            onClick={() => moveTo(index - 1)}
            variant="outline"
            className="portal-action rounded-xl border-[var(--portal-border)] text-[var(--portal-navy)]"
          >
            Voltar
          </Button>
        )}
        <Button
          type="button"
          disabled={step.isValid === false || submitting}
          onClick={() => {
            if (isLast) onComplete();
            else {
              setVisited((current) => (current.includes(index) ? current : [...current, index]));
              moveTo(index + 1);
            }
          }}
          className="portal-action ml-auto rounded-xl bg-[var(--portal-navy)] text-[var(--portal-hero-foreground)] hover:bg-[var(--portal-navy-strong)]"
        >
          {isLast ? (
            submitting ? (
              "Enviando com segurança..."
            ) : (
              completeLabel
            )
          ) : (
            <>
              Continuar para {steps[index + 1]?.label}
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </div>
      {visited.includes(index) && (
        <p className="text-right text-[11px] text-[var(--portal-success)]">
          Tudo certo nesta etapa
        </p>
      )}
    </div>
  );
}
