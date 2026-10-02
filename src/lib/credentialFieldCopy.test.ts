import { describe, expect, it } from "vitest";
import { credentialFieldCopy } from "./credentialFieldCopy";

describe("credentialFieldCopy", () => {
  it("uses certification language for certificates", () => {
    const value = credentialFieldCopy("certificate");
    expect(value.issuerLabel).toContain("认证机构");
    expect(value.rankLabel).toContain("考试等级");
  });

  it("uses appointment language for other documents such as appointment letters", () => {
    const value = credentialFieldCopy("other");
    expect(value.issuerLabel).toContain("聘任单位");
    expect(value.rankLabel).toContain("任期");
    expect(value.descriptionPlaceholder).toContain("聘书");
  });
});
