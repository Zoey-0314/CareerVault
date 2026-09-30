import { NextResponse } from "next/server";
import { analyzeInterviewTurn } from "@/lib/interviewAgent";
import type { Experience } from "@/lib/types";

interface InterviewRequest {
  answer?: string;
  experience?: Experience;
}

export async function POST(request: Request) {
  let body: InterviewRequest;
  try {
    body = (await request.json()) as InterviewRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.answer?.trim() || !body.experience) {
    return NextResponse.json({ error: "answer_and_experience_required" }, { status: 400 });
  }

  const analysis = analyzeInterviewTurn(body.answer, body.experience);

  return NextResponse.json({
    provider: "local-v1",
    analysis,
  });
}
