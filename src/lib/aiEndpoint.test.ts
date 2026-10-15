import { describe, expect, it } from "vitest";
import { resolveAiEndpointForLocation } from "./aiEndpoint";

describe("resolveAiEndpointForLocation", () => {
  it("uses same-origin APIs for the production custom domains", () => {
    expect(resolveAiEndpointForLocation("credential", "career-vault.xyz", "https://career-vault.xyz"))
      .toBe("https://career-vault.xyz/api/credential");
    expect(resolveAiEndpointForLocation("jd", "www.career-vault.xyz", "https://www.career-vault.xyz"))
      .toBe("https://www.career-vault.xyz/api/jd");
  });

  it("keeps GitHub Pages on the Vercel backend", () => {
    expect(resolveAiEndpointForLocation("interview", "zoey-0314.github.io", "https://zoey-0314.github.io"))
      .toBe("https://career-vault-sage.vercel.app/api/interview");
  });

  it("normalizes an explicitly configured API endpoint", () => {
    expect(resolveAiEndpointForLocation(
      "resume",
      "localhost",
      "http://localhost:3000",
      "https://example.test/api/interview",
    )).toBe("https://example.test/api/resume");
  });
});
