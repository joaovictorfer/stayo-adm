import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AdminCondominium, AdminCondominiumInput } from "@/types/admin";

export type CondominiumFormValues = {
  name: string;
  postalCode: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  hasConcierge: boolean;
  conciergePhone: string;
};

export const emptyCondominiumForm: CondominiumFormValues = {
  name: "",
  postalCode: "",
  address: "",
  neighborhood: "",
  city: "",
  state: "RS",
  hasConcierge: false,
  conciergePhone: "",
};

export function formFromCondominium(c: AdminCondominium): CondominiumFormValues {
  return {
    name: c.name,
    postalCode: c.postalCode ?? "",
    address: c.address ?? "",
    neighborhood: c.neighborhood ?? "",
    city: c.city ?? "",
    state: c.state ?? "",
    hasConcierge: c.hasConcierge,
    conciergePhone: c.conciergePhone ?? "",
  };
}

export function inputFromForm(v: CondominiumFormValues): AdminCondominiumInput {
  return {
    name: v.name,
    postalCode: v.postalCode,
    address: v.address,
    neighborhood: v.neighborhood,
    city: v.city,
    state: v.state.toUpperCase(),
    hasConcierge: v.hasConcierge,
    conciergePhone: v.hasConcierge ? v.conciergePhone : null,
  };
}

export function maskCep(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function CondominiumForm({
  values,
  onChange,
  nameError,
}: {
  values: CondominiumFormValues;
  onChange: (next: CondominiumFormValues) => void;
  nameError?: string | null;
}) {
  const set = <K extends keyof CondominiumFormValues>(k: K, v: CondominiumFormValues[K]) =>
    onChange({ ...values, [k]: v });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
      <Field className="sm:col-span-6" label="Nome do condomínio" required>
        <Input
          autoFocus
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Ex.: Residencial Veneto"
          aria-invalid={!!nameError}
        />
        {nameError && <p className="text-xs text-destructive">{nameError}</p>}
      </Field>
      <Field className="sm:col-span-2" label="CEP">
        <Input
          inputMode="numeric"
          value={values.postalCode}
          onChange={(e) => set("postalCode", maskCep(e.target.value))}
          placeholder="00000-000"
        />
      </Field>
      <Field className="sm:col-span-4" label="Endereço">
        <Input
          value={values.address}
          onChange={(e) => set("address", e.target.value)}
          placeholder="Rua, número"
        />
      </Field>
      <Field className="sm:col-span-2" label="Bairro">
        <Input value={values.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} />
      </Field>
      <Field className="sm:col-span-3" label="Cidade">
        <Input value={values.city} onChange={(e) => set("city", e.target.value)} />
      </Field>
      <Field className="sm:col-span-1" label="UF">
        <Input
          maxLength={2}
          value={values.state}
          onChange={(e) => set("state", e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
        />
      </Field>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--admin-border)] px-3 py-2.5 sm:col-span-6">
        <Label htmlFor="condo-concierge" className="text-sm">
          Possui portaria?
        </Label>
        <Switch
          id="condo-concierge"
          checked={values.hasConcierge}
          onCheckedChange={(v) => set("hasConcierge", v)}
        />
      </div>
      {values.hasConcierge && (
        <Field className="sm:col-span-6" label="Telefone/WhatsApp da portaria">
          <Input
            inputMode="tel"
            value={values.conciergePhone}
            onChange={(e) => set("conciergePhone", maskPhone(e.target.value))}
            placeholder="(54) 99999-9999"
          />
        </Field>
      )}
    </div>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`grid gap-1.5 ${className ?? ""}`}>
      <Label className="text-xs font-medium text-[var(--admin-muted)]">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}
