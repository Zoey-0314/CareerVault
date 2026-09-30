import { analyzeInterviewTurn, type InterviewAgentAnalysis } from "@/lib/interviewAgent";
import type { Experience } from "@/lib/types";

export interface AiInterviewResponse {
  provider: "local-v1" | "openai";
  model?: string;
  analysis: InterviewAgentAnalysis;
}

const proxyUrl = process.env.NEXT_PUBLIC_CAREERVAULT_AI_URL?.trim();

export function isRemoteAiConfigured(): boolean {
  return Boolean(proxyUrl);
}

export async function analyzeInterviewWithProvider(
  answer: string,
  experience: Experience,
): Promise<AiInterviewResponse> {
  if (!proxyUrl) {
    return {
      provider: "local-v1",
      analysis: analyzeInterviewTurn(answer, experience),
    };
  }

  try {
    const response = await fetch(proxyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer, experience }),
    });

    if (!response.ok) throw new Error(`AI proxy returned ${response.status}`);
    const payload = (await response.json()) as AiInterviewResponse;
    if (!payload?.analysis?.extractedFacts) throw new Error("Invalid AI proxy payload");
    return payload;
  } catch {
    // The public demo must remain usable even when the optional AI backend is unavailable.
    return {
      provider: "local-v1",
      analysis: analyzeInterviewTurn(answer, experience),
    };
  }
}
