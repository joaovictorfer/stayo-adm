export const BRAZILIAN_BANKS = [
  "Banco do Brasil",
  "Bradesco",
  "Caixa Econômica Federal",
  "Itaú Unibanco",
  "Nubank",
  "Santander",
  "Sicoob",
  "Sicredi",
  "Inter",
  "C6 Bank",
] as const;

export const PIX_KEY_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "phone", label: "Telefone" },
  { value: "email", label: "E-mail" },
  { value: "random", label: "Chave aleatória" },
] as const;

export const ACCOUNT_TYPES = [
  { value: "checking", label: "Conta corrente" },
  { value: "savings", label: "Conta poupança" },
  { value: "payment", label: "Conta de pagamento" },
] as const;