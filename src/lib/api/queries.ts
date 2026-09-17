/**
 * Query options do Stayo Admin.
 *
 * Toda leitura de dados de negócio passa pelo CoreApiClient — nenhuma tela
 * chama `fetch` nem monta objeto na mão. Nesta fase o client é o mock
 * (`createMockCoreApiClient()`), então as listas vêm vazias por contrato.
 */

import { queryOptions } from "@tanstack/react-query";

import { createMockCoreApiClient, type CoreApiClient } from "./core-client";
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
