import { describe, expect, it } from "vitest";
import { evaluateCredentialCase, normalizeMonth, validateFixture } from "./ai-eval-core.mjs";

describe("AI eval core", () => {
  it("normalizes English credential dates", () => {
    expect(normalizeMonth("28 September 2026")).toBe("2026-09");
  });

  it("scores a grounded Siemens credential response", () => {
    const fixture = {
      id: "credential-siemens-nx",
      kind: "credential",
      assetFile: "credential/siemens-nx-senior-operator.jpg",
      expected: {
        fields: {
          name: { value: "NX CAD Senior Operator", weight: 2 },
          issuer: { value: "Siemens Digital Industries Software", weight: 2 },
          date: { value: "2026-09", match: "month" },
          type: { value: "certificate" },
          certificateNumber: { value: "2026 E01 060314 065" },
        },
        transcriptionMustContain: [
          "Siemens Digital Industries Software",
          "NX CAD Senior Operator",
          "28 September 2026",
          "2026 E01 060314 065",
        ],
        forbiddenPatterns: ["国家级", "全国级", "一等奖", "Top 10%"],
      },
      thresholds: { fieldAccuracy: 1, transcriptionCoverage: 1, missingRequiredRate: 0, hallucinationCount: 0 },
    };
    const response = {
      extracted: {
        name: "NX CAD Senior Operator",
        issuer: "Siemens Digital Industries Software",
        date: "2026-09",
        type: "certificate",
        description: "证书编号：2026 E01 060314 065",
      },
      transcription: "Siemens Digital Industries Software\nNX CAD Senior Operator\n28 September 2026\n2026 E01 060314 065",
      assessment: { score: 65, rationale: [], whatItProves: "NX CAD Senior Operator" },
    };
    const report = evaluateCredentialCase(fixture, response);
    expect(report.pass).toBe(true);
    expect(report.metrics.fieldAccuracy).toBe(1);
    expect(report.metrics.transcriptionCoverage).toBe(1);
  });

  it("separates OCR success from structural failure", () => {
    const fixture = {
      id: "credential-siemens-nx",
      kind: "credential",
      assetFile: "credential/siemens-nx-senior-operator.jpg",
      expected: {
        fields: {
          name: { value: "NX CAD Senior Operator", weight: 2 },
          issuer: { value: "Siemens Digital Industries Software", weight: 2 },
          date: { value: "2026-09", match: "month" },
        },
        transcriptionMustContain: ["NX CAD Senior Operator", "28 September 2026"],
      },
      thresholds: { fieldAccuracy: 1, transcriptionCoverage: 1, missingRequiredRate: 0, hallucinationCount: 0 },
    };
    const response = {
      extracted: { name: "CERTIFICATE", issuer: "Siemens Digital Industries Software", date: "" },
      transcription: "CERTIFICATE\nNX CAD Senior Operator\n28 September 2026",
      assessment: { score: 35, rationale: [], whatItProves: "CERTIFICATE" },
    };
    const report = evaluateCredentialCase(fixture, response);
    expect(report.pass).toBe(false);
    expect(report.metrics.transcriptionCoverage).toBe(1);
    expect(report.metrics.fieldAccuracy).toBeLessThan(1);
    expect(report.metrics.missingRequiredRate).toBeGreaterThan(0);
  });

  it("validates fixture shape", () => {
    expect(validateFixture({ id: "x", kind: "credential", assetFile: "x.jpg", expected: {} })).toEqual([]);
    expect(validateFixture({ id: "x", kind: "credential", expected: {} })).toContain("assetFile is required for credential/jd live eval cases");
  });
});
