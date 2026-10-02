import { getExperienceReadiness } from "./interview";
import type { Credential, Experience, JobTarget, Profile, ResumeVersion } from "./types";

export type ReadinessDimensionKey = "profile" | "experience" | "target" | "resume" | "interview";

export interface ReadinessDimension {
  key: ReadinessDimensionKey;
  label: string;
  score: number;
  maxScore: number;
  detail: string;
}

export interface CareerReadiness {
  score: number;
  dimensions: ReadinessDimension[];
  nextAction: {
    key: ReadinessDimensionKey;
    title: string;
    detail: string;
  };
}

function clamp(value: number, max: number) {
  return Math.max(0, Math.min(max, Math.round(value)));
}

export function getCareerReadiness(input: {
  profile: Profile;
  experiences: Experience[];
  credentials: Credential[];
  jobTargets: JobTarget[];
  resumeVersions: ResumeVersion[];
  activeJobTargetId?: string;
}): CareerReadiness {
  const { profile, experiences, jobTargets, resumeVersions, activeJobTargetId } = input;
  const profileRequired = [profile.name, profile.email, profile.school, profile.major, profile.graduation];
  const profileScore = clamp((profileRequired.filter((item) => item.trim()).length / profileRequired.length) * 20, 20);

  const readinessScores = experiences.map((item) => getExperienceReadiness(item).score).sort((a, b) => b - a);
  const strongExperiences = readinessScores.filter((score) => score >= 60).length;
  const topThreeAverage = readinessScores.length
    ? readinessScores.slice(0, 3).reduce((sum, value) => sum + value, 0) / Math.min(readinessScores.length, 3)
    : 0;
  const experienceScore = clamp((topThreeAverage / 100) * 24 + Math.min(strongExperiences, 2) * 3, 30);

  const activeTarget = jobTargets.find((item) => item.id === activeJobTargetId) || jobTargets[0];
  const targetFields = activeTarget ? [activeTarget.company, activeTarget.role, activeTarget.jd] : [];
  const targetScore = activeTarget ? clamp((targetFields.filter((item) => item.trim()).length / 3) * 20, 20) : 0;

  const activeVersions = activeTarget ? resumeVersions.filter((item) => item.jobTargetId === activeTarget.id) : [];
  const resumeScore = activeVersions.length ? 20 : 0;

  const submittedTargets = jobTargets.filter((item) => item.submittedResumeVersionId);
  const targetsWithPrep = submittedTargets.filter((item) => item.interviewPrep?.questions?.length).length;
  const interviewScore = submittedTargets.length
    ? clamp((targetsWithPrep / submittedTargets.length) * 10, 10)
    : 0;

  const dimensions: ReadinessDimension[] = [
    {
      key: "profile",
      label: "基础档案",
      score: profileScore,
      maxScore: 20,
      detail: profileScore === 20 ? "基础联系与教育信息已齐。" : "补齐姓名、邮箱、学校、专业和毕业时间。",
    },
    {
      key: "experience",
      label: "经历证据",
      score: experienceScore,
      maxScore: 30,
      detail: strongExperiences >= 2 ? `已有 ${strongExperiences} 段达到可用证据强度。` : "至少准备 2 段能讲清动作、结果和个人贡献的经历。",
    },
    {
      key: "target",
      label: "目标岗位",
      score: targetScore,
      maxScore: 20,
      detail: targetScore === 20 ? "当前岗位的公司、岗位和 JD 已保存。" : "保存一个完整目标岗位，并保留 JD 原文。",
    },
    {
      key: "resume",
      label: "定制简历",
      score: resumeScore,
      maxScore: 20,
      detail: resumeScore === 20 ? "当前目标已有可追溯的简历快照。" : "针对当前岗位生成并保存一版简历快照。",
    },
    {
      key: "interview",
      label: "面试准备",
      score: interviewScore,
      maxScore: 10,
      detail: submittedTargets.length === 0 ? "尚未进入投递后阶段。" : interviewScore === 10 ? "已投递岗位都有基于实际投递版的面试准备。" : "已投递岗位仍有面试准备缺口。",
    },
  ];

  const actionMap: Record<ReadinessDimensionKey, { title: string; detail: string }> = {
    profile: { title: "补齐基础档案", detail: "先让联系方式与教育背景达到可直接出简历的状态。" },
    experience: { title: "强化经历证据", detail: "优先补个人贡献、结果、规模和可以追溯的证据。" },
    target: { title: "完善目标岗位", detail: "补齐公司、岗位名称和 JD 原文，后续匹配才有依据。" },
    resume: { title: "保存岗位定制简历", detail: "生成后保存快照，避免投递后找不到当时版本。" },
    interview: { title: "准备已投岗位面试", detail: "基于实际投递版生成问题清单，不编造答案。" },
  };

  const incomplete = dimensions.find((item) => item.score < item.maxScore);
  const nextKey = incomplete?.key || "experience";
  const total = dimensions.reduce((sum, item) => sum + item.score, 0);

  return {
    score: clamp(total, 100),
    dimensions,
    nextAction: { key: nextKey, ...actionMap[nextKey] },
  };
}
