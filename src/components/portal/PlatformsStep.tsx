import { ArrowRight, Check, ChevronRight, CreditCard, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "../ui/button";
import {
  OPTIONAL_CHANNELS,
  PLATFORM_COPY,
  isValidEmail,
  type DistributionChannel,
} from "../../lib/api/owner-platforms";

export function PlatformsStep({
  channels,
  airbnbEmail,
  onChange,
  onBack,
  onContinue,
}: {
  channels: DistributionChannel[];
  airbnbEmail: string;
  onChange: (channels: DistributionChannel[], airbnbEmail: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [touched, setTouched] = useState(false);
  const [open, setOpen] = useState(false);
  const topRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: "start" });
  }, []);

  const emailError = !airbnbEmail.trim()
    ? "Informe o e-mail da sua conta Airbnb"
    : !isValidEmail(airbnbEmail)
      ? "Confira o e-mail"
      : null;

  const toggle = (key: DistributionChannel) => {
    const next = channels.includes(key) ? channels.filter((c) => c !== key) : [...channels, key];
    onChange(next, airbnbEmail);
  };

  const next = () => {
    setTouched(true);
    if (emailError) {
      toast.error("Informe o e-mail da sua conta Airbnb");
      return;
    }
    onContinue();
  };

  return (
    <section className="pd-step" ref={topRef}>
      <div className="pd-head">
        <h2 className="pd-title">Onde você quer anunciar?</h2>
        <p className="pd-lead">Airbnb já faz parte da operação STAYO. Você escolhe os demais canais.</p>
      </div>

      <div className="pf-airbnb">
        <div className="pf-airbnb-head">
          <span className="pf-box is-on is-locked" aria-hidden="true"><Check className="size-4" /></span>
          <strong>Airbnb</strong>
          <span className="pf-badge">Padrão</span>
        </div>
        <ul className="pf-highlights">
          <li><ShieldCheck className="size-4" aria-hidden="true" />{PLATFORM_COPY.airbnbHighlights[0]}</li>
          <li><CreditCard className="size-4" aria-hidden="true" />{PLATFORM_COPY.airbnbHighlights[1]}</li>
        </ul>
        <label className="portal-field-label" htmlFor="pf-airbnb-email">E-mail da sua conta Airbnb</label>
        <input
          id="pf-airbnb-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          className="portal-input pf-input"
          placeholder="seuemail@exemplo.com"
          value={airbnbEmail}
          onChange={(e) => onChange(channels, e.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={touched && Boolean(emailError)}
        />
        {touched && emailError ? (
          <p className="pd-error">{emailError}</p>
        ) : (
          <p className="pd-hint">Use o mesmo e-mail cadastrado no Airbnb.</p>
        )}
      </div>

      <div className="pf-others">
        <h3 className="pf-others-title">Quer ampliar sua distribuição?</h3>
        {OPTIONAL_CHANNELS.map((c) => {
          const on = channels.includes(c.key);
          return (
            <button
              key={c.key}
              type="button"
              role="checkbox"
              aria-checked={on}
              className={`pf-row${on ? " is-on" : ""}`}
              onClick={() => toggle(c.key)}
            >
              <span className={`pf-box${on ? " is-on" : ""}`} aria-hidden="true">{on && <Check className="size-4" />}</span>
              {c.label}
            </button>
          );
        })}
      </div>

      <div className="pf-disclosure">
        <button type="button" className="pf-disclosure-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <ShieldCheck className="size-5" aria-hidden="true" />
          <span>{PLATFORM_COPY.disclosureTitle}</span>
          <ChevronRight className={`size-4 pf-chev${open ? " is-open" : ""}`} aria-hidden="true" />
        </button>
        {open && (
          <ul className="pf-disclosure-list">
            {PLATFORM_COPY.disclosure.map((t) => <li key={t}>{t}</li>)}
          </ul>
        )}
      </div>

      <div className="pd-actions">
        <Button type="button" className="portal-cta pd-cta" onClick={next}>
          Continuar <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
        <button type="button" className="pd-back" onClick={onBack}>Voltar</button>
      </div>
    </section>
  );
}
