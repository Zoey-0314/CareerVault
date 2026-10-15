import type { Experience } from "@/lib/types";
import { resolveAiEndpoint } from "@/lib/aiEndpoint";

export interface GroundedResumeBullet {
  text: string;
  sourceFactIds: string[];
}

export interface GroundedResumeSelection {
  experienceId: string;
  relevanceScore: number;
  matchReasons: string[];
  bullets: GroundedResumeBullet[];
}

export interface GroundedResumeDraft {
  provider: "openai" | "deepseek";
  model?: string;
  targetRole: string;
  selected: GroundedResumeSelection[];
  warnings: string[];
}

function resumeEndpoint(): string | undefined {
  return resolveAiEndpoint("resume");
}

async function readError(response: Response): Promise<Error> {
  const payload = await response.json().catch(() => null) as { detail?: string; error?: string; provider?: string; model?: string } | null;
  const provider = payload?.provider || "AI";
  const model = payload?.model ? ` · ${payload.model}` : "";
  return new Error(`${payload?.detail || payload?.error || `AI 简历调用失败（${response.status}）`} [${provider}${model}]`);
}

export async function generateGroundedResumeDraft(jd: string, experiences: Experience[]): Promise<GroundedResumeDraft> {
  const url = resumeEndpoint();
  if (!url) throw new Error("当前部署未配置 AI 简历服务。");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jd, experiences }),
  });
  if (!response.ok) throw await readError(response);
  const payload = await response.json() as GroundedResumeDraft;
  if (!Array.isArray(payload?.selected)) throw new Error("AI 简历服务返回了无效结构。");
  return payload;
}
