import { describe, expect, it } from "vitest";
import { getCareerReadiness } from "./careerReadiness";
import type { Experience, JobTarget, Profile, ResumeVersion } from "./types";

const emptyProfile: Profile = { name: "", email: "", phone: "", city: "", school: "", major: "", degree: "", graduation: "" };

function strongExperience(id: string): Experience {
  return {
    id,
    type: "project",
    title: `Project ${id}`,
    organization: "Org",
    startDate: "2026-01",
    endDate: "2026-03",
    rawDescription: "完成真实项目并交付可运行结果",
    actions: "设计、实现并验证核心功能流程",
    tools: "TypeScript, Playwright",
    outcomes: "完成可运行版本并通过测试验收",
    verifiedFacts: [],
    evidence: {
      scale: ["覆盖 20 个测试场景"],
      ownership: ["负责调试与验收"],
      difficulties: ["定位并处理状态不同步问题"],
      artifacts: ["代码仓库与测试报告"],
    },
    aiContext: { assisted: null, aiContribution: [], userContribution: [] },
    interviewPrep: { questions: [], weakPoints: [], topicsToReview: [] },
  };
}

function target(): JobTarget {
  return {
    id: "job-1",
    company: "Example Co",
    role: "Test Engineer Intern",
    jd: "负责自动化测试与问题定位",
    sourceUrl: "",
    channel: "官网",
    status: "ready",
    priority: "high",
    appliedAt: "",
    notes: "",
    nextAction: "",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  };
}

function resumeVersion(): ResumeVersion {
  return {
    id: "resume-1",
    jobTargetId: "job-1",
    createdAt: "2026-10-01T00:00:00.000Z",
    label: "投递版 V1",
    targetRole: "Test Engineer Intern",
    summary: "summary",
    selectedExperienceIds: ["exp-1"],
    experienceBullets: [{ experienceId: "exp-1", bullets: ["完成自动化测试"] }],
    credentialIds: [],
    provider: "deepseek",
    model: "deepseek-flash",
    jdSnapshot: "负责自动化测试与问题定位",
  };
}

describe("getCareerReadiness", () => {
  it("starts at zero and points to profile", () => {
    const result = getCareerReadiness({ profile: emptyProfile, experiences: [], credentials: [], jobTargets: [], resumeVersions: [] });
    expect(result.score).toBe(0);
    expect(result.nextAction.key).toBe("profile");
  });

  it("reaches the pre-interview maximum after profile, strong experiences, target and resume are ready", () => {
    const job = target();
    const result = getCareerReadiness({
      profile: { ...emptyProfile, name: "Zoey", email: "z@example.com", school: "University", major: "Engineering", graduation: "2028" },
      experiences: [strongExperience("exp-1"), strongExperience("exp-2")],
      credentials: [],
      jobTargets: [job],
      resumeVersions: [resumeVersion()],
      activeJobTargetId: job.id,
    });
    expect(result.dimensions.find((item) => item.key === "profile")?.score).toBe(20);
    expect(result.dimensions.find((item) => item.key === "experience")?.score).toBe(30);
    expect(result.dimensions.find((item) => item.key === "target")?.score).toBe(20);
    expect(result.dimensions.find((item) => item.key === "resume")?.score).toBe(20);
    expect(result.score).toBe(90);
    expect(result.nextAction.key).toBe("interview");
  });

  it("adds interview readiness only after a submitted target has a grounded prep plan", () => {
    const job = {
      ...target(),
      status: "interview" as const,
      submittedResumeVersionId: "resume-1",
      interviewPrep: {
        generatedAt: "2026-10-02T00:00:00.000Z",
        resumeVersionId: "resume-1",
        provider: "deepseek" as const,
        model: "deepseek-flash",
        questions: [{ id: "q1", category: "resume_claim" as const, question: "你本人做了什么？", why: "核验简历 claim" }],
        reviewTopics: [],
        evidenceGaps: [],
        warnings: [],
      },
    };
    const result = getCareerReadiness({
      profile: { ...emptyProfile, name: "Zoey", email: "z@example.com", school: "University", major: "Engineering", graduation: "2028" },
      experiences: [strongExperience("exp-1"), strongExperience("exp-2")],
      credentials: [],
      jobTargets: [job],
      resumeVersions: [resumeVersion()],
      activeJobTargetId: job.id,
    });
    expect(result.dimensions.find((item) => item.key === "interview")?.score).toBe(10);
    expect(result.score).toBe(100);
  });
});
