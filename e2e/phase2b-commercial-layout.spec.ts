import { expect, test } from "@playwright/test";

const viewports = [
  { name: "mobile-375", width: 375, height: 812 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "desktop-1280", width: 1280, height: 900 },
] as const;

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflow).toBe(false);
}

for (const viewport of viewports) {
  test(`Fase 2B mantém listagem e detalhe responsivos em ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    // TanStack Start entrega HTML via SSR. Esperar networkidle evita clicar em
    // controles visíveis antes de o React terminar a hidratação no cliente.
    await page.goto("/implantacao", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "Implantações" })).toBeVisible();
    const newOpportunity = page.getByRole("button", { name: "Nova oportunidade" });
    await expect(newOpportunity).toBeVisible();

    // Regressão da Fase 1: os três dados leves continuam suficientes para
    // habilitar a criação, sem condomínio, unidade, CPF ou Property operacional.
    await newOpportunity.click();
    const opportunityDialog = page.getByRole("dialog");
    await expect(opportunityDialog).toBeVisible();
    await expect(opportunityDialog.getByText("Nova oportunidade")).toBeVisible();
    await opportunityDialog.getByPlaceholder("Ex.: Ana Martins").fill("Contato Fase 1");
    await opportunityDialog.getByPlaceholder("(54) 99999-9999").fill("(54) 99999-9999");
    await opportunityDialog
      .getByPlaceholder("Ex.: Apartamento da Ana · oportunidade setembro")
      .fill("Oportunidade leve preservada");
    await expect(
      opportunityDialog.getByRole("button", { name: "Criar oportunidade" }),
    ).toBeEnabled();
    await expect(
      opportunityDialog.getByText(
        /Condomínio, unidade, documentos e dados do imóvel ficam para depois/i,
      ),
    ).toBeVisible();
    await opportunityDialog.getByRole("button", { name: "Cancelar" }).click();

    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: `test-results/phase2b-${viewport.name}-list.png`,
      fullPage: true,
    });

    const firstRow = page.locator("a.admin-data-row").first();
    if ((await firstRow.count()) === 0) return;
    const href = await firstRow.getAttribute("href");
    expect(href).toMatch(/^\/implantacao\//);
    await page.goto(href!, { waitUntil: "networkidle" });

    await expect(
      page
        .getByText(/Reunião e próxima ação|Agenda comercial indisponível|Acesso não autorizado/)
        .first(),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      path: `test-results/phase2b-${viewport.name}-detail.png`,
      fullPage: true,
    });
  });
}
