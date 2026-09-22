import { z } from "zod";

const digits = (value: string) => value.replace(/\D/g, "");

function hasRepeatedDigits(value: string): boolean {
  return /^(\d)\1+$/.test(value);
}

function isCpf(value: string): boolean {
  const cpf = digits(value);
  if (cpf.length !== 11 || hasRepeatedDigits(cpf)) return false;
  for (let factor = 10; factor >= 9; factor -= 1) {
    const length = factor === 10 ? 9 : 10;
    const sum = cpf.slice(0, length).split("").reduce((total, digit, index) => total + Number(digit) * (factor - index), 0);
    const check = (sum * 10) % 11;
    if ((check === 10 ? 0 : check) !== Number(cpf[length])) return false;
  }
  return true;
}

function isCnpj(value: string): boolean {
  const cnpj = digits(value);
  if (cnpj.length !== 14 || hasRepeatedDigits(cnpj)) return false;
  const calculate = (base: string, weights: number[]) => {
    const sum = base.split("").reduce((total, digit, index) => total + Number(digit) * (weights[index] ?? 0), 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const first = calculate(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calculate(cnpj.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cnpj.endsWith(`${first}${second}`);
}

export function formatBrazilianDocument(value: string): string {
  const valueDigits = digits(value).slice(0, 14);
  if (valueDigits.length <= 11) {
    return valueDigits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return valueDigits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

export function formatBrazilianPhone(value: string): string {
  const valueDigits = digits(value).replace(/^55(?=\d{10,11}$)/, "").slice(0, 11);
  if (valueDigits.length <= 10) {
    return valueDigits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  return valueDigits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

export const ownerOnboardingFormSchema = z.object({
  fullName: z.string().trim().min(3, "Informe seu nome completo.").max(120, "Use até 120 caracteres."),
  document: z.string().trim().min(1, "Informe seu CPF ou CNPJ.").refine((value) => isCpf(value) || isCnpj(value), "Confira o CPF ou CNPJ informado."),
  email: z.string().trim().email("Digite um e-mail válido, como nome@exemplo.com.").max(255, "Use até 255 caracteres."),
  phone: z.string().refine((value) => {
    const phone = digits(value).replace(/^55(?=\d{10,11}$)/, "");
    return phone.length === 10 || phone.length === 11;
  }, "Digite um telefone com DDD."),
  pixKey: z.string().trim().max(255, "A chave Pix deve ter até 255 caracteres.").nullable(),
});

export type OwnerFormField = keyof z.infer<typeof ownerOnboardingFormSchema>;

export function validateOwnerField(field: OwnerFormField, value: string | null): string | undefined {
  const result = ownerOnboardingFormSchema.shape[field].safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
}