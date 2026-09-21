import { describe, expect, it } from "vitest";

import { availablePortalToken } from "./owner-portal-access";

describe("availablePortalToken", () => {
  it("não recupera um token quando o acesso ativo veio de outro dispositivo", () => {
    expect(availablePortalToken("link-active", null)).toBeNull();
  });

  it("libera o token recém-criado para o mesmo acesso ativo", () => {
    expect(
      availablePortalToken("link-new", { linkId: "link-new", token: "token-secret" }),
    ).toBe("token-secret");
  });

  it("descarta o token anterior quando um novo acesso passa a ser o ativo", () => {
    expect(
      availablePortalToken("link-new", { linkId: "link-old", token: "token-old" }),
    ).toBeNull();
  });
});