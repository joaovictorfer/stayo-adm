import { forwardRef, useEffect, useRef, useState } from "react";
import { Input } from "../ui/input";

/**
 * Campo monetário brasileiro com digitação natural, da esquerda para a direita:
 * "250" → R$ 250,00; "250,5" → R$ 250,50. Centavos só com vírgula (ou ponto final
 * com até 2 casas). Formata ao sair do campo; guarda número com duas casas.
 */
export function parseBRLInput(text: string): number {
  let t = text.replace(/[^\d,.]/g, "");
  if (!t) return 0;
  if (t.includes(",")) {
    t = t.replace(/\./g, "");
    const [int, ...rest] = t.split(",");
    t = `${int}.${rest.join("").slice(0, 2)}`;
  } else {
    const parts = t.split(".");
    const last = parts[parts.length - 1];
    if (parts.length > 1 && last.length <= 2) {
      t = `${parts.slice(0, -1).join("")}.${last}`;
    } else {
      t = parts.join("");
    }
  }
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  const [text, setText] = useState(() => fmt(value || 0));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(fmt(value || 0));
  }, [value]);
  return (
    <div className={`relative ${className ?? ""}`}>
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
        R$
      </span>
      <Input
        ref={ref}
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onFocus={(e) => {
          focused.current = true;
          if (!value) setText("");
          const el = e.target;
          requestAnimationFrame(() => el.select());
        }}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d,.]/g, "");
          setText(raw);
          onValueChange(parseBRLInput(raw));
        }}
        onBlur={() => {
          focused.current = false;
          setText(fmt(parseBRLInput(text)));
        }}
        className="pl-9 tabular-nums"
        {...rest}
      />
    </div>
  );
});
