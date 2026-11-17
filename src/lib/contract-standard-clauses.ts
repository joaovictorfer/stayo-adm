/** Textos padrão do Quadro Resumo, copiados literalmente do CONTRATO_STAYO_02 aprovado (17/11/2026). */
export const STANDARD_CLAUSES = {
  cleaning: "Pertence integralmente ao CONTRATADO.",
  payout: "Os repasses serão realizados exclusivamente de forma automática pela plataforma Airbnb, diretamente às contas cadastradas pelas partes, observados os percentuais de remuneração previstos neste contrato.",
  ownerUse: "Permitido, sem limite prévio, condicionado à disponibilidade do calendário e ao pagamento da taxa de limpeza.",
  marketing: "Não autorizado, ressalvada a utilização de imagens e informações do imóvel exclusivamente para divulgação e comercialização das hospedagens no Airbnb.",
  maintenanceLimit: 300,
  periodicShutdown: "A cada 4 (quatro) meses, para manutenção preventiva, inspeções técnicas e limpeza extrema, devendo ser registradas e documentadas.",
  exclusivity: "SIM — para fins de gestão operacional e comercial.",
  fines: [
    "a) Entrada do CONTRATANTE durante estadia de hóspede: R$ 2.000,00 (dois mil reais);",
    "b) Entrada sem aviso prévio: R$ 1.000,00 (mil reais);",
    "c) Cancelamento de reserva confirmada por culpa do CONTRATANTE: multa equivalente à remuneração devida ao CONTRATADO pela reserva cancelada, acrescida das penalidades efetivamente aplicadas pelo Airbnb, observada a possibilidade de isenção prevista na Cláusula 12.2.",
    "d) Descumprimento grave pelo CONTRATADO: multa fixa de R$ 1.000,00 (mil reais) por ocorrência, sem prejuízo de indenização suplementar caso haja danos materiais comprovados.",
  ].join("\n"),
  durationMonths: 12,
  noticePeriodDays: 30,
  sale: "Não há exclusividade na venda. As reservas confirmadas deverão ser respeitadas, observadas as condições de cancelamento e eventual isenção de penalidades previstas na Cláusula 12.2.",
} as const;

const units = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const tens = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
export function smallNumberWords(n: number): string {
  if (n < 20) return units[n] ?? String(n);
  if (n >= 100) return String(n);
  return `${tens[Math.floor(n / 10)]}${n % 10 ? ` e ${units[n % 10]}` : ""}`;
}
export const durationText = (months: number) => `${months} (${smallNumberWords(months)}) meses, com renovação automática por igual período.`;
export const noticeText = (days: number) => `Aviso prévio de ${days} (${smallNumberWords(days)}) dias, respeitando integralmente as reservas confirmadas.`;
export const maintenanceText = (brl: string) => `Autorização automática ao CONTRATADO para intervenções até ${brl} sem necessidade de prévio aviso (situações emergenciais).\nAcima deste valor, exige autorização do CONTRATANTE.`;
