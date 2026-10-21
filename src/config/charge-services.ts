/** Serviços padrão para cobranças (valores em centavos). Tocar adiciona como item editável. */
export const CHARGE_SERVICE_PRESETS = [
  { description: "Limpeza comercial", unitCents: 20000 },
  { description: "Limpeza comercial", unitCents: 25000 },
  { description: "Limpeza comercial", unitCents: 30000 },
  { description: "Limpeza pós-obra", unitCents: 50000 },
  { description: "Implantação", unitCents: 50000 },
  { description: "Lavagem de enxoval", unitCents: 4900 },
] as const;
