import { expect, test, type BrowserContext } from "@playwright/test";

const rpcPattern = "**/supabase/rest/v1/rpc/proposal_public_resolve_by_token";
const validToken = "presentation-valid-00000000-0000-0000-0000-000000000001";

const snapshot = {
  schemaVersion: 1,
  proposalId: "10000000-0000-0000-0000-000000000001",
  implementationId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  version: 3,
  opportunity: {
    code: "IMP-002D3",
    title: "Apartamento Jardim Europa",
  },
  items: [
    {
      description: "Gestão completa da locação",
      quantity: 1,
      unitValue: 350,
      discount: 0,
      total: 350,
    },
    {
      description: "Implantação inicial",
      quantity: 1,
      unitValue: 500,
      discount: 50,
      total: 450,
    },
  ],
  total: 800,
  commercialTerms: [
    {
      label: "Taxa de gestão",
      chargeType: "percentage",
      value: 20,
      optional: false,
      displayOrder: 1,
      notes: "Aplicada sobre a receita de hospedagem.",
    },
    {
      label: "Fotografia profissional",
      chargeType: "fixed_once",
      value: 450,
      optional: true,
      displayOrder: 2,
      notes: null,
    },
  ],
  contractConditions: {
    administrationFee: 20,
    cleaningResponsibility: "Stayo coordena a operação",
    payoutRule: "Repasse mensal conforme fechamento",
    maintenanceLimit: 300,
    exclusivity: true,
    durationMonths: 12,
    noticePeriodDays: 30,
  },
  responsibilities: [
    "A Stayo organiza a publicação e a operação dos anúncios.",
    "O proprietário mantém os dados cadastrais atualizados pelos canais apropriados.",
  ],
  content: [
    {
      title: "Próximos passos",
      body: "Depois da proposta, a equipe Stayo orientará separadamente as próximas etapas.",
      displayOrder: 1,
    },
  ],
  requiredSignatories: [{ label: "Proprietário", role: "owner" }],
  publishedAt: "2026-09-25T12:00:00Z",
  // Campos que não fazem parte da whitelist não podem aparecer na interface.
  taxId: "000.000.000-00",
  propertyWifiPassword: "segredo-nao-publico",
  internalNotes: "nota interna que nunca deve aparecer",
  acceptedName: "Nome interno",
};

async function mockResolver(
  context: BrowserContext,
  resolve: (token: string) => unknown = (token) => (token === validToken ? snapshot : null),
) {
  await context.route(rpcPattern, async (route) => {
    const body = route.request().postDataJSON() as { p_token?: string } | null;
    const token = body?.p_token ?? "";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(resolve(token)),
    });
  });
}

test("link de apresentação abre em contexto novo e renderiza somente a whitelist", async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mockResolver(context);
  const page = await context.newPage();

  // Um navegador com lixo legado em localStorage ainda deve depender somente da RPC 0023.
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "stayo-admin:proposal-share-links",
      JSON.stringify([{ token: "legacy-local-token", proposalId: "legacy-proposal" }]),
    );
  });

  await page.goto(`/portal/proposta/${validToken}`);
  await expect(page.getByTestId("public-proposal-presentation")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Apartamento Jardim Europa" })).toBeVisible();
  await expect(page.getByText("Gestão completa da locação")).toBeVisible();
  await expect(page.getByText("Taxa de gestão")).toBeVisible();
  await expect(page.getByText("Próximos passos")).toBeVisible();

  await expect(page.getByText("000.000.000-00")).toHaveCount(0);
  await expect(page.getByText("segredo-nao-publico")).toHaveCount(0);
  await expect(page.getByText("nota interna que nunca deve aparecer")).toHaveCount(0);
  await expect(page.getByText("Nome interno")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /aceite/i })).toHaveCount(0);
  await expect(page.getByText(/complete seu cadastro/i)).toHaveCount(0);

  await page.screenshot({ path: "test-results/phase2d3-mobile-390.png", fullPage: true });
  await context.close();
});

test("inválido, expirado, revogado e token de onboarding não exibem apresentação", async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 430, height: 932 } });
  await mockResolver(context, () => null);
  const page = await context.newPage();

  for (const token of [
    "presentation-invalid-00000000-0000-0000-0000-000000000002",
    "presentation-expired-00000000-0000-0000-0000-000000000003",
    "presentation-revoked-00000000-0000-0000-0000-000000000004",
    "onboarding-token-00000000-0000-0000-0000-000000000005",
  ]) {
    await page.goto(`/portal/proposta/${token}`);
    await expect(
      page.getByRole("heading", { name: "Esta proposta não está disponível" }),
    ).toBeVisible();
    await expect(page.getByTestId("public-proposal-presentation")).toHaveCount(0);
  }

  await context.close();
});

test("falha de rede tem estado próprio e permite tentar novamente", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  await context.route(rpcPattern, async (route) => route.abort("failed"));
  const page = await context.newPage();

  await page.goto(`/portal/proposta/${validToken}`);
  await expect(
    page.getByRole("heading", { name: "Não foi possível carregar a proposta" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
  await expect(page.getByTestId("public-proposal-presentation")).toHaveCount(0);

  await context.close();
});

for (const viewport of [
  { name: "375", width: 375, height: 812 },
  { name: "390", width: 390, height: 844 },
  { name: "430", width: 430, height: 932 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 900 },
]) {
  test(`layout sem overflow em ${viewport.name}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport });
    await mockResolver(context);
    const page = await context.newPage();

    await page.goto(`/portal/proposta/${validToken}`);
    await expect(page.getByTestId("public-proposal-presentation")).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);

    if (viewport.name === "desktop") {
      await page.screenshot({ path: "test-results/phase2d3-desktop-1280.png", fullPage: true });
    }

    await context.close();
  });
}
