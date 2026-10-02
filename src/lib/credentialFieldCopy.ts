import type { CredentialType } from "./types";

export interface CredentialFieldCopy {
  issuerLabel: string;
  rankLabel: string;
  descriptionLabel: string;
  rankPlaceholder: string;
  descriptionPlaceholder: string;
}

const copy: Record<CredentialType, CredentialFieldCopy> = {
  award: {
    issuerLabel: "主办 / 颁发方",
    rankLabel: "奖级 / 名次",
    descriptionLabel: "为什么获得它 / 你实际做了什么",
    rankPlaceholder: "例如：一等奖 / Top 10% / 入围",
    descriptionPlaceholder: "写清获奖依据、你的真实贡献或作品成果。",
  },
  certificate: {
    issuerLabel: "发证 / 认证机构",
    rankLabel: "认证 / 考试等级",
    descriptionLabel: "它证明了什么能力 / 成绩",
    rankPlaceholder: "例如：二级 / 通过 / 专业认证等级",
    descriptionPlaceholder: "写清考试科目、认证能力或可验证成绩；没有就留空。",
  },
  honor: {
    issuerLabel: "评选 / 颁发单位",
    rankLabel: "荣誉称号 / 级别",
    descriptionLabel: "为什么获得这项荣誉",
    rankPlaceholder: "例如：优秀班委 / 校级荣誉",
    descriptionPlaceholder: "写清评选范围、依据，以及你实际承担的工作。",
  },
  competition: {
    issuerLabel: "赛事主办方",
    rankLabel: "奖级 / 名次",
    descriptionLabel: "参赛项目与个人贡献",
    rankPlaceholder: "例如：二等奖 / 第 3 名 / Finalist",
    descriptionPlaceholder: "写清参赛项目、团队角色和你本人可解释的贡献。",
  },
  other: {
    issuerLabel: "出具 / 聘任单位",
    rankLabel: "职位 / 任期 / 等级",
    descriptionLabel: "这份材料对应的任职 / 成果",
    rankPlaceholder: "例如：部门骨干，聘期一年",
    descriptionPlaceholder: "适用于聘书、任命书等：写清任职、职责或对应成果。",
  },
};

export function credentialFieldCopy(type: CredentialType): CredentialFieldCopy {
  return copy[type] || copy.other;
}
