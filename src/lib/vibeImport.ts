import type { Experience, ExperienceType } from "@/lib/types";

const allowedTypes: ExperienceType[] = ["internship", "work", "project", "campus", "competition", "research", "coursework", "volunteer"];

export function buildWorkspaceImportPrompt(): string {
  return `你正在用户真实的开发工作区/代码仓库中。请基于当前工作区中可验证的信息，生成一份可以直接导入 CareerVault 经历库的项目经历。

要求：
1. 先阅读当前项目的 README、主要代码、git diff / git log（如果可用）、测试、配置和用户实际完成的功能。
2. 只写你能从工作区验证的事实。不要因为代码是 AI 辅助生成就把“AI 生成”包装成用户独立完成；要准确描述用户实际做了什么，例如需求定义、架构决策、调试、集成、测试、验收、提示词设计、部署、文档等。
3. 不编造用户人数、性能提升、营收、百分比、奖项、主导程度或技术栈熟练度。
4. 如果无法判断某项事实，放到 questions 数组里，不要猜。
5. verifiedFacts 每一条都必须能被当前工作区支持。
6. 输出必须是下面的 JSON，不要输出解释文字。

CAREERVAULT_IMPORT_V1
{
  "experience": {
    "type": "project",
    "title": "项目名称",
    "organization": "个人项目/团队/课程/公司/比赛等",
    "startDate": "YYYY-MM 或空字符串",
    "endDate": "YYYY-MM 或空字符串",
    "rawDescription": "用普通人的话概括这个项目和用户的参与",
    "actions": "用户实际完成/决策/调试/集成的具体动作",
    "tools": "能从仓库确认的技术、工具、平台",
    "outcomes": "真实交付物、上线状态、测试结果或可验证成果",
    "verifiedFacts": ["事实1", "事实2", "事实3"]
  },
  "questions": ["只有确实无法从工作区判断、但会明显影响简历质量的问题"]
}
CAREERVAULT_IMPORT_END`;
}

export interface WorkspaceImportResult {
  experience: Experience;
  questions: string[];
}

export function parseWorkspaceImport(text: string): WorkspaceImportResult {
  const marker = text.match(/CAREERVAULT_IMPORT_V1\s*([\s\S]*?)\s*CAREERVAULT_IMPORT_END/i);
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = (marker?.[1] || fenced?.[1] || text).trim();
  const parsed = JSON.parse(source) as { experience?: Partial<Experience>; questions?: unknown };
  if (!parsed.experience?.title || !parsed.experience?.rawDescription) throw new Error("导入内容缺少项目名称或项目描述");
  const type = allowedTypes.includes(parsed.experience.type as ExperienceType) ? (parsed.experience.type as ExperienceType) : "project";
  return {
    experience: {
      id: typeof crypto !== "undefined" ? crypto.randomUUID() : Date.now().toString(),
      type,
      title: String(parsed.experience.title || ""),
      organization: String(parsed.experience.organization || "个人/团队项目"),
      startDate: String(parsed.experience.startDate || ""),
      endDate: String(parsed.experience.endDate || ""),
      rawDescription: String(parsed.experience.rawDescription || ""),
      actions: String(parsed.experience.actions || ""),
      tools: String(parsed.experience.tools || ""),
      outcomes: String(parsed.experience.outcomes || ""),
      verifiedFacts: Array.isArray(parsed.experience.verifiedFacts) ? parsed.experience.verifiedFacts.map(String).filter(Boolean) : [],
      source: "workspace",
    },
    questions: Array.isArray(parsed.questions) ? parsed.questions.map(String).filter(Boolean) : [],
  };
}
