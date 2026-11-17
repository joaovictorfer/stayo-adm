/** Textos padrão do Quadro Resumo, copiados literalmente da minuta oficial VENETO_A201-2 (17/11/2026). */
export const STANDARD_CLAUSES = {
  cleaning: "Pertence integralmente ao CONTRATADO.",
  payoutAuto: "Automáticos pela plataforma, quando disponíveis;",
  payoutFallback: "Caso indisponíveis, os repasses serão efetuados até o dia 10 do mês subsequente ao check-out.",
  payout: "a) Automáticos pela plataforma, quando disponíveis;\nb) Caso indisponíveis, os repasses serão efetuados até o dia 10 do mês subsequente ao check-out.",
  ownerUse: "Permitido, solicitando 72h antes do check-in, condicionado à disponibilidade do calendário e ao pagamento da taxa de limpeza.",
  marketing: "Mediante disponibilidade, para fins de divulgação, ações promocionais e marketing solicitado previamente ao proprietário.",
  maintenanceLimit: 300,
  periodicShutdown: "A cada 4 (quatro) meses, para manutenção preventiva, inspeções técnicas e limpeza extrema, devendo ser registradas e documentadas.",
  exclusivity: "SIM — para fins de gestão operacional e comercial.",
  fines: [
    "a) Entrada do CONTRATANTE durante estadia de hóspede: R$ 2.000,00 (dois mil reais);",
    "b) Entrada sem aviso prévio: R$ 1.000,00 (mil reais);",
    "c) Cancelamento de reserva confirmada por culpa do CONTRATANTE: multa equivalente ao valor integral da remuneração devida ao CONTRATADO pela reserva cancelada, acrescida das penalidades eventualmente aplicadas pela plataforma de hospedagem;",
    "d) Descumprimento grave pelo CONTRATADO: multa fixa de R$ 1.000,00 (mil reais) por ocorrência, sem prejuízo de indenização suplementar caso haja danos materiais comprovados.",
  ].join("\n"),
  durationMonths: 12,
  noticePeriodDays: 30,
  sale: "Não há exclusividade na venda. Em caso de alienação, o CONTRATANTE deverá cumprir ou assumir o custo integral das reservas já confirmadas.",
  implementationFee: 500,
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
export const implementationText = (brl: string, words: string) => `Será cobrado o valor de ${brl} (${words}) à título de implantação que corresponde a fotografias, criação de anuncio, cadastros, acompanhamento e assessoria inicial, sendo cobrado limpeza adicional caso necessário.`;
export const pixLine = (pix: string) => `Chave pix: ${pix.trim() || "[A DEFINIR]"}`;
