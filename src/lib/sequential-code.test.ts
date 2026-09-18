import { describe, expect, it } from "vitest";

import { constraintTargetsColumn, isUniqueViolation, nextSequentialCode } from "./sequential-code";

describe("nextSequentialCode", () => {
  it("starts at 1 with no existing codes", () => {
    expect(nextSequentialCode("COB", [])).toBe("COB-00001");
  });

  it("picks the number after the highest existing code", () => {
    expect(nextSequentialCode("COB", ["COB-00001", "COB-00003", "COB-00002"])).toBe("COB-00004");
  });
});

describe("isUniqueViolation", () => {
  it("recognizes Postgres unique_violation (23505)", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("rejects any other error code", () => {
    expect(isUniqueViolation({ code: "42501" })).toBe(false);
  });

  it("handles a missing error", () => {
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});

describe("constraintTargetsColumn", () => {
  it("matches when the Postgres message names the column's constraint", () => {
    expect(
      constraintTargetsColumn(
        {
          message:
            'duplicate key value violates unique constraint "initial_charges_proposal_id_key"',
        },
        "proposal_id",
      ),
    ).toBe(true);
  });

  it("does not match a different column's constraint", () => {
    expect(
      constraintTargetsColumn(
        { message: 'duplicate key value violates unique constraint "initial_charges_code_key"' },
        "proposal_id",
      ),
    ).toBe(false);
  });
});
