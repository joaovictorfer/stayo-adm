import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import { formatPostalCode, lookupPostalCode, postalAddressPatch, type PostalAddress } from "@/lib/postal-code";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onAddress: (address: Partial<PostalAddress>) => void;
  onBlur?: () => void;
  disabled?: boolean;
  className?: string;
  error?: string;
};

export function PostalCodeInput({ value, onChange, onAddress, onBlur, disabled, className, error }: Props) {
  const id = useId();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const current = useRef({ value, onAddress, disabled });
  current.current = { value, onAddress, disabled };
  const request = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = () => {
    request.current?.abort();
    if (timer.current) clearTimeout(timer.current);
  };
  useEffect(() => { request.current?.abort(); setStatus("idle"); setMessage(""); }, [value, disabled]);
  useEffect(() => () => cancel(), []);

  async function search(cep: string) {
    cancel();
    if (current.current.disabled) return;
    const controller = new AbortController();
    request.current = controller;
    setStatus("loading");
    setMessage("");
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const address = await lookupPostalCode(cep, controller.signal);
      if (controller.signal.aborted || current.current.value.replace(/\D/g, "") !== cep.replace(/\D/g, "")) return;
      current.current.onAddress(postalAddressPatch(address));
      setStatus("success");
      setMessage("Endereço encontrado.");
    } catch (failure) {
      if (request.current !== controller || current.current.value.replace(/\D/g, "") !== cep.replace(/\D/g, "")) return;
      setStatus("error");
      setMessage(controller.signal.aborted ? "Busca indisponível. Preencha manualmente ou tente novamente." : failure instanceof Error ? failure.message : "Não foi possível buscar o CEP. Preencha manualmente.");
    } finally { clearTimeout(timeout); }
  }

  return <div className="min-w-0 space-y-1">
    <div className="flex min-w-0 gap-2">
      <Input aria-label="CEP" aria-invalid={!!error || status === "error"} aria-describedby={message || error ? id : undefined}
        className={className} autoComplete="postal-code" inputMode="numeric" maxLength={9} placeholder="00000-000"
        value={formatPostalCode(value)} disabled={disabled} onBlur={onBlur}
        onChange={event => {
          const next = formatPostalCode(event.target.value);
          cancel();
          setStatus("idle");
          setMessage("");
          onChange(next);
          if (next.replace(/\D/g, "").length === 8) timer.current = setTimeout(() => void search(next), 400);
        }} />
      <Button type="button" variant="outline" size="icon" className="shrink-0" aria-label="Buscar CEP" title="Buscar CEP"
        disabled={disabled || status === "loading" || value.replace(/\D/g, "").length !== 8} onClick={() => void search(value)}>
        {status === "loading" ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <Search className="size-4" />}
      </Button>
    </div>
    {(message || error || status === "loading") && <p id={id} role="status" className={`text-xs ${error || status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
      {error || (status === "loading" ? "Buscando endereço…" : message)}
    </p>}
  </div>;
}