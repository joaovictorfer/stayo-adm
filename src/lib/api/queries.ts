/**
 * Query options do Stayo Admin.
 *
 * Toda leitura de dados de negócio passa pelo CoreApiClient — nenhuma tela
 * chama `fetch` nem monta objeto na mão. Nesta fase o client é o mock
 * (`createMockCoreApiClient()`), então as listas vêm vazias por contrato.
 */

import { queryOptions } from "@tanstack/react-query";

import { createDefaultAdminApiClient, type AdminApiClient } from "./admin-client";
import { createMockCoreApiClient, type CoreApiClient } from "./core-client";
import {
  checklistTemplatesStore,
  ownerNotesStore,
  proposalShareStore,
  proposalsStore,
} from "./local-store";
import type { EntityId } from "../../types/core";
import type { SupplyModule } from "../../types/implementation-supply";

/** Fonte única de dados desta fase. */
export const coreApi: CoreApiClient = createMockCoreApiClient();

/** Domínio próprio do Admin (Grupo A) — ver docs/OWNER_IMPLEMENTATION_AUDIT.md. */
export const adminApi: AdminApiClient = createDefaultAdminApiClient();

export const auditLogQuery = (params?: { entityType?: string; entityId?: string }) =>
  queryOptions({
    queryKey: ["audit-logs", params ?? null],
    queryFn: () => adminApi.audit.list(params),
  });

export const commercialTermDefaultsQuery = () =>
  queryOptions({
    queryKey: ["commercial-term-defaults"],
    queryFn: () => adminApi.commercialTermDefaults.list(),
  });

export const commercialTermsQuery = (implementationId: EntityId) =>
  queryOptions({
    queryKey: ["commercial-terms", implementationId],
    queryFn: () => adminApi.commercialTerms.listByImplementation(implementationId),
  });

export const outboxQuery = (implementationId: EntityId) =>
  queryOptions({
    queryKey: ["outbox", implementationId],
    queryFn: () => adminApi.outbox.listByImplementation(implementationId),
  });

export const initialChargesQuery = (implementationId: EntityId) =>
  queryOptions({
    queryKey: ["initial-charges", implementationId],
    queryFn: () => adminApi.initialCharges.listByImplementation(implementationId),
  });

export const ownerTasksQuery = (ownerId: EntityId) =>
  queryOptions({
    queryKey: ["owner-tasks", ownerId],
    queryFn: () => adminApi.ownerTasks.listByOwner(ownerId),
  });

export const implementationOwnersQuery = (implementationId: EntityId) =>
  queryOptions({
    queryKey: ["implementation-owners", implementationId],
    queryFn: () => adminApi.implementationOwners.listByImplementation(implementationId),
  });

export const fieldConfirmationsQuery = (implementationId: EntityId) =>
  queryOptions({
    queryKey: ["field-confirmations", implementationId],
    queryFn: () => adminApi.fieldConfirmations.listByImplementation(implementationId),
  });

export const implementationPropertyDetailsQuery = (implementationId: EntityId) =>
  queryOptions({
    queryKey: ["implementation-property-details", implementationId],
    queryFn: () => adminApi.propertyDetails.get(implementationId),
  });

export const implementationRoomsQuery = (implementationId: EntityId) =>
  queryOptions({
    queryKey: ["implementation-rooms", implementationId],
    queryFn: () => adminApi.rooms.listByImplementation(implementationId),
  });

export const propertiesListQuery = () =>
  queryOptions({
    queryKey: ["properties", "list"],
    queryFn: () => coreApi.properties.list(),
  });

export const propertyQuery = (id: EntityId) =>
  queryOptions({
    queryKey: ["properties", "detail", id],
    queryFn: () => coreApi.properties.get(id),
  });

export const condominiumsListQuery = () =>
  queryOptions({
    queryKey: ["condominiums", "list"],
    queryFn: () => coreApi.condominiums.list(),
  });

export const condominiumQuery = (id: EntityId) =>
  queryOptions({
    queryKey: ["condominiums", "detail", id],
    queryFn: () => coreApi.condominiums.get(id),
  });

export const reservationsListQuery = () =>
  queryOptions({
    queryKey: ["reservations", "list"],
    queryFn: () => coreApi.reservations.list(),
  });

export const reservationQuery = (id: EntityId) =>
  queryOptions({
    queryKey: ["reservations", "detail", id],
    queryFn: () => coreApi.reservations.get(id),
  });

export const guestsListQuery = () =>
  queryOptions({
    queryKey: ["guests", "list"],
    queryFn: () => coreApi.guests.list(),
  });

export const guestQuery = (id: EntityId) =>
  queryOptions({
    queryKey: ["guests", "detail", id],
    queryFn: () => coreApi.guests.get(id),
  });

export const implementationsListQuery = () =>
  queryOptions({
    queryKey: ["implementations", "list"],
    queryFn: () => coreApi.implementations.list(),
  });

export const implementationQuery = (id: EntityId) =>
  queryOptions({
    queryKey: ["implementations", "detail", id],
    queryFn: () => coreApi.implementations.get(id),
  });

export const implementationItemsQuery = (id: EntityId) =>
  queryOptions({
    queryKey: ["implementations", "items", id],
    queryFn: () => coreApi.implementations.items(id),
  });

/**
 * Templates de checklist e versões de proposta ainda não existem no Core;
 * vêm do repositório local temporário (`local-store.ts`).
 */
export const checklistTemplatesQuery = () =>
  queryOptions({
    queryKey: ["checklist-templates", "list"],
    queryFn: () => checklistTemplatesStore.list(),
  });

export const proposalsAllQuery = () =>
  queryOptions({
    queryKey: ["proposals", "all"],
    queryFn: () => proposalsStore.listAll(),
  });

export const proposalsByImplementationQuery = (id: EntityId) =>
  queryOptions({
    queryKey: ["proposals", "implementation", id],
    queryFn: () => proposalsStore.list(id),
  });

export const proposalByIdQuery = (proposalId: EntityId) =>
  queryOptions({
    queryKey: ["proposals", "detail", proposalId],
    queryFn: () => proposalsStore.get(proposalId),
  });

export const ownerOnboardingLinkQuery = (implementationId: EntityId) =>
  queryOptions({
    queryKey: ["owner-onboarding", "link", implementationId],
    queryFn: () => adminApi.ownerOnboarding.getLink(implementationId),
  });

export const ownerOnboardingSubmissionQuery = (implementationId: EntityId) =>
  queryOptions({
    queryKey: ["owner-onboarding", "submission", implementationId],
    queryFn: () => adminApi.ownerOnboarding.getSubmission(implementationId),
  });

export const ownerOnboardingLinkByTokenQuery = (token: string) =>
  queryOptions({
    queryKey: ["owner-onboarding", "by-token", token],
    queryFn: () => adminApi.ownerOnboarding.findByToken(token),
  });

export const proposalShareLinkQuery = (proposalId: EntityId) =>
  queryOptions({
    queryKey: ["proposal-share", "link", proposalId],
    queryFn: () => proposalShareStore.getLinkForProposal(proposalId),
  });

export const ownerNoteQuery = (ownerId: EntityId) =>
  queryOptions({
    queryKey: ["owner-notes", ownerId],
    queryFn: () => ownerNotesStore.get(ownerId),
  });

export const proposalShareLinkByTokenQuery = (token: string) =>
  queryOptions({
    queryKey: ["proposal-share", "by-token", token],
    queryFn: () => proposalShareStore.findByToken(token),
  });

/**
 * Proprietário como relacionamento comercial (Grupo A, `adminApi.owners`) —
 * não confundir com `coreApi.owners` (Owner oficial do Core, Grupo B,
 * populado só após a conversão — ver docs/OWNER_IMPLEMENTATION_AUDIT.md).
 */
export const ownersListQuery = (params?: { q?: string }) =>
  queryOptions({
    queryKey: ["owners", "list", params ?? null],
    queryFn: () => adminApi.owners.list(params),
  });

export const ownerQuery = (id: EntityId) =>
  queryOptions({
    queryKey: ["owners", "detail", id],
    queryFn: () => adminApi.owners.get(id),
  });

export const inspectionsListQuery = () =>
  queryOptions({
    queryKey: ["inspections", "list"],
    queryFn: () => coreApi.inspections.list(),
  });

export const inspectionQuery = (id: EntityId) =>
  queryOptions({
    queryKey: ["inspections", "detail", id],
    queryFn: () => coreApi.inspections.get(id),
  });

export const operationTasksListQuery = () =>
  queryOptions({
    queryKey: ["operations", "list"],
    queryFn: () => coreApi.operations.list(),
  });

export const operationTaskQuery = (id: EntityId) =>
  queryOptions({
    queryKey: ["operations", "detail", id],
    queryFn: () => coreApi.operations.get(id),
  });

export const conversationsListQuery = () =>
  queryOptions({
    queryKey: ["conversations", "list"],
    queryFn: () => coreApi.conversations.list(),
  });

export const conversationQuery = (id: EntityId) =>
  queryOptions({
    queryKey: ["conversations", "detail", id],
    queryFn: () => coreApi.conversations.get(id),
  });

export const conversationMessagesQuery = (id: EntityId) =>
  queryOptions({
    queryKey: ["conversations", "messages", id],
    queryFn: () => coreApi.conversations.messages(id),
  });

export const contractsListQuery = () =>
  queryOptions({
    queryKey: ["contracts", "list"],
    queryFn: () => coreApi.contracts.list(),
  });

export const contractQuery = (id: EntityId) =>
  queryOptions({
    queryKey: ["contracts", "detail", id],
    queryFn: () => coreApi.contracts.get(id),
  });

/** Área técnica Configurações → Stayo Core. */
export const coreOverviewQuery = () =>
  queryOptions({ queryKey: ["core-admin", "overview"], queryFn: () => coreApi.admin.overview() });

export const coreAppsQuery = () =>
  queryOptions({ queryKey: ["core-admin", "apps"], queryFn: () => coreApi.admin.apps() });

export const coreScopesQuery = () =>
  queryOptions({ queryKey: ["core-admin", "scopes"], queryFn: () => coreApi.admin.scopes() });

export const coreWebhooksQuery = () =>
  queryOptions({ queryKey: ["core-admin", "webhooks"], queryFn: () => coreApi.admin.webhooks() });

export const coreLogsQuery = () =>
  queryOptions({ queryKey: ["core-admin", "logs"], queryFn: () => coreApi.admin.logs() });

export const guideEntriesListQuery = () =>
  queryOptions({ queryKey: ["guide", "list"], queryFn: () => coreApi.guide.list() });

export const guideEntryQuery = (id: EntityId) =>
  queryOptions({ queryKey: ["guide", "detail", id], queryFn: () => coreApi.guide.get(id) });

export const productsListQuery = () =>
  queryOptions({ queryKey: ["products", "list"], queryFn: () => coreApi.products.list() });

export const productQuery = (id: EntityId) =>
  queryOptions({ queryKey: ["products", "detail", id], queryFn: () => coreApi.products.get(id) });

export const payoutsListQuery = () =>
  queryOptions({ queryKey: ["payouts", "list"], queryFn: () => coreApi.payouts.list() });

export const payoutQuery = (id: EntityId) =>
  queryOptions({ queryKey: ["payouts", "detail", id], queryFn: () => coreApi.payouts.get(id) });

export const serviceProvidersListQuery = () =>
  queryOptions({
    queryKey: ["service-providers", "list"],
    queryFn: () => coreApi.serviceProviders.list(),
  });

export const serviceProviderQuery = (id: EntityId) =>
  queryOptions({
    queryKey: ["service-providers", "detail", id],
    queryFn: () => coreApi.serviceProviders.get(id),
  });

export const settlementsListQuery = () =>
  queryOptions({
    queryKey: ["settlements", "list"],
    queryFn: () => coreApi.settlements.list(),
  });

export const settlementQuery = (id: EntityId) =>
  queryOptions({
    queryKey: ["settlements", "detail", id],
    queryFn: () => coreApi.settlements.get(id),
  });

export const expensesListQuery = () =>
  queryOptions({
    queryKey: ["expenses", "list"],
    queryFn: () => coreApi.expenses.list(),
  });

export const expenseQuery = (id: EntityId) =>
  queryOptions({
    queryKey: ["expenses", "detail", id],
    queryFn: () => coreApi.expenses.get(id),
  });

export const serviceInvoicesListQuery = () =>
  queryOptions({
    queryKey: ["service-invoices", "list"],
    queryFn: () => coreApi.serviceInvoices.list(),
  });

export const serviceInvoiceQuery = (id: EntityId) =>
  queryOptions({
    queryKey: ["service-invoices", "detail", id],
    queryFn: () => coreApi.serviceInvoices.get(id),
  });

/** Fase 4 — enxoval e itens faltantes da implantação. */
export const supplyItemsQuery = (implementationId: EntityId, module?: SupplyModule) =>
  queryOptions({
    queryKey: ["implementation-supplies", implementationId, module ?? "all"],
    queryFn: () => adminApi.supplies.listByImplementation(implementationId, module),
  });

export const supplyTemplatesQuery = (module?: SupplyModule) =>
  queryOptions({
    queryKey: ["supply-templates", module ?? "all"],
    queryFn: () => adminApi.supplyTemplates.list(module),
  });

export const supplyTemplateItemsQuery = (templateId: EntityId) =>
  queryOptions({
    queryKey: ["supply-templates", "items", templateId],
    queryFn: () => adminApi.supplyTemplates.items(templateId),
  });

/** Fase 5 — configuração da proposta e modelos de implantação. */
export const proposalSettingsQuery = (implementationId: EntityId) =>
  queryOptions({
    queryKey: ["proposal-settings", implementationId],
    queryFn: () => adminApi.proposalSettings.get(implementationId),
  });

export const proposalBlocksQuery = (implementationId: EntityId) =>
  queryOptions({
    queryKey: ["proposal-blocks", implementationId],
    queryFn: () => adminApi.proposalBlocks.listByImplementation(implementationId),
  });

export const implementationTemplatesQuery = () =>
  queryOptions({
    queryKey: ["implementation-templates", "list"],
    queryFn: () => adminApi.implementationTemplates.list(),
  });

/** Fase 6 — conteúdo institucional do portal do proprietário. */
export const portalContentQuery = () =>
  queryOptions({
    queryKey: ["portal-content", "list"],
    queryFn: () => adminApi.portalContent.list(),
  });
