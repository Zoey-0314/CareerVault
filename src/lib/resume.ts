import type { Experience, Profile } from "@/lib/types";

function compact(parts: string[]): string {
  return parts.map((part) => part.trim()).filter(Boolean).join("；");
}

export function buildResumeBullet(experience: Experience): string {
  const factText = experience.verifiedFacts.filter(Boolean).slice(0, 2).join("；");
  return compact([
    experience.actions || experience.rawDescription,
    experience.tools ? `使用 ${experience.tools}` : "",
    experience.outcomes,
    factText,
  ]);
}

export function buildSummary(profile: Profile, experiences: Experience[]): string {
  const tools = Array.from(
    new Set(
      experiences
        .flatMap((experience) => experience.tools.split(/[，,、/]/))
        .map((tool) => tool.trim())
        .filter(Boolean),
    ),
  ).slice(0, 5);

  const identity = [profile.school, profile.major, profile.degree].filter(Boolean).join(" · ");
  const skillText = tools.length ? `具备 ${tools.join("、")} 等实践经验` : "具备多类项目与实践经历";
  return [identity, skillText].filter(Boolean).join("，") + "。";
}
