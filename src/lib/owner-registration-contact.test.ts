import { describe, expect, it } from "vitest";
import { reconcileRegistrationContact } from "./owner-registration-contact";
import type { OwnerOnboardingSubmissionInput } from "../types/owner-onboarding";

const contact = {
  fullName: "Nome já registrado", document: "", email: "", phone: "(54) 99999-9999",
  people: [{ role: "proprietario", personType: "pf", fullName: "", document: "", email: "", phone: "" }],
} as OwnerOnboardingSubmissionInput;

describe("contato autorizado do cadastro", () => {
  it("recupera nome e telefone no participante principal", () => {
    const result = reconcileRegistrationContact(contact);
    expect(result.people[0]?.fullName).toBe(contact.fullName);
    expect(result.people[0]?.phone).toBe(contact.phone);
  });
  it("preserva nome preenchido e demais participantes", () => {
    const person = { ...contact.people[0], role: "proprietario" as const, personType: "pf" as const, fullName: "Nome confirmado", document: "", email: "", phone: "" };
    const extra = { ...person, role: "coproprietario" as const };
    const result = reconcileRegistrationContact({ ...contact, people: [person, extra] });
    expect(result.fullName).toBe("Nome confirmado");
    expect(result.people[1]).toEqual(extra);
  });
  it("recupera contato do principal sem apagar contato já preenchido", () => {
    const person = { ...contact.people[0], role: "proprietario" as const, personType: "pf" as const, fullName: "Pessoa", document: "", email: "pessoa@example.test", phone: "(54) 98888-8888" };
    expect(reconcileRegistrationContact({ ...contact, email: "", phone: "", people: [person] }).phone).toBe(person.phone);
    expect(reconcileRegistrationContact({ ...contact, people: [person] }).phone).toBe(contact.phone);
  });
});