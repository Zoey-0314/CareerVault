import type { JobTarget, JobTargetPriority, JobTargetStatus, ResumeVersion } from "@/lib/types";

export const JOB_STATUS_LABELS: Record<JobTargetStatus, string> = {
  saved: "收藏/待准备",
  ready: "已准备",
  applied: "已投递",
  assessment: "笔试/测评",
  interview: "面试中",
  offer: "Offer",
  closed: "已结束",
};

export const JOB_PRIORITY_LABELS: Record<JobTargetPriority, string> = {
  high: "重点",
  medium: "正常",
  low: "低优先",
};

function id(prefix: string) {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyJobTarget(seed?: Partial<JobTarget>): JobTarget {
  const now = new Date().toISOString();
  return {
    id: seed?.id || id("job"),
    company: seed?.company || "",
    role: seed?.role || "",
    jd: seed?.jd || "",
    sourceUrl: seed?.sourceUrl || "",
    channel: seed?.channel || "",
    status: seed?.status || "saved",
    priority: seed?.priority || "medium",
    appliedAt: seed?.appliedAt || "",
    notes: seed?.notes || "",
    nextAction: seed?.nextAction || "",
    createdAt: seed?.createdAt || now,
    updatedAt: seed?.updatedAt || now,
    submittedResumeVersionId: seed?.submittedResumeVersionId,
    interviewPrep: seed?.interviewPrep,
    interviewDebriefs: Array.isArray(seed?.interviewDebriefs) ? seed!.interviewDebriefs : [],
  };
}

export function normalizeJobTarget(value: Partial<JobTarget>): JobTarget {
  return createEmptyJobTarget(value);
}

export function legacyTargetFromJd(jd: string): JobTarget {
  return createEmptyJobTarget({
    id: "legacy-job-target",
    role: "未命名目标岗位",
    jd,
    status: "saved",
    priority: "medium",
  });
}

export function newResumeVersionId() {
  return id("resume");
}

export function newInterviewDebriefId() {
  return id("debrief");
}

export function latestResumeVersionForTarget(versions: ResumeVersion[], jobTargetId: string) {
  return versions
    .filter((item) => item.jobTargetId === jobTargetId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
}
