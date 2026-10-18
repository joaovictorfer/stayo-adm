import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function QuantityPicker({
  label,
  value,
  onChange,
  compact = false,
}: {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
  compact?: boolean;
}) {
  const options = compact ? [0, 1, 2] : [0, 1, 2, 3, 4, 5];
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      {options.map((n) => (
        <Button
          key={n}
          variant="outline"
          aria-label={`${label}: ${n}`}
          aria-pressed={value === n}
          onClick={() => onChange(n)}
          className={cn(
            "size-12 rounded-full p-0 font-display text-lg shadow-none",
            compact && "size-11",
            value === n &&
              "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
          )}
        >
          {n}
        </Button>
      ))}
      <div className={cn("flex items-center gap-1", compact && "w-full justify-between")}>
        <Button
          variant="ghost"
          className="size-11 p-0"
          aria-label={`Diminuir ${label}`}
          disabled={value === null || value === 0}
          onClick={() => onChange(Math.max(0, (value ?? 0) - 1))}
        >
          <Minus />
        </Button>
        {value !== null && value > (compact ? 2 : 5) && (
          <output
            aria-label={`Total ${label}`}
            className="min-w-7 text-center font-display text-xl font-semibold"
          >
            {value}
          </output>
        )}
        <Button
          variant="ghost"
          className="size-11 p-0"
          aria-label={`Aumentar ${label}`}
          disabled={value === 20}
          onClick={() => onChange(Math.min(20, (value ?? 0) + 1))}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}
function BedVisual({ type }: { type: string }) {
  const width =
    type === "Solteiro" || type === "Auxiliar"
      ? 54
      : type === "King"
        ? 108
        : type === "Queen"
          ? 94
          : 82;
  const left = (160 - width) / 2;
  const double = type !== "Solteiro" && type !== "Auxiliar";
  return (
    <svg
      viewBox="0 0 160 110"
      role="img"
      aria-label={`Cama ${type}`}
      className="h-28 w-full text-primary"
    >
      <rect x={left - 5} y="13" width={width + 10} height="85" rx="5" className="fill-primary/15" />
      <rect
        x={left}
        y="17"
        width={width}
        height="76"
        rx="4"
        className="fill-background stroke-primary/40"
        strokeWidth="1.5"
      />
      <rect
        x={left + 5}
        y="23"
        width={double ? (width - 15) / 2 : width - 10}
        height="18"
        rx="4"
        className="fill-primary/10 stroke-primary/30"
      />
      {double && (
        <rect
          x={left + width / 2 + 2}
          y="23"
          width={(width - 15) / 2}
          height="18"
          rx="4"
          className="fill-primary/10 stroke-primary/30"
        />
      )}
      <rect x={left + 1} y="47" width={width - 2} height="45" rx="3" className="fill-primary/10" />
      <path d={`M${left + 1} 53h${width - 2}`} className="stroke-primary/30" strokeWidth="2" />
      {type === "Auxiliar" && (
        <>
          <circle cx={left + 8} cy="101" r="3" className="fill-primary/50" />
          <circle cx={left + width - 8} cy="101" r="3" className="fill-primary/50" />
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
  return (
    <div
      className={cn(
        "field-bed-card rounded-lg border bg-card p-3 sm:p-4",
        value > 0 && "border-primary bg-primary/5",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{type}</h3>
        <span
          className={cn(
            "grid size-7 place-items-center rounded-full font-display text-sm",
            value > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {value}
        </span>
      </div>
      <BedVisual type={type} />
      <QuantityPicker compact label={`${room} · ${type}`} value={value} onChange={onChange} />
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
          value === null
            ? "border-border text-muted-foreground"
            : "border-primary/40 text-primary",
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
