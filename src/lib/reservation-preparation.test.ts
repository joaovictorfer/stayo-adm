import { expect, it } from "vitest";
import { preparationItems, preparationState } from "./reservation-preparation";
it("preparação exige os cinco itens escolhidos", () => {
  const rows = preparationItems.map((i) => ({ reservation_id: "a", item: i.key, checked: true }));
  expect(preparationState(rows, "a").ready).toBe(true);
  expect(preparationState(rows.slice(0, 4), "a").ready).toBe(false);
  expect(preparationState(rows, "a").count).toBe(5);
});
it("cada reserva tem seu próprio checklist", () => {
  expect(preparationState([{ reservation_id: "a", item: "kit", checked: true }], "b").count).toBe(0);
  expect(preparationState([{ reservation_id: "a", item: "kit", checked: false }], "a").count).toBe(0);
});