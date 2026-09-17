/**
 * Query options do Stayo Admin.
 *
 * Toda leitura de dados de negócio passa pelo CoreApiClient — nenhuma tela
 * chama `fetch` nem monta objeto na mão. Nesta fase o client é o mock
 * (`createMockCoreApiClient()`), então as listas vêm vazias por contrato.
 */

import { queryOptions } from "@tanstack/react-query";

import { createMockCoreApiClient, type CoreApiClient } from "./core-client";
import {
  checklistTemplatesStore,
  ownerOnboardingStore,
  proposalShareStore,
  proposalsStore,
} from "./local-store";
import type { EntityId } from "../../types/core";

/** Fonte única de dados desta fase. */
export const coreApi: CoreApiClient = createMockCoreApiClient();

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

export const ownerOnboardingLinkQuery = (implementationId: EntityId) =>
  queryOptions({
    queryKey: ["owner-onboarding", "link", implementationId],
    queryFn: () => ownerOnboardingStore.getLink(implementationId),
  });

export const ownerOnboardingSubmissionQuery = (implementationId: EntityId) =>
  queryOptions({
    queryKey: ["owner-onboarding", "submission", implementationId],
    queryFn: () => ownerOnboardingStore.getSubmission(implementationId),
  });

export const ownerOnboardingLinkByTokenQuery = (token: string) =>
  queryOptions({
    queryKey: ["owner-onboarding", "by-token", token],
    queryFn: () => ownerOnboardingStore.findByToken(token),
  });

export const proposalShareLinkQuery = (implementationId: EntityId) =>
  queryOptions({
    queryKey: ["proposal-share", "link", implementationId],
    queryFn: () => proposalShareStore.getLink(implementationId),
  });

export const proposalShareLinkByTokenQuery = (token: string) =>
  queryOptions({
    queryKey: ["proposal-share", "by-token", token],
    queryFn: () => proposalShareStore.findByToken(token),
  });

export const ownersListQuery = () =>
  queryOptions({
    queryKey: ["owners", "list"],
    queryFn: () => coreApi.owners.list(),
  });

export const ownerQuery = (id: EntityId) =>
  queryOptions({
    queryKey: ["owners", "detail", id],
    queryFn: () => coreApi.owners.get(id),
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
