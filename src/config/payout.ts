import type { PixKeyType } from "../types/owner-onboarding";

export const payoutBanks = [
  "Banco do Brasil",
  "Caixa Econômica Federal",
  "Bradesco",
  "Itaú Unibanco",
  "Santander",
  "Nubank",
  "Banco Inter",
  "Sicredi",
  "Sicoob",
  "BTG Pactual",
  "C6 Bank",
] as const;

export const pixKeyTypes: ReadonlyArray<{ value: PixKeyType; label: string }> = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "phone", label: "Telefone" },
  { value: "email", label: "E-mail" },
  { value: "random", label: "Chave aleatória" },
];

export const pixKeyTypeLabels: Record<PixKeyType, string> = Object.fromEntries(
  pixKeyTypes.map(({ value, label }) => [value, label]),
) as Record<PixKeyType, string>;