import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function BedVisual({ type }: { type: string }) {
  const width =
    type === "Solteiro" || type === "Auxiliar"
      ? 64
      : type === "King"
        ? 128
        : type === "Queen"
          ? 110
          : 96;
  const x = (160 - width) / 2;
  const double = width > 80;
  return (
    <svg
      viewBox="0 0 160 90"
      role="img"
      aria-label={`Cama ${type}`}
      className="h-14 w-24 shrink-0 text-primary"
    >
      {/* Cabeceira */}
      <rect x={x - 6} y="8" width="9" height="48" rx="4" className="fill-primary/25" />
      {/* Colchão */}
      <rect
        x={x}
        y="34"
        width={width}
        height="22"
        rx="5"
        className="fill-background stroke-primary/50"
        strokeWidth="1.5"
      />
      {/* Coberta */}
      <path
        d={`M${x + width * 0.38} 34h${width * 0.62 - 5}q5 0 5 5v12q0 5 -5 5H${x + width * 0.38}z`}
        className="fill-primary/15"
      />
      {/* Travesseiros */}
      <rect
        x={x + 5}
        y="25"
        width={double ? 20 : 26}
        height="11"
        rx="5"
        className="fill-primary/20 stroke-primary/40"
      />
      {double && (
        <rect
          x={x + 28}
          y="25"
          width="20"
          height="11"
          rx="5"
          className="fill-primary/20 stroke-primary/40"
        />
      )}
      {/* Pés */}
      <rect x={x + 3} y="56" width="5" height="11" rx="2" className="fill-primary/40" />
      <rect x={x + width - 8} y="56" width="5" height="11" rx="2" className="fill-primary/40" />
      {/* Rodinhas da auxiliar */}
      {type === "Auxiliar" && (
        <>
          <circle cx={x + 10} cy="71" r="3.5" className="fill-primary/50" />
          <circle cx={x + width - 10} cy="71" r="3.5" className="fill-primary/50" />
        </>
      )}
    </svg>
  );
}

export function BedSelectionCard({
  type,
  room,
  value,
  onChange,
}: {
  type: string;
  room: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const add = () => onChange(Math.min(20, value + 1));
  return (
    <div
      className={cn(
        "field-bed-card rounded-lg border bg-card p-2",
        value > 0 && "border-primary bg-primary/5",
      )}
    >
      <button
        type="button"
        aria-label={`Adicionar ${type} em ${room}`}
        onClick={add}
        className="flex w-full items-center gap-2.5 rounded-md p-1 text-left"
      >
        <BedVisual type={type} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{type}</span>
          <span
            className={cn(
              "block text-xs",
              value > 0 ? "font-medium text-primary" : "text-muted-foreground",
            )}
          >
            {value > 0 ? `${value} no quarto` : "Toque para adicionar"}
          </span>
        </span>
        {value > 0 && (
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary font-display text-sm text-primary-foreground">
            {value}
          </span>
        )}
      </button>
      {value > 0 && (
        <div className="mt-0.5 flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            className="size-9 p-0"
            aria-label={`Remover ${type} de ${room}`}
            onClick={() => onChange(Math.max(0, value - 1))}
          >
            <Minus />
          </Button>
          <Button
            variant="ghost"
            className="size-9 p-0"
            aria-label={`Adicionar ${type} em ${room}`}
            disabled={value === 20}
            onClick={add}
          >
            <Plus />
          </Button>
        </div>
      )}
    </div>
  );
}

export function CompactCounter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
}) {
  const count = value ?? 0;
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1.5">
      <Button
        variant="outline"
        className="size-11 rounded-full p-0 shadow-none"
        aria-label={`Diminuir ${label}`}
        disabled={count === 0}
        onClick={() => onChange(Math.max(0, count - 1))}
      >
        <Minus />
      </Button>
      <output
        aria-label={label}
        className={cn(
          "grid size-11 place-items-center rounded-full border font-display text-lg font-semibold",
          value === null ? "border-border text-muted-foreground" : "border-primary/40 text-primary",
        )}
      >
        {value ?? "–"}
      </output>
      <Button
        variant="outline"
        className="size-11 rounded-full p-0 shadow-none"
        aria-label={`Aumentar ${label}`}
        disabled={value === 20}
        onClick={() => onChange((value ?? 0) + 1)}
      >
        <Plus />
      </Button>
    </div>
  );
}
