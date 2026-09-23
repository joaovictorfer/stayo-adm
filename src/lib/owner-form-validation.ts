import { z } from "zod";

export type OwnerPersonType = "pf" | "pj";
export type PixKeyType = "cpf" | "cnpj" | "phone" | "email" | "random";
export type SmartPayoutPerson = {
  personType: OwnerPersonType;
  fullName: string;
  document: string;
  email: string;
  phone: string;
};

export const normalizeDocument = (value: string | null | undefined): string =>
  value?.replace(/\D/g, "") ?? "";

export const normalizePhone = (value: string | null | undefined): string => {
  const normalized = normalizeDocument(value);
  const national = normalized.replace(/^55(?=\d{10,11}$)/, "");
  return national.length === 10 || national.length === 11 ? `55${national}` : national;
};

export const normalizeEmail = (value: string | null | undefined): string =>
  value?.trim().toLocaleLowerCase("pt-BR") ?? "";

export const normalizeName = (value: string | null | undefined): string =>
  value?.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR") ?? "";

function hasRepeatedDigits(value: string): boolean {
  return /^(\d)\1+$/.test(value);
}

export function isValidCpf(value: string): boolean {
  const cpf = normalizeDocument(value);
  if (cpf.length !== 11 || hasRepeatedDigits(cpf)) return false;
  const calculate = (length: 9 | 10) => {
    const sum = cpf
      .slice(0, length)
      .split("")
      .reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return calculate(9) === Number(cpf[9]) && calculate(10) === Number(cpf[10]);
}

export function isValidCnpj(value: string): boolean {
  const cnpj = normalizeDocument(value);
  if (cnpj.length !== 14 || hasRepeatedDigits(cnpj)) return false;
  const calculate = (base: string, weights: number[]) => {
    const sum = base
      .split("")
      .reduce((total, digit, index) => total + Number(digit) * (weights[index] ?? 0), 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const first = calculate(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calculate(cnpj.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cnpj.endsWith(`${first}${second}`);
}

export function isValidBrazilianDocument(value: string): boolean {
  return isValidCpf(value) || isValidCnpj(value);
}

export function formatBrazilianDocument(value: string): string {
  const valueDigits = normalizeDocument(value).slice(0, 14);
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
  const valueDigits = normalizePhone(value)
    .replace(/^55(?=\d{10,11}$)/, "")
    .slice(0, 11);
  if (valueDigits.length <= 10)
    return valueDigits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return valueDigits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

export function formatBrazilianPostalCode(value: string): string {
  return normalizeDocument(value)
    .slice(0, 8)
    .replace(/(\d{5})(\d)/, "$1-$2");
}

const requiredName = z
  .string()
  .transform((value) => value.trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(3, "Informe o nome completo ou razão social.")
      .max(120, "Use até 120 caracteres."),
  );
const documentSchema = z
  .string()
  .min(1, "Informe o CPF ou CNPJ.")
  .refine(isValidBrazilianDocument, "Confira o CPF ou CNPJ informado.");
const emailSchema = z
  .string()
  .transform(normalizeEmail)
  .pipe(
    z
      .string()
      .email("Digite um e-mail válido, como nome@exemplo.com.")
      .max(255, "Use até 255 caracteres."),
  );
const phoneSchema = z
  .string()
  .refine(
    (value) => /^55\d{10,11}$/.test(normalizePhone(value)),
    "Digite um telefone brasileiro com DDD.",
  );

export const ownerOnboardingFormSchema = z.object({
  personType: z.enum(["pf", "pj"]),
  fullName: requiredName,
  document: documentSchema,
  email: emailSchema,
  phone: phoneSchema,
  postalCode: z
    .string()
    .refine((value) => normalizeDocument(value).length === 8, "Digite um CEP válido."),
  street: z.string().trim().min(2, "Informe o endereço.").max(160),
  number: z.string().trim().min(1, "Informe o número.").max(20),
  complement: z.string().trim().max(100).nullable(),
  district: z.string().trim().min(2, "Informe o bairro.").max(100),
  city: z.string().trim().min(2, "Informe a cidade.").max(100),
  state: z
    .string()
    .trim()
    .length(2, "Informe a UF.")
    .transform((value) => value.toUpperCase()),
  bankName: z.string().trim().min(2, "Informe o banco.").max(120),
  bankBranch: z.string().trim().min(1, "Informe a agência.").max(20),
  accountNumber: z.string().trim().min(1, "Informe a conta.").max(30),
  accountType: z.enum(["checking", "savings", "payment"]),
  accountHolder: requiredName,
  holderTaxId: documentSchema,
  pixType: z.enum(["cpf", "cnpj", "phone", "email", "random"]),
  pixKey: z
    .string()
    .trim()
    .min(1, "Informe a chave Pix.")
    .max(255, "A chave Pix deve ter até 255 caracteres."),
  isPrimary: z.boolean(),
  people: z
    .array(
      z.object({
        role: z.enum(["proprietario", "coproprietario", "proponente"]),
        personType: z.enum(["pf", "pj"]),
        fullName: requiredName,
        document: documentSchema,
        email: z
          .string()
          .refine(
            (value) => !value || emailSchema.safeParse(value).success,
            "Digite um e-mail válido.",
          ),
        phone: z
          .string()
          .refine(
            (value) => !value || phoneSchema.safeParse(value).success,
            "Digite um telefone com DDD.",
          ),
      }),
    )
    .min(1)
    .max(10),
});

export const ownerAdminEditSchema = z.object({
  name: requiredName,
  phone: phoneSchema.nullable().or(z.literal("")),
  email: emailSchema.nullable().or(z.literal("")),
  document: documentSchema.nullable().or(z.literal("")),
});

export type OwnerFormField = keyof z.input<typeof ownerOnboardingFormSchema>;

export function validateOwnerField(field: OwnerFormField, value: unknown): string | undefined {
  const result = ownerOnboardingFormSchema.shape[field].safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
}

export function normalizeOwnerSubmission(input: z.output<typeof ownerOnboardingFormSchema>) {
  const pixKey =
    input.pixType === "cpf" || input.pixType === "cnpj"
      ? normalizeDocument(input.pixKey)
      : input.pixType === "phone"
        ? normalizePhone(input.pixKey)
        : input.pixType === "email"
          ? normalizeEmail(input.pixKey)
          : input.pixKey.trim();
  return {
    ...input,
    fullName: input.fullName.trim().replace(/\s+/g, " "),
    document: normalizeDocument(input.document),
    email: normalizeEmail(input.email),
    phone: normalizePhone(input.phone),
    postalCode: normalizeDocument(input.postalCode),
    bankBranch: input.bankBranch.trim(),
    accountNumber: input.accountNumber.trim(),
    holderTaxId: normalizeDocument(input.holderTaxId),
    pixKey,
    people: input.people.map((person) => ({
      ...person,
      fullName: person.fullName.trim().replace(/\s+/g, " "),
      document: normalizeDocument(person.document),
      email: normalizeEmail(person.email),
      phone: normalizePhone(person.phone),
    })),
  };
}

export function suggestPixKey(person: SmartPayoutPerson, type: PixKeyType): string {
  if (type === "cpf" || type === "cnpj") return normalizeDocument(person.document);
  if (type === "phone") return normalizePhone(person.phone);
  if (type === "email") return normalizeEmail(person.email);
  return "";
}

export function maskDocument(value: string | null | undefined): string {
  const normalized = normalizeDocument(value);
  if (normalized.length === 11) return `***.${normalized.slice(3, 6)}.${normalized.slice(6, 9)}-**`;
  if (normalized.length === 14)
    return `**.${normalized.slice(2, 5)}.${normalized.slice(5, 8)}/****-**`;
  return value ? "••••••••" : "—";
}

export function maskPixKey(value: string | null | undefined): string {
  if (!value) return "—";
  if (value.length <= 6) return "••••";
  return `${value.slice(0, 3)}${"•".repeat(Math.min(8, value.length - 6))}${value.slice(-3)}`;
}
