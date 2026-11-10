import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { saveOwnerAddress, type OwnerAddress } from "../../../lib/api/core-client";
import { formatBrazilianPostalCode } from "../../../lib/owner-form-validation";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";

const fields: Array<{ key: keyof OwnerAddress; label: string; autoComplete: string }> = [
  { key: "postalCode", label: "CEP", autoComplete: "postal-code" },
  { key: "street", label: "Logradouro", autoComplete: "address-line1" },
  { key: "number", label: "Número", autoComplete: "off" },
  { key: "complement", label: "Complemento", autoComplete: "address-line2" },
  { key: "district", label: "Bairro", autoComplete: "address-level3" },
  { key: "city", label: "Cidade", autoComplete: "address-level2" },
  { key: "state", label: "UF", autoComplete: "address-level1" },
];

export function OwnerAddressEditor({ implementationId, initial, onDone }: {
  implementationId: string; initial: OwnerAddress; onDone: () => void;
}) {
  const [address, setAddress] = useState(initial);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  return <form className="space-y-3" onSubmit={async event => {
    event.preventDefault();
    setSaving(true);
    try {
      await saveOwnerAddress(implementationId, address);
      await qc.invalidateQueries({ queryKey: ["owner-onboarding", "submission", implementationId] });
      toast.success("Endereço salvo");
      onDone();
    } catch { toast.error("Não foi possível salvar o endereço. Confira sua permissão e tente novamente."); }
    finally { setSaving(false); }
  }}>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {fields.map(field => <label key={field.key} className={`block min-w-0 ${field.key === "street" ? "sm:col-span-2" : ""}`}>
        <span className="mb-1 block text-xs text-[var(--stayo-ink-muted)]">{field.label}</span>
        <Input value={address[field.key]} disabled={saving} autoComplete={field.autoComplete}
          inputMode={field.key === "postalCode" ? "numeric" : "text"}
          maxLength={field.key === "postalCode" ? 9 : field.key === "state" ? 2 : undefined}
          onChange={event => {
            const value = field.key === "postalCode" ? formatBrazilianPostalCode(event.target.value.replace(/\D/g, "").slice(0, 8)) : field.key === "state" ? event.target.value.replace(/[^a-z]/gi, "").toUpperCase() : event.target.value;
            setAddress(current => ({ ...current, [field.key]: value }));
          }} />
      </label>)}
    </div>
    <div className="flex gap-2">
      <Button type="submit" size="sm" disabled={saving}><Check />{saving ? "Salvando…" : "Salvar endereço"}</Button>
      <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={onDone}><X />Cancelar</Button>
    </div>
  </form>;
}