import type { Experience, JobMatch } from "@/lib/types";

const STOP_WORDS = new Set([
  "and", "the", "with", "for", "you", "your", "our", "are", "will", "this", "that", "from",
  "工作", "岗位", "负责", "要求", "以及", "具有", "相关", "能够", "优先", "经验", "能力",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\u4e00-\u9fff]+/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word));
}

function experienceText(experience: Experience): string {
  return [
    experience.title,
    experience.organization,
    experience.rawDescription,
    experience.actions,
    experience.tools,
    experience.outcomes,
    ...experience.verifiedFacts,
  ].join(" ");
}

export function matchExperiences(jd: string, experiences: Experience[]): JobMatch[] {
  const jdTokens = Array.from(new Set(tokenize(jd)));

  return experiences
    .map((experience) => {
      const text = experienceText(experience).toLowerCase();
      const matchedKeywords = jdTokens.filter((token) => text.includes(token)).slice(0, 12);
      const score = jdTokens.length === 0 ? 0 : Math.min(100, Math.round((matchedKeywords.length / Math.min(jdTokens.length, 12)) * 100));
      return { experienceId: experience.id, score, matchedKeywords };
    })
    .sort((a, b) => b.score - a.score);
}

export function getFollowUpQuestions(experience: Experience): string[] {
  const questions: string[] = [];
  if (!experience.actions.trim()) questions.push("你具体做了哪些动作？请尽量用“设计、分析、开发、协调、检查”等动词描述。 ");
  if (!experience.tools.trim()) questions.push("过程中使用了哪些工具、软件、方法或技术？");
  if (!experience.outcomes.trim()) questions.push("这件事最后产生了什么结果？如果没有准确数据，也可以描述可验证的变化，不要猜数字。");
  if (experience.rawDescription.trim().length < 30) questions.push("能否补充一个最具体、最能体现你能力的任务或难点？");
  if (questions.length === 0) questions.push("这段经历已经比较完整。还有没有你希望面试官一定注意到的细节？");
  return questions.slice(0, 3);
}
