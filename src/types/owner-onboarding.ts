import type { EntityId } from "./core";

export interface OwnerOnboardingLink {
  id: EntityId;
  implementationId: EntityId;
  ownerId: EntityId | null;
  tokenHash: string;
  createdAt: string;
  createdBy: string | null;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  lastAccessAt: string | null;
}

export type OwnerOnboardingLinkStatus = "ativo" | "expirado" | "revogado" | "usado";

export function ownerOnboardingLinkStatus(
  link: Pick<OwnerOnboardingLink, "expiresAt" | "usedAt" | "revokedAt">,
  now: Date = new Date(),
): OwnerOnboardingLinkStatus {
  if (link.revokedAt) return "revogado";
  if (link.usedAt) return "usado";
  if (new Date(link.expiresAt) < now) return "expirado";
  return "ativo";
}

export type OwnerPersonType = "pf" | "pj";
export type OwnerPixType = "cpf" | "cnpj" | "phone" | "email" | "random";
export type OwnerPersonRole = "proprietario" | "coproprietario" | "proponente";

export interface OwnerOnboardingPerson {
  role: OwnerPersonRole;
  personType: OwnerPersonType;
  fullName: string;
  document: string;
  email: string;
  phone: string;
  /** Estado civil (pessoa física). Nullable para dados antigos. */
  maritalStatus?: string | null;
  /** Profissão (pessoa física). Nullable para dados antigos. */
  profession?: string | null;
}

export interface OwnerOnboardingSubmission {
  implementationId: EntityId;
  personType: OwnerPersonType;
  fullName: string;
  document: string;
  email: string;
  phone: string;
  postalCode: string;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
  bankName: string;
  bankBranch: string;
  accountNumber: string;
  accountType: "checking" | "savings" | "payment";
  accountHolder: string;
  holderTaxId: string;
  pixType: OwnerPixType;
  pixKey: string;
  isPrimary: boolean;
  people: OwnerOnboardingPerson[];
  currentStep: number;
  submittedAt: string | null;
  propertyPostalCode: string;
  propertyStreet: string;
  propertyNumber: string;
  propertyComplement: string | null;
  propertyDistrict: string;
  propertyCity: string;
  propertyState: string;
  propertyType: string;
  propertyBedrooms: number | null;
  propertySuites: number | null;
  propertyBathrooms: number | null;
  propertyParkingSpots: number | null;
  propertyAccessType: "key" | "lock" | "concierge" | "other" | null;
  propertyAccessNotes: string;
  propertyAccessCode: string;
  propertyWifiNetwork: string;
  propertyWifiPassword: string;
}

export type OwnerOnboardingSubmissionInput = Omit<
  OwnerOnboardingSubmission,
  "implementationId" | "submittedAt" | "currentStep"
>;

export type OwnerRegistrationState = "complete" | "incomplete" | "review";
export interface OwnerRegistrationGroup {
  id: "identity" | "contact" | "address" | "payout" | "contract" | "documents";
  label: string;
  state: OwnerRegistrationState;
}

export function computeOwnerRegistration(input: {
  submission?: OwnerOnboardingSubmission | null;
  hasContract?: boolean;
  documentCount?: number;
  hasDivergences?: boolean;
}): { groups: OwnerRegistrationGroup[]; percentage: number; nextAction: string | null } {
  const submission = input.submission;
  const submitted = Boolean(submission?.submittedAt);
  const groups: OwnerRegistrationGroup[] = [
    {
      id: "identity",
      label: "Identificação",
      state:
        submission?.fullName && submission.document
          ? input.hasDivergences
            ? "review"
            : "complete"
          : "incomplete",
    },
    {
      id: "contact",
      label: "Contato",
      state:
        submission?.email && submission.phone
          ? input.hasDivergences
            ? "review"
            : "complete"
          : "incomplete",
    },
    {
      id: "address",
      label: "Endereço",
      state:
        submission?.postalCode &&
        submission.street &&
        submission.number &&
        submission.district &&
        submission.city &&
        submission.state
          ? submitted
            ? "complete"
            : "review"
          : "incomplete",
    },
    {
      id: "payout",
      label: "Dados para repasse",
      state:
        submission?.bankName &&
        submission.accountHolder &&
        submission.holderTaxId &&
        submission.pixType &&
        submission.pixKey
          ? submitted
            ? "complete"
            : "review"
          : "incomplete",
    },
    { id: "contract", label: "Contrato", state: input.hasContract ? "complete" : "incomplete" },
    {
      id: "documents",
      label: "Documentos",
      state: (input.documentCount ?? 0) > 0 ? "complete" : "incomplete",
    },
  ];
  const complete = groups.filter((group) => group.state === "complete").length;
  const review = groups.filter((group) => group.state === "review").length;
  const firstPending = groups.find((group) => group.state !== "complete");
  return {
    groups,
    percentage: Math.round(((complete + review * 0.5) / groups.length) * 100),
    nextAction: firstPending
      ? `${firstPending.state === "review" ? "revisar" : "completar"} ${firstPending.label.toLocaleLowerCase("pt-BR")}`
      : null,
  };
}
