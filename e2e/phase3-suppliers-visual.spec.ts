import { mkdirSync } from "node:fs";
import { expect, test, type Page, type Route } from "@playwright/test";

const fakeSupabase = "http://127.0.0.1:59999";
const implementationId = "phase3-visual";

const catalog = [
  {
    id: "catalog-on",
    name: "ON Instaladora",
    specialties: ["ar_condicionado", "gas"],
    status: "approved",
  },
  {
    id: "catalog-casa-x",
    name: "Casa X",
    specialties: ["moveis_marcenaria"],
    status: "approved",
  },
];

const initialEntries = [
  {
    id: "entry-ar",
    implementation_id: implementationId,
    category_key: "ar_condicionado",
    answer: "catalog",
    catalog_id: "catalog-on",
    other_name: null,
    role: "forneceu_instalou",
    phone: "54999990000",
    service: "Instalação completa",
    approx_date: "2025",
    notes: "Equipamento da sala",
    admin_notes: null,
    source: "admin",
    reviewed_at: "2026-09-26T12:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "entry-hidraulica",
    implementation_id: implementationId,
    category_key: "hidraulica",
    answer: "unknown",
    catalog_id: null,
    other_name: null,
    role: null,
    phone: null,
    service: null,
    approx_date: null,
    notes: null,
    admin_notes: null,
    source: "owner",
    reviewed_at: null,
    deleted_at: null,
  },
  {
    id: "entry-eletrica",
    implementation_id: implementationId,
    category_key: "eletrica",
    answer: "not_applicable",
    catalog_id: null,
    other_name: null,
    role: null,
    phone: null,
    service: null,
    approx_date: null,
    notes: null,
    admin_notes: null,
    source: "admin",
    reviewed_at: "2026-09-26T12:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "entry-moveis",
    implementation_id: implementationId,
    category_key: "moveis_marcenaria",
    answer: "other",
    catalog_id: null,
    other_name: "Casa X",
    role: "forneceu",
    phone: null,
    service: "Marcenaria planejada",
    approx_date: "2024",
    notes: null,
    admin_notes: null,
    source: "admin",
    reviewed_at: "2026-09-26T12:00:00.000Z",
    deleted_at: null,
  },
];

async function mockSupabase(page: Page) {
  const customCategories: Array<{ key: string; label: string }> = [];

  await page.route(`${fakeSupabase}/**`, async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname === "/rest/v1/property_supplier_entries") {
      if (method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(initialEntries),
        });
        return;
      }
      await route.fulfill({
        status: method === "POST" ? 201 : 200,
        contentType: "application/json",
        body: "[]",
      });
      return;
    }

    if (url.pathname === "/rest/v1/property_supplier_categories") {
      if (method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(customCategories),
        });
        return;
      }
      if (method === "POST") {
        const payload = request.postDataJSON() as
          | { key: string; label: string }
          | Array<{ key: string; label: string }>;
        const next = Array.isArray(payload) ? payload[0] : payload;
        if (next && !customCategories.some((category) => category.key === next.key)) {
          customCategories.push({ key: next.key, label: next.label });
        }
        await route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      return;
    }

    if (url.pathname === "/rest/v1/supplier_catalog") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(catalog),
      });
      return;
    }

    if (url.pathname === "/auth/v1/user") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "00000000-0000-4000-8000-000000000003",
          aud: "authenticated",
          role: "authenticated",
          email: "phase3@stayo.test",
          app_metadata: {},
          user_metadata: {},
          created_at: "2026-09-26T12:00:00.000Z",
        }),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
}

async function backToSuppliers(page: Page) {
  await page.getByRole("button", { name: "Voltar para fornecedores" }).click();
  await expect(page.locator('[data-supplier-view="list"]')).toBeVisible();
}

test("fornecedores usa lista compacta e detalhe sob demanda em 390px", async ({ page }) => {
  mkdirSync("artifacts/phase3-suppliers", { recursive: true });
  await mockSupabase(page);
  await page.goto("/phase3-preview.html");

  const list = page.locator('[data-supplier-view="list"]');
  await expect(list).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Ar-condicionado e climatização: Definido/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Hidráulica: A confirmar/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Elétrica: Não se aplica/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Gás: Não informado/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Buscar empresa" })).toHaveCount(0);

  const geometry = await page.evaluate(() => ({
    viewport: window.innerWidth,
    width: document.documentElement.scrollWidth,
    height:
      document.querySelector('[data-supplier-view="list"]')?.getBoundingClientRect().height ?? 0,
  }));
  expect(geometry.viewport).toBe(390);
  expect(geometry.width).toBeLessThanOrEqual(390);
  expect(geometry.height).toBeLessThan(760);

  await page.screenshot({
    path: "artifacts/phase3-suppliers/suppliers-list-390.png",
    fullPage: true,
  });

  await page
    .getByRole("button", { name: /Ar-condicionado e climatização: Definido/ })
    .click();
  await expect(page.locator('[data-supplier-view="detail"]')).toBeVisible();
  await expect(page.getByText("ON Instaladora", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mais detalhes (opcional)" }).click();
  await expect(page.getByLabel("Telefone")).toHaveValue("54999990000");
  await page.getByLabel("Telefone").fill("54988887777");
  await backToSuppliers(page);

  await page.getByRole("button", { name: /Gás: Não informado/ }).click();
  await expect(page.getByRole("button", { name: "Buscar empresa" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Outra empresa", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Não sei informar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Não se aplica" })).toBeVisible();
  await page.getByRole("button", { name: "Buscar empresa" }).click();
  await page.getByLabel("Buscar empresa").fill("ON");
  await expect(page.getByRole("button", { name: /ON Instaladora/ })).toBeVisible();
  await page.getByRole("button", { name: /ON Instaladora/ }).click();
  await expect(page.getByText("ON Instaladora", { exact: true })).toBeVisible();
  await backToSuppliers(page);

  await page.getByRole("button", { name: /Aquecimento \/ boiler: Não informado/ }).click();
  await page.getByRole("button", { name: "Outra empresa", exact: true }).click();
  await page.getByLabel("Nome da empresa ou profissional").fill("Boiler Serra");
  await expect(page.getByDisplayValue("Boiler Serra")).toBeVisible();
  await backToSuppliers(page);

  await page.getByRole("button", { name: /Hidráulica: A confirmar/ }).click();
  await expect(page.getByText("Não sei informar", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Alterar" }).click();
  await page.getByRole("button", { name: "Não sei informar" }).click();
  await expect(page.getByText("Não sei informar", { exact: true })).toBeVisible();
  await backToSuppliers(page);

  await page.getByRole("button", { name: /Elétrica: Não se aplica/ }).click();
  await expect(page.getByText("Não se aplica", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Alterar" }).click();
  await page.getByRole("button", { name: "Não se aplica" }).click();
  await expect(page.getByText("Não se aplica", { exact: true })).toBeVisible();
  await backToSuppliers(page);

  await page.getByRole("button", { name: /Adicionar categoria/ }).click();
  await page.getByLabel("Nome da categoria").fill("Portão eletrônico");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Portão eletrônico: Não informado/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Portão eletrônico: Não informado/ }).click();
  await expect(page.getByRole("button", { name: "Buscar empresa" })).toBeVisible();

  await page.screenshot({
    path: "artifacts/phase3-suppliers/suppliers-detail-390.png",
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
