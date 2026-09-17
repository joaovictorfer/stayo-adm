/**
 * Query options do Stayo Admin.
 *
 * Toda leitura de dados de negócio passa pelo CoreApiClient — nenhuma tela
 * chama `fetch` nem monta objeto na mão. Nesta fase o client é o mock
 * (`createMockCoreApiClient()`), então as listas vêm vazias por contrato.
 */

import { queryOptions } from "@tanstack/react-query";

import { createMockCoreApiClient, type CoreApiClient } from "./core-client";
import { checklistTemplatesStore, proposalsStore } from "./local-store";
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
