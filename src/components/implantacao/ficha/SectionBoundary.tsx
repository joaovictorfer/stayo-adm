import { Component, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";

/** Contém falhas de um bloco da ficha para que o resto da tela continue funcionando. */
export class SectionBoundary extends Component<{ children: ReactNode; label?: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error(error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="flex items-start gap-3 rounded-xl border border-[var(--stayo-border)] bg-[var(--stayo-surface)] p-4 text-sm text-[var(--stayo-navy)]">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-[var(--stayo-warning)]" />
        <div>
          <p className="font-semibold">Não foi possível mostrar {this.props.label ?? "esta parte"}.</p>
          <p className="text-[var(--stayo-ink-muted)]">O restante da ficha continua disponível.</p>
          <button type="button" className="mt-2 font-medium underline" onClick={() => this.setState({ failed: false })}>Tentar de novo</button>
        </div>
      </div>
    );
  }
}
