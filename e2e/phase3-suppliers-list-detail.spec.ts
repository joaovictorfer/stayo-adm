import { expect, test } from "@playwright/test";

const implementationId = "11111111-1111-4111-8111-111111111111";
const previewPath = "/portal/phase3-suppliers-preview";

const catalog = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "ON Instaladora",
    specialties: ["ar_condicionado", "eletrica"],
    status: "approved",
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Casa X",
    specialties: ["moveis"],
    status: "approved",
  },
];

const entries = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    implementation_id: implementationId,
    category_key: "ar_condicionado",
    answer: "catalog",
    catalog_id: catalog[0]!.id,
    other_name: null,
    role: "instalou",
    phone: "54999999999",
    service: "Instalação dos aparelhos",
    approx_date: "2025",
    notes: null,
    admin_notes: null,
    source: "admin",
    reviewed_at: "2026-09-26T12:00:00.000Z",
    deleted_at: null,
    created_at: "2026-09-26T12:00:00.000Z",
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
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
    created_at: "2026-09-26T12:00:00.000Z",
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    implementation_id: implementationId,
    category_key: "moveis",
    answer: "other",
    catalog_id: null,
    other_name: "Casa X",
    role: "forneceu_instalou",
    phone: null,
    service: "Marcenaria planejada",
    approx_date: "2024",
    notes: null,
    admin_notes: null,
    source: "admin",
    reviewed_at: "2026-09-26T12:00:00.000Z",
    deleted_at: null,
    created_at: "2026-09-26T12:00:00.000Z",
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    implementation_id: implementationId,
    category_key: "gas",
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
    created_at: "2026-09-26T12:00:00.000Z",
  },
];

async function mockSupabase(page: import("@playwright/test").Page) {
  let customCategories: Array<{ key: string; label: string }> = [
    { key: "custom_portao_eletronico", label: "Portão eletrônico" },
  ];

  await page.route("**/rest/v1/property_supplier_entries**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(entries),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.route("**/rest/v1/property_supplier_categories**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(customCategories),
      });
      return;
    }
    if (route.request().method() === "POST") {
      const raw = route.request().postDataJSON() as
        | { key?: string; label?: string }
        | Array<{ key?: string; label?: string }>;
      const payload = Array.isArray(raw) ? raw[0] : raw;
      if (payload?.key && payload.label) {
        customCategories = [...customCategories, { key: payload.key, label: payload.label }];
      }
      await route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
      return;
    }
    await route.fulfill({ status: 204, body: "" });
  });

  await page.route("**/rest/v1/supplier_catalog**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(catalog),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.route("**/auth/v1/user**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "99999999-9999-4999-8999-999999999999", email: "qa@stayo.local" }),
    });
  });
}

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1),
  ).toBe(false);
}

test("Fase 3 mostra lista compacta e detalhe sob demanda em 390px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSupabase(page);
  await page.goto(previewPath, { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Fornecedores" })).toBeVisible();
  await expect(page.getByText("ON Instaladora")).toBeVisible();
  await expect(page.getByText("Casa X")).toBeVisible();
  await expect(page.getByText("Não informado").first()).toBeVisible();
  await expect(page.getByText("A confirmar").first()).toBeVisible();
  await expect(page.getByText("Não se aplica").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Buscar empresa/i })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: "test-results/phase3-suppliers-mobile-390-list.png", fullPage: true });

  await page.locator('[data-supplier-category="eletrica"]').click();
  await expect(page.getByRole("button", { name: "Buscar empresa" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Outra empresa" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Não sei informar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Não se aplica" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: "test-results/phase3-suppliers-mobile-390-detail.png", fullPage: true });

  await page.getByRole("button", { name: "Buscar empresa" }).click();
  await expect(page.getByPlaceholder("Digite o nome da empresa")).toBeVisible();
  await expect(page.getByText("ON Instaladora")).toBeVisible();
});

test("Fase 3 preserva outra empresa, estados, categoria customizada e edição existente", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSupabase(page);
  await page.goto(previewPath, { waitUntil: "networkidle" });

  await page.locator('[data-supplier-category="ar_condicionado"]').click();
  await expect(page.getByText("ON Instaladora")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "O que a empresa fez" })).toHaveValue("instalou");
  await page.getByRole("button", { name: "Fornecedores" }).click();

  await page.locator('[data-supplier-category="eletrica"]').click();
  await page.getByRole("button", { name: "Outra empresa" }).click();
  await expect(page.getByLabel("Nome da empresa ou profissional")).toBeVisible();
  await page.getByRole("button", { name: "Fornecedores" }).click();

  await page.reload({ waitUntil: "networkidle" });
  await page.locator('[data-supplier-category="eletrica"]').click();
  await page.getByRole("button", { name: "Não sei informar" }).click();
  await expect(page.getByText("Não sei informar", { exact: true }).first()).toBeVisible();

  await page.reload({ waitUntil: "networkidle" });
  await page.locator('[data-supplier-category="eletrica"]').click();
  await page.getByRole("button", { name: "Não se aplica" }).click();
  await expect(page.getByText("Não se aplica", { exact: true }).first()).toBeVisible();

  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Adicionar categoria/i }).click();
  await page.getByLabel("Nome da categoria").fill("Automação residencial");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(page.getByText("Automação residencial")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
