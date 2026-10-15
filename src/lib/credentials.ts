import type { Credential, CredentialLevel } from "@/lib/types";

export function sortCredentials(credentials: Credential[]): Credential[] {
  return [...credentials].sort((a, b) => (b.assessment?.score || 0) - (a.assessment?.score || 0));
}

export function credentialLevelLabel(level: CredentialLevel): string {
  return ({
    international: "国际级",
    national: "国家/全国级",
    provincial: "省级",
    city: "市级",
    school: "校级",
    organization: "组织级",
    industry: "行业认证",
    unknown: "待判断",
  } as const)[level];
}
