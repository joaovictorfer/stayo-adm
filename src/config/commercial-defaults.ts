export type CleaningResponsibility = "stayo" | "owner" | "custom";

export interface QuickImplementationConditions {
  administrationFee: string;
  cleaningResponsibility: CleaningResponsibility;
  customCleaningResponsibility: string;
  payoutRule: string;
  maintenanceLimit: string;
  exclusivity: boolean;
  durationMonths: string;
  noticePeriodDays: string;
}

export interface QuickCommercialConfirmationDefaults {
  administrationFee: number;
  turnoverCleaningFee: number;
  exclusivity: boolean;
  durationMonths: number;
  noticePeriodDays: number;
}

/**
 * Fallback único do padrão STAYO. Quando `commercial_term_defaults` tiver
 * valores reconhecíveis de administração/limpeza, eles têm precedência.
 * A tela copia o resultado para `implementation_contract_conditions` uma
 * única vez; portanto uma mudança futura aqui ou na configuração não altera
 * implantações já iniciadas.
 */
export const DEFAULT_QUICK_COMMERCIAL_CONFIRMATION: QuickCommercialConfirmationDefaults =
  {
    administrationFee: 20,
    turnoverCleaningFee: 250,
    exclusivity: true,
    durationMonths: 12,
    noticePeriodDays: 30,
  };

type ConfigurableCommercialDefault = {
  label: string;
  chargeType: string;
  value: number;
};

const normalizedLabel = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

/** Resolve os dois valores monetários configuráveis sem acoplar a UI a IDs. */
export function resolveQuickCommercialConfirmationDefaults(
  configured: readonly ConfigurableCommercialDefault[],
): QuickCommercialConfirmationDefaults {
  const administration = configured.find(
    (item) =>
      item.chargeType === "percentage" &&
      normalizedLabel(item.label).includes("administr"),
  );
  const cleaning = configured.find((item) => {
    const label = normalizedLabel(item.label);
    return (
      label.includes("limpeza") &&
      (label.includes("comercial") || label.includes("reserva"))
    );
  });

  return {
    ...DEFAULT_QUICK_COMMERCIAL_CONFIRMATION,
    ...(administration && Number.isFinite(Number(administration.value))
      ? { administrationFee: Number(administration.value) }
      : {}),
    ...(cleaning && Number.isFinite(Number(cleaning.value))
      ? { turnoverCleaningFee: Number(cleaning.value) }
      : {}),
  };
}

/**
 * Padrões operacionais usados no cadastro rápido. A implantação recebe um
 * snapshot editável; alterações posteriores não mudam cadastros existentes.
 */
export const DEFAULT_QUICK_IMPLEMENTATION_CONDITIONS: QuickImplementationConditions =
  {
    administrationFee: String(
      DEFAULT_QUICK_COMMERCIAL_CONFIRMATION.administrationFee,
    ),
    cleaningResponsibility: "custom",
    customCleaningResponsibility: `R$ ${DEFAULT_QUICK_COMMERCIAL_CONFIRMATION.turnoverCleaningFee
      .toFixed(2)
      .replace(".", ",")}`,
    payoutRule:
      "Reservas pelo Airbnb: repasse automático pela plataforma. Reservas pelo Booking e reservas diretas: repasse até o dia 10 do mês subsequente, conforme os valores efetivamente recebidos e conciliados.",
    maintenanceLimit: "300",
    exclusivity: DEFAULT_QUICK_COMMERCIAL_CONFIRMATION.exclusivity,
    durationMonths: String(
      DEFAULT_QUICK_COMMERCIAL_CONFIRMATION.durationMonths,
    ),
    noticePeriodDays: String(
      DEFAULT_QUICK_COMMERCIAL_CONFIRMATION.noticePeriodDays,
    ),
  };

export const CLEANING_RESPONSIBILITY_LABELS: Record<
  CleaningResponsibility,
  string
> = {
  stayo: "Stayo",
  owner: "Proprietário",
  custom: "Personalizada",
};

export function cleaningResponsibilityText(
  conditions: QuickImplementationConditions,
): string {
  if (conditions.cleaningResponsibility === "custom") {
    return conditions.customCleaningResponsibility.trim() || "Personalizada";
  }
  return CLEANING_RESPONSIBILITY_LABELS[conditions.cleaningResponsibility];
}
