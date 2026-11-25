import { useEffect, useRef, useState } from "react";
import { ArrowRight, Minus, Plus } from "lucide-react";
import { Button } from "../ui/button";
import type { OwnerOnboardingSubmissionInput } from "../../types/owner-onboarding";
import { propertyRegistrationErrors, type PropertyKey } from "../../lib/owner-property-registration";

export function PropertyRegistrationStep({ token, form, finishing, onSet, onBack, onContinue }: {
  token: string;
  form: OwnerOnboardingSubmissionInput;
  finishing: boolean;
  onSet: <K extends keyof OwnerOnboardingSubmissionInput>(key: K, value: OwnerOnboardingSubmissionInput[K]) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [touched, setTouched] = useState(false);
  const storageKey = `stayo:property-substep:${token.slice(0, 12)}`;
  const top = useRef<HTMLElement>(null);
  useEffect(() => { const saved = window.localStorage.getItem(storageKey); if (saved === "2" || saved === "3") setStep(Number(saved) as 2 | 3); }, [storageKey]);
  const go = (next: 1 | 2 | 3) => {
    setStep(next);
    setTouched(false);
    window.localStorage.setItem(storageKey, String(next));
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const errors = propertyRegistrationErrors(form);
  const field = (key: "propertyCondominiumName" | "propertyUnit" | "propertyParkingBox" | "propertyWifiNetwork" | "propertyWifiPassword" | "propertyAccessCode" | "propertyInstallerFurniture" | "propertyInstallerHeater" | "propertyInstallerAc", label: string) => (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input className="portal-input w-full" aria-label={label} value={form[key] ?? ""} maxLength={160}
        onChange={(event) => onSet(key, event.target.value)} />
      {touched && (key === "propertyCondominiumName" || key === "propertyUnit") && errors[key] && <span className="block text-sm text-destructive">{errors[key]}</span>}
    </label>
  );
  const next = () => {
    setTouched(true);
    if (step === 1) {
      if (!errors.propertyCondominiumName && !errors.propertyUnit) go(2);
    } else if (step === 2) go(3);
    else onContinue();
  };
  const counters: Array<{ key: PropertyKey; label: string }> = [
    { key: "propertyBedrooms", label: "Quartos" }, { key: "propertyBathrooms", label: "Banheiros" },
    { key: "propertySuites", label: "Suítes" }, { key: "propertyLavatories", label: "Lavabos" },
  ];
  return (
    <section className="pd-step" ref={top}>
      <div className="pd-head"><h2 className="pd-title">Agora, vamos confirmar seu imóvel</h2>
        <p className="pd-lead">Confira os dados que a STAYO já preencheu.</p></div>
      <p className="pd-sub">PASSO {step}/3 · {step === 1 ? "Unidade" : step === 2 ? "Acesso, Wi-Fi e instaladores" : "Ambientes"}</p>
      {step === 1 ? <div className="pd-fields">
        {form.propertyCondominiumLinked ? <div>
          <span className="mb-1.5 block text-sm font-medium">Condomínio</span>
          <div className="pd-readonly">{form.propertyCondominiumName || "A confirmar com a STAYO"}</div>
          <a className="pd-hint inline-flex min-h-11 items-center underline" href="https://wa.me/5554991403953">Solicitar correção à STAYO</a>
        </div> : field("propertyCondominiumName", "Condomínio")}
        {field("propertyUnit", "Apartamento")}
        {field("propertyParkingBox", "Box (opcional)")}
        <p className="pd-note">O endereço do condomínio já está conosco.</p>
      </div> : step === 2 ? <div className="pd-fields">
        <p className="pd-lead">Dados usados pela equipe e pelos hóspedes. Se ainda não tiver, pode deixar em branco.</p>
        <p className="pd-group">Wi-Fi</p>
        {field("propertyWifiNetwork", "Nome da rede Wi-Fi")}
        {field("propertyWifiPassword", "Senha do Wi-Fi")}
        <p className="pd-group">Fechadura</p>
        {field("propertyAccessCode", "Senha da fechadura")}
        <p className="pd-group">Instaladores</p>
        <p className="pd-hint">Empresa ou pessoa e telefone, para manutenção e garantia.</p>
        {field("propertyInstallerFurniture", "Móveis")}
        {field("propertyInstallerHeater", "Aquecedor")}
        {field("propertyInstallerAc", "Ar-condicionado")}
      </div> : <div className="pd-fields">
        <p className="pd-lead">Informe as quantidades. Se não houver, marque zero.</p>
        <div className="pd-steppers">{counters.map(({ key, label }) => {
          const value = form[key];
          const count = typeof value === "number" ? value : null;
          return <div key={key}>
            <div className="pd-stepper"><span className="pd-stepper-label">{label}</span>
              <div className="pd-stepper-ctrl">
                <Button variant="ghost" type="button" aria-label={`Diminuir ${label.toLowerCase()}`} disabled={count === 0}
                  onClick={() => onSet(key, count === null ? 0 : Math.max(0, count - 1))}><Minus className="size-4" /></Button>
                <output aria-label={label} aria-live="polite">{count ?? "–"}</output>
                <Button variant="ghost" type="button" aria-label={`Aumentar ${label.toLowerCase()}`} disabled={count === 30}
                  onClick={() => onSet(key, count === null ? 0 : count + 1)}><Plus className="size-4" /></Button>
              </div></div>
            {touched && errors[key as keyof typeof errors] && <p className="text-sm text-destructive">{errors[key as keyof typeof errors]}</p>}
          </div>;
        })}</div>
      </div>}
      <div className="pd-actions">
        <Button type="button" className="portal-cta pd-cta" disabled={finishing} onClick={next}>Continuar <ArrowRight className="size-4" /></Button>
        <Button variant="ghost" type="button" className="pd-back" onClick={() => step === 3 ? go(2) : step === 2 ? go(1) : onBack()}>Voltar</Button>
      </div>
    </section>
  );
}