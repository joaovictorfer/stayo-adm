import { forwardRef, useEffect, useRef, useState } from "react";
import { Input } from "../ui/input";

import { parseBRLInput } from "../../lib/money-input";
export { parseBRLInput };

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
