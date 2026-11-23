import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { Input } from "./input";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { brazilianDateToISO, formatCalendarDate, parseCalendarDate, validTime24 } from "@/lib/local-date";

type Props = { value: string; onValueChange: (value: string) => void; min?: string; max?: string; required?: boolean; className?: string; "aria-label"?: string };

/** Visible Brazilian dates, canonical ISO values; no browser-native locale dependency. */
export function BrazilianDateInput({ value, onValueChange, min, max, required, className, "aria-label": label }: Props) {
  const [text, setText] = useState(formatCalendarDate(value, ""));
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setText(formatCalendarDate(value, "")); }, [value]);
  const iso = brazilianDateToISO(text);
  const valid = text === "" ? !required : !!iso && (!min || iso >= min) && (!max || iso <= max);
  useEffect(() => { ref.current?.setCustomValidity(valid ? "" : "Informe uma data válida no formato DD/MM/AAAA e dentro do período permitido."); }, [valid]);
  const selectedISO = parseCalendarDate(value);
  const selected = selectedISO ? new Date(selectedISO.getUTCFullYear(), selectedISO.getUTCMonth(), selectedISO.getUTCDate(), 12) : undefined;
  return <div className="relative min-w-0">
    <Input ref={ref} aria-label={label} className={`${className ?? ""} pr-10`} inputMode="numeric" placeholder="DD/MM/AAAA" maxLength={10} required={required} value={text} onChange={(e) => {
      const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
      const next = digits.length <= 2 ? digits : digits.length <= 4 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
      setText(next);
      const parsed = brazilianDateToISO(next);
      if (!next) onValueChange("");
      else if (parsed && (!min || parsed >= min) && (!max || parsed <= max)) onValueChange(parsed);
    }} />
    <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button type="button" size="icon" variant="ghost" className="absolute right-1 top-1/2 size-8 -translate-y-1/2" aria-label={`Abrir calendário${label ? `: ${label}` : ""}`} title="Escolher data"><CalendarDays className="size-4" /></Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="end"><Calendar locale={ptBR} mode="single" selected={selected} {...(selected ? { defaultMonth: selected } : {})} disabled={(day) => {
      const candidate = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
      return !!((min && candidate < min) || (max && candidate > max));
    }} onSelect={(day) => { if (!day) return; const next = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`; onValueChange(next); setText(formatCalendarDate(next)); setOpen(false); }} /></PopoverContent></Popover>
  </div>;
}

export function BrazilianTimeInput({ value, onValueChange, className, "aria-label": label }: Pick<Props, "value" | "onValueChange" | "className" | "aria-label">) {
  const [text, setText] = useState(value.slice(0, 5));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setText(value.slice(0, 5)); }, [value]);
  useEffect(() => { ref.current?.setCustomValidity(!text || validTime24(text) ? "" : "Informe um horário válido entre 00:00 e 23:59."); }, [text]);
  return <Input ref={ref} aria-label={label} className={className} inputMode="numeric" placeholder="HH:mm" maxLength={5} value={text} onChange={(e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
    const next = digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
    setText(next);
    if (!next || validTime24(next)) onValueChange(next);
  }} />;
}