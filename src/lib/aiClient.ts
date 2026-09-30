import { analyzeInterviewTurn, type InterviewAgentAnalysis } from "@/lib/interviewAgent";
import { assessCredentialLocally } from "@/lib/credentials";
import type { Credential, CredentialAssessment, Experience } from "@/lib/types";

export interface AiInterviewResponse {
  provider: "local-v1" | "openai";
  model?: string;
  analysis: InterviewAgentAnalysis;
}

export interface AiCredentialResponse {
  provider: "local-v1" | "openai";
  model?: string;
  assessment: CredentialAssessment;
  extracted?: Partial<Pick<Credential, "name" | "issuer" | "date" | "rank" | "description" | "type">>;
}

function configuredProxyUrl(): string | undefined {
  const configured = process.env.NEXT_PUBLIC_CAREERVAULT_AI_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location.hostname.endsWith("vercel.app")) {
    return `${window.location.origin}/api/interview`;
  }
  return undefined;
}

function endpointFor(kind: "interview" | "credential"): string | undefined {
  const base = configuredProxyUrl();
  if (!base) return undefined;
  if (/\/api\/(interview|credential)$/.test(base)) return base.replace(/\/api\/(interview|credential)$/, `/api/${kind}`);
  return `${base}/api/${kind}`;
}

export function isRemoteAiConfigured(): boolean {
  return Boolean(configuredProxyUrl());
}

export async function analyzeInterviewWithProvider(answer: string, experience: Experience): Promise<AiInterviewResponse> {
  const url = endpointFor("interview");
  if (!url) return { provider: "local-v1", analysis: analyzeInterviewTurn(answer, experience) };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer, experience }),
    });
    if (!response.ok) throw new Error(`AI proxy returned ${response.status}`);
    const payload = (await response.json()) as AiInterviewResponse;
    if (!payload?.analysis?.extractedFacts) throw new Error("Invalid AI proxy payload");
    return payload;
  } catch {
    return { provider: "local-v1", analysis: analyzeInterviewTurn(answer, experience) };
  }
}

export async function analyzeCredentialWithProvider(credential: Credential): Promise<AiCredentialResponse> {
  const local = assessCredentialLocally(credential);
  const url = endpointFor("credential");
  if (!url) return { provider: "local-v1", assessment: local };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });
    if (!response.ok) throw new Error(`AI proxy returned ${response.status}`);
    const payload = (await response.json()) as AiCredentialResponse;
    if (!payload?.assessment || typeof payload.assessment.score !== "number") throw new Error("Invalid credential analysis payload");
    return payload;
  } catch {
    return { provider: "local-v1", assessment: local };
  }
}
