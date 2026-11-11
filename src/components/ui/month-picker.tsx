import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const months = Array.from({ length: 12 }, (_, index) =>
  new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, index, 1))),
);

type MonthPickerProps = {
  value: string;
  onValueChange: (value: string) => void;
  "aria-label": string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
};

/** Display is independent of the browser language; persisted competence stays YYYY-MM. */
export function MonthPicker({ value, onValueChange, className, required, disabled, "aria-label": label }: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(2026);
  const [selectedYear, selectedMonth] = value.split("-");
  const monthIndex = Number(selectedMonth) - 1;
  const month = months[monthIndex];
  const display = month && selectedYear ? `${month.charAt(0).toUpperCase()}${month.slice(1)} de ${selectedYear}` : "Selecionar mês";
  return <Popover open={open} onOpenChange={(next) => {
    if (next) setYear(Number(selectedYear) || new Date().getFullYear());
    setOpen(next);
  }}>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" disabled={disabled} aria-label={label} aria-required={required}
        className={cn("h-11 w-full min-w-0 justify-between gap-2 font-normal", !value && "text-muted-foreground", className)}>
        <span className="truncate">{display}</span><CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-72 max-w-[calc(100vw-2rem)] p-3" aria-label={`Selecionar ${label.toLowerCase()}`}>
      <div className="mb-3 flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" aria-label="Ano anterior" disabled={year <= 1} onClick={() => setYear(year - 1)}><ChevronLeft /></Button>
        <Input aria-label="Ano" type="number" min={1} max={9999} value={year} className="min-w-0 text-center tabular-nums"
          onChange={(event) => { const next = Number(event.target.value); if (Number.isInteger(next) && next >= 1 && next <= 9999) setYear(next); }} />
        <Button type="button" variant="ghost" size="icon" aria-label="Próximo ano" disabled={year >= 9999} onClick={() => setYear(year + 1)}><ChevronRight /></Button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {months.map((name, index) => <Button key={name} type="button" variant={Number(selectedYear) === year && monthIndex === index ? "default" : "ghost"}
          className="h-10 min-w-0 px-1 text-xs font-normal capitalize" aria-pressed={Number(selectedYear) === year && monthIndex === index}
          onClick={() => { onValueChange(`${String(year).padStart(4, "0")}-${String(index + 1).padStart(2, "0")}`); setOpen(false); }}>{name}</Button>)}
      </div>
      {!required && value && <Button type="button" variant="ghost" className="mt-2 h-9 w-full text-muted-foreground" onClick={() => { onValueChange(""); setOpen(false); }}>Limpar mês</Button>}
    </PopoverContent>
  </Popover>;
}