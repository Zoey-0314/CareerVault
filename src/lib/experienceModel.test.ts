import { describe, expect, it } from "vitest";
import { getResumeEvidenceFacts, normalizeExperienceV3 } from "./experienceModel";
import type { Experience } from "./types";

function baseExperience(overrides: Partial<Experience> = {}): Experience {
  return {
    id: "exp-1",
    type: "project",
    title: "Test Project",
    organization: "Test Org",
    startDate: "2026-01",
    endDate: "2026-02",
    rawDescription: "完成一个测试项目",
    actions: "实现并验证核心流程",
    tools: "TypeScript",
    outcomes: "完成可运行版本",
    verifiedFacts: [],
    ...overrides,
  };
}

describe("Experience V3 migration and resume boundary", () => {
  it("migrates prefixed legacy facts into structured fields", () => {
    const normalized = normalizeExperienceV3(baseExperience({
      verifiedFacts: [
        "规模：覆盖 20 个测试场景",
        "个人贡献：负责调试与验收",
        "AI参与：AI 生成了部分初始代码",
        "面试准备：解释为什么采用该架构",
      ],
    }));

    expect(normalized.evidence?.scale).toContain("覆盖 20 个测试场景");
    expect(normalized.evidence?.ownership).toContain("负责调试与验收");
    expect(normalized.aiContext?.assisted).toBe(true);
    expect(normalized.aiContext?.aiContribution).toContain("AI 生成了部分初始代码");
    expect(normalized.interviewPrep?.questions).toContain("解释为什么采用该架构");
  });

  it("keeps AI participation and interview prep out of resume evidence", () => {
    const facts = getResumeEvidenceFacts(baseExperience({
      verifiedFacts: ["AI参与：AI 生成部分代码", "面试准备：复习事务边界", "修复了保存异常"],
      evidence: { scale: [], ownership: ["负责调试和验证"], difficulties: [], artifacts: [] },
      aiContext: { assisted: true, aiContribution: ["AI 生成部分代码"], userContribution: ["逐行审查并完成测试"] },
      interviewPrep: { questions: ["解释设计选择"], weakPoints: [], topicsToReview: [] },
    }));

    expect(facts.join(" ")).toContain("修复了保存异常");
    expect(facts.join(" ")).toContain("负责调试和验证");
    expect(facts.join(" ")).toContain("逐行审查并完成测试");
    expect(facts.join(" ")).not.toContain("AI 生成部分代码");
    expect(facts.join(" ")).not.toContain("复习事务边界");
  });
});
