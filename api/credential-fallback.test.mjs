import { describe, expect, it } from "vitest";
import { fallbackFromEvidence } from "./credential.mjs";

describe("credential fallback extraction", () => {
  it("recovers a substantive English Siemens NX certificate instead of generic CERTIFICATE", () => {
    const transcription = [
      "SIEMENS",
      "Siemens Digital Industries Software",
      "CERTIFICATE",
      "Wenqian Zhang",
      "IS RECOGNIZED AS A",
      "NX CAD Senior Operator",
      "28 September 2026",
      "2026 E01 060314 065",
    ].join("\n");

    const result = fallbackFromEvidence(transcription, null, {
      type: "certificate",
      name: "",
      issuer: "",
      date: "",
      rank: "",
      description: "",
    });

    expect(result.extracted.type).toBe("certificate");
    expect(result.extracted.name).toBe("NX CAD Senior Operator");
    expect(result.extracted.issuer).toBe("Siemens Digital Industries Software");
    expect(result.extracted.date).toBe("2026-09");
    expect(result.extracted.rank).toBe("NX CAD Senior Operator");
    expect(result.extracted.description).toContain("2026 E01 060314 065");
    expect(result.assessment.score).toBeGreaterThanOrEqual(60);
    expect(result.assessment.whatItProves).toContain("NX CAD Senior Operator");
  });
});
