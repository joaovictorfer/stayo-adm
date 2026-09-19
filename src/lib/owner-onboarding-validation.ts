import type { OwnerOnboardingDraft } from "../types/owner-onboarding";
import { isValidBrazilPhone } from "./phone";

export const onlyDigits = (value: string) => value.replace(/\D/g, "");

export function formatTaxId(value: string, type: "pf" | "pj" | null): string {
  const digits = onlyDigits(value).slice(0, type === "pj" ? 14 : 11);
  if (type === "pj") return digits.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
  return digits.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/(\d{3})(\d)/, "$1-$2");
}

export function formatPostalCode(value: string): string {
  return onlyDigits(value).slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
}

export function isStepValid(step: number, draft: OwnerOnboardingDraft): boolean {
  if (step === 1) return Boolean(draft.personType && draft.legalName.trim().length >= 2 && onlyDigits(draft.taxId).length === (draft.personType === "pf" ? 11 : 14));
  if (step === 2) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim()) && isValidBrazilPhone(draft.phone);
  if (step === 3) return onlyDigits(draft.postalCode).length === 8 && Boolean(draft.street.trim() && draft.number.trim() && draft.district.trim() && draft.city.trim() && /^[A-Za-z]{2}$/.test(draft.state));
  if (step === 4) return Boolean(draft.bankName.trim() && draft.accountHolder.trim() && [11, 14].includes(onlyDigits(draft.holderTaxId).length) && draft.pixType && draft.pixKey.trim());
  return draft.confirmed && [1, 2, 3, 4].every((value) => isStepValid(value, draft));
}