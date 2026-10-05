import type { OwnerOnboardingSubmissionInput } from "../types/owner-onboarding";

/** Reconcile only fields already authorized by the invitation resolver. */
export function reconcileRegistrationContact<T extends OwnerOnboardingSubmissionInput>(draft: T): T {
  const first = draft.people[0];
  if (!first) return draft;
  const fullName = first.fullName.trim() ? first.fullName : draft.fullName;
  const document = first.document.trim() ? first.document : draft.document;
  const email = draft.email.trim() ? draft.email : first.email;
  const phone = draft.phone.trim() ? draft.phone : first.phone;
  return {
    ...draft,
    fullName,
    document,
    email,
    phone,
    people: [{ ...first, fullName, document, email, phone }, ...draft.people.slice(1)],
  };
}