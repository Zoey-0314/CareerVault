import type { Experience, InterviewDebrief, InterviewPrepPlan, ResumeVersion } from "@/lib/types";

const DEFAULT_PUBLIC_PROXY = "https://career-vault-sage.vercel.app/api/interview-prep";

function endpoint(): string | undefined {
  const configured = process.env.NEXT_PUBLIC_CAREERVAULT_AI_URL?.trim();
  if (configured) {
    const base = configured.replace(/\/$/, "");
    if (/\/api\/(interview|credential|jd|resume|interview-prep)$/.test(base)) return base.replace(/\/api\/(interview|credential|jd|resume|interview-prep)$/, "/api/interview-prep");
    return `${base}/api/interview-prep`;
  }
  if (typeof window !== "undefined") {
    if (window.location.hostname.endsWith("vercel.app")) return `${window.location.origin}/api/interview-prep`;
    if (window.location.hostname === "zoey-0314.github.io") return DEFAULT_PUBLIC_PROXY;
  }
  return undefined;
}

async function readError(response: Response) {
  const payload = await response.json().catch(() => null) as { detail?: string; error?: string; provider?: string; model?: string } | null;
  const provider = payload?.provider || "AI";
  const model = payload?.model ? ` · ${payload.model}` : "";
  return new Error(`${payload?.detail || payload?.error || `面试准备生成失败（${response.status}）`} [${provider}${model}]`);
}

export async function generateInterviewPrep(
  resumeVersion: ResumeVersion,
  experiences: Experience[],
  debriefs: InterviewDebrief[] = [],
): Promise<InterviewPrepPlan> {
  const url = endpoint();
  if (!url) throw new Error("当前部署未配置面试准备服务。");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resumeVersion, experiences, debriefs: debriefs.slice(0, 5) }),
  });
  if (!response.ok) throw await readError(response);
  const payload = await response.json() as Omit<InterviewPrepPlan, "generatedAt" | "resumeVersionId">;
  if (!Array.isArray(payload?.questions)) throw new Error("面试准备服务返回了无效结构。");
  return {
    ...payload,
    generatedAt: new Date().toISOString(),
    resumeVersionId: resumeVersion.id,
  };
}
