import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Converte texto digitado (aceita "1.234,56", "1234,56", "1234.56") em centavos; null se inválido. */
export function parseMoneyText(v: string): number | null {
  let t = v.replace(/\s|R\$/g, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

/** Formata centavos no padrão contábil brasileiro, sem símbolo: 1.234,56 */
export function formatMoneyText(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return "";
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Props = Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: string;
  onValueChange: (text: string) => void;
};

/** Campo de valor em reais: prefixo R$, alinhado à direita, formata 1.234,56 ao sair do campo. */
export const MoneyInput = React.forwardRef<HTMLInputElement, Props>(({ value, onValueChange, className, onBlur, ...rest }, ref) => (
  <div className="relative">
    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
    <Input
      ref={ref}
      inputMode="decimal"
      placeholder="0,00"
      autoComplete="off"
      {...rest}
      value={value}
      onChange={(e) => onValueChange(e.target.value.replace(/[^\d.,]/g, ""))}
      onBlur={(e) => { const c = parseMoneyText(value); if (c !== null) onValueChange(formatMoneyText(c)); onBlur?.(e); }}
      className={cn("pl-9 text-right tabular-nums", className)}
    />
  </div>
));
MoneyInput.displayName = "MoneyInput";

/** Variante controlada por centavos (para campos numéricos já existentes). */
export function MoneyCentsInput({ cents, onCentsChange, ...rest }: Omit<Props, "value" | "onValueChange"> & { cents: number; onCentsChange: (c: number) => void }) {
  const [text, setText] = React.useState(formatMoneyText(cents));
  React.useEffect(() => { if (parseMoneyText(text) !== cents) setText(formatMoneyText(cents)); }, [cents]); // eslint-disable-line react-hooks/exhaustive-deps
  return <MoneyInput {...rest} value={text} onValueChange={(t) => { setText(t); onCentsChange(parseMoneyText(t) ?? 0); }} />;
}
