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

/**
 * Padrões operacionais usados no cadastro rápido. A implantação recebe um
 * snapshot editável; alterações posteriores não mudam cadastros existentes.
 */
export const DEFAULT_QUICK_IMPLEMENTATION_CONDITIONS: QuickImplementationConditions = {
  administrationFee: "20",
  cleaningResponsibility: "stayo",
  customCleaningResponsibility: "",
  payoutRule: "Repasse mensal no dia 10",
  maintenanceLimit: "200",
  exclusivity: true,
  durationMonths: "12",
  noticePeriodDays: "60",
};

export const CLEANING_RESPONSIBILITY_LABELS: Record<CleaningResponsibility, string> = {
  stayo: "Stayo",
  owner: "Proprietário",
  custom: "Personalizada",
};

export function cleaningResponsibilityText(conditions: QuickImplementationConditions): string {
  if (conditions.cleaningResponsibility === "custom") {
    return conditions.customCleaningResponsibility.trim() || "Personalizada";
  }
  return CLEANING_RESPONSIBILITY_LABELS[conditions.cleaningResponsibility];
}