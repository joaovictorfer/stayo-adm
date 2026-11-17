import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { MoneyCentsInput } from "./money-input";
function H() { const [c, setC] = useState(0); return <><MoneyCentsInput cents={c} onCentsChange={setC} aria-label="v" /><output>{c}</output></>; }
describe("MoneyCentsInput", () => {
  it("aceita centavos digitados com vírgula", () => {
    const r = render(<H />); const i = r.getByLabelText("v") as HTMLInputElement;
    for (const t of ["150", "150,", "150,5", "150,50"]) fireEvent.change(i, { target: { value: t } });
    expect(i.value).toBe("150,50"); expect(r.container.querySelector("output")!.textContent).toBe("15050");
  });
});
