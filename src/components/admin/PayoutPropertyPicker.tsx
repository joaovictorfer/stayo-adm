import { useState } from "react";
import { Check, ChevronsUpDown, Building2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";

export type PayoutProperty = { id: string; code: string; nickname: string | null; condominium_name: string | null; unit: string | null };
export const payoutPropertyName = (p: PayoutProperty) => [p.condominium_name, p.unit].filter(Boolean).join(" ") || p.nickname || p.code;

export function PayoutPropertyPhoto({ url, name, large = false }: { url?: string | undefined; name: string; large?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string>();
  return <span className={`payout-property-photo${large ? " is-large" : ""}`}>
    {url && failedUrl !== url ? <img src={url} alt={name} loading="lazy" onError={() => setFailedUrl(url)} /> : <Building2 aria-hidden="true" />}
  </span>;
}

export function PayoutPropertyPicker({ properties, covers, value, onChange, loading, error }: { properties: PayoutProperty[]; covers: Record<string, string>; value: string; onChange: (id: string) => void; loading: boolean; error: boolean }) {
  const [open, setOpen] = useState(false);
  const selected = properties.find(p => p.id === value);
  return <div className="payout-property-field">
    <span id="payout-property-label" className="text-xs font-semibold text-muted-foreground">Imóvel</span>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-labelledby="payout-property-label" aria-expanded={open} className="payout-property-trigger" disabled={loading || error}>
          {selected ? <PayoutPropertyPhoto url={covers[selected.id]} name={payoutPropertyName(selected)} /> : <span className="payout-property-search-icon"><Search /></span>}
          <span className="min-w-0 flex-1 text-left"><span className="block truncate font-semibold">{selected ? payoutPropertyName(selected) : loading ? "Carregando imóveis…" : error ? "Imóveis indisponíveis" : "Buscar imóvel"}</span><span className="block truncate text-xs text-muted-foreground">{selected ? selected.code : "Nome, unidade ou código"}</span></span>
          <ChevronsUpDown className="shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="payout-property-popover p-0">
        <Command>
          <CommandInput placeholder="Buscar nome, unidade ou código…" aria-label="Pesquisar imóveis" className="h-12" />
          <CommandList className="max-h-96">
            <CommandEmpty>Nenhum imóvel encontrado.</CommandEmpty>
            <CommandGroup heading={`${properties.length} imóveis`}>
              {properties.map(p => <CommandItem key={p.id} value={`${p.code} ${payoutPropertyName(p)} ${p.nickname ?? ""}`} onSelect={() => { onChange(p.id); setOpen(false); }} className="payout-property-option">
                <PayoutPropertyPhoto url={covers[p.id]} name={payoutPropertyName(p)} />
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{payoutPropertyName(p)}</span><span className="block text-xs text-muted-foreground">{p.code}</span></span>
                {value === p.id && <Check className="text-primary" />}
              </CommandItem>)}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  </div>;
}