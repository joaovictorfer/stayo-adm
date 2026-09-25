import { forwardRef } from "react";
import { Input } from "../ui/input";
import { formatBRL } from "../../lib/money";

/**
 * Campo monetário brasileiro. A digitação entra pelos centavos
 * ("5" → R$ 0,05, "50000" → R$ 500,00) e o valor guardado é um número
 * com duas casas exatas — nunca texto nem float arredondado na tela.
 */
export const MoneyInput = forwardRef<
  HTMLInputElement,
  {
    value: number;
    onValueChange: (value: number) => void;
    "aria-label"?: string;
    id?: string;
    className?: string;
    disabled?: boolean;
  }
>(function MoneyInput({ value, onValueChange, className, ...rest }, ref) {
  return (
    <Input
      ref={ref}
      inputMode="numeric"
      autoComplete="off"
      value={formatBRL(value)}
      onChange={(event) => {
        const digits = event.target.value.replace(/\D/g, "").slice(0, 13);
        const cents = digits ? Number.parseInt(digits, 10) : 0;
        onValueChange(cents / 100);
      }}
      onFocus={(event) => {
        const el = event.target;
        requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
      }}
      className={`text-right tabular-nums ${className ?? ""}`}
      {...rest}
    />
  );
});
