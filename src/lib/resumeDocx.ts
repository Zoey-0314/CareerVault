import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import { buildTargetedResumeBullets, buildTargetedSummary, inferTargetRole } from "@/lib/resume";
import type { Credential, Experience, JobMatch, Profile } from "@/lib/types";

export interface ResumeDocxInput {
  profile: Profile;
  jd: string;
  experiences: Experience[];
  matches: JobMatch[];
  credentials: Credential[];
}

const noBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

function p(text: string, options?: { bold?: boolean; size?: number; color?: string; before?: number; after?: number; align?: AlignmentType }) {
  return new Paragraph({
    alignment: options?.align,
    spacing: { before: options?.before ?? 0, after: options?.after ?? 80, line: 280 },
    children: [new TextRun({ text, bold: options?.bold, size: options?.size ?? 20, color: options?.color ?? "222222", font: "Microsoft YaHei" })],
  });
}

function sectionHeading(cn: string, en: string) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: "EEEEEC", type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 180, right: 180 },
            children: [new Paragraph({
              spacing: { after: 0 },
              children: [
                new TextRun({ text: cn, bold: true, size: 22, font: "Microsoft YaHei", color: "1F2321" }),
                new TextRun({ text: `    ${en}`, italics: true, size: 19, font: "Arial", color: "5B5F5C" }),
              ],
            })],
          }),
        ],
      }),
    ],
  });
}

function bullet(text: string) {
  return new Paragraph({
    spacing: { after: 55, line: 255 },
    bullet: { level: 0 },
    children: [new TextRun({ text, size: 19, font: "Microsoft YaHei", color: "2B2D2C" })],
  });
}

function experienceRow(experience: Experience, matchedKeywords: string[]) {
  const bullets = buildTargetedResumeBullets(experience, matchedKeywords);
  const dateText = [experience.startDate, experience.endDate || "至今"].filter(Boolean).join(" - ");
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 24, type: WidthType.PERCENTAGE },
            margins: { top: 85, bottom: 90, left: 0, right: 180 },
            verticalAlign: VerticalAlign.TOP,
            children: [
              p(dateText || "时间", { bold: true, size: 18, after: 45 }),
              p(experience.title || "岗位 / 项目", { size: 18, color: "444746", after: 0 }),
            ],
          }),
          new TableCell({
            width: { size: 76, type: WidthType.PERCENTAGE },
            margins: { top: 85, bottom: 90, left: 0, right: 0 },
            verticalAlign: VerticalAlign.TOP,
            children: [
              p(experience.organization || "组织 / 公司", { bold: true, size: 19, after: 50 }),
              ...(bullets.length ? bullets.map(bullet) : [p("当前经历与目标 JD 的可用事实不足。", { size: 18, color: "777777" })]),
            ],
          }),
        ],
      }),
    ],
  });
}

export async function buildResumeDocx(input: ResumeDocxInput): Promise<Blob> {
  const { profile, jd, experiences, matches, credentials } = input;
  const targetRole = inferTargetRole(jd);
  const matchMap = new Map(matches.map((item) => [item.experienceId, item]));
  const allKeywords = Array.from(new Set(matches.flatMap((item) => item.matchedKeywords))).slice(0, 8);
  const summary = buildTargetedSummary(profile, experiences, allKeywords);

  const header = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 78, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.TOP,
            margins: { top: 0, bottom: 120, left: 0, right: 220 },
            children: [
              p(profile.name || "姓名", { bold: true, size: 34, after: 80 }),
              p(`求职意向：${targetRole}`, { size: 20, after: 100 }),
              p([profile.phone, profile.email, profile.city].filter(Boolean).join("    ") || "电话    邮箱    求职城市", { size: 18, color: "555957", after: 0 }),
            ],
          }),
          new TableCell({
            width: { size: 22, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            shading: { fill: "F3F3F1", type: ShadingType.CLEAR },
            margins: { top: 260, bottom: 260, left: 120, right: 120 },
            children: [p("证件照", { size: 18, color: "8A8D8A", after: 0, align: AlignmentType.CENTER })],
          }),
        ],
      }),
    ],
  });

  const education = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 24, type: WidthType.PERCENTAGE },
            margins: { top: 100, bottom: 100, left: 0, right: 180 },
            children: [
              p(profile.graduation ? `毕业 ${profile.graduation}` : "毕业时间", { bold: true, size: 18, after: 45 }),
              p([profile.major, profile.degree].filter(Boolean).join(" / ") || "专业 / 学历", { size: 18, color: "444746", after: 0 }),
            ],
          }),
          new TableCell({
            width: { size: 76, type: WidthType.PERCENTAGE },
            margins: { top: 100, bottom: 100, left: 0, right: 0 },
            children: [
              p(profile.school || "学校", { bold: true, size: 20, after: 50 }),
              p("教育信息只展示 CareerVault 中已填写的基础字段。", { size: 18, color: "666A67", after: 0 }),
            ],
          }),
        ],
      }),
    ],
  });

  const credentialRows = credentials.slice(0, 3).map((item) => new TableRow({
    children: [
      new TableCell({
        width: { size: 24, type: WidthType.PERCENTAGE },
        margins: { top: 65, bottom: 65, left: 0, right: 180 },
        children: [p(item.date || "", { bold: true, size: 18, after: 0 })],
      }),
      new TableCell({
        width: { size: 76, type: WidthType.PERCENTAGE },
        margins: { top: 65, bottom: 65, left: 0, right: 0 },
        children: [p([item.name, item.rank, item.issuer].filter(Boolean).join(" · "), { size: 18, after: 0 })],
      }),
    ],
  }));

  const children = [
    header,
    sectionHeading("教育背景", "Education"),
    education,
    sectionHeading("相关经历", "Experience"),
    ...experiences.map((experience) => experienceRow(experience, matchMap.get(experience.id)?.matchedKeywords || [])),
  ];

  if (credentialRows.length) {
    children.push(sectionHeading("荣誉奖励", "Award"));
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders, rows: credentialRows }));
  }

  children.push(sectionHeading("职业概述", "Profile"));
  children.push(p(summary, { size: 18, before: 80, after: 0 }));

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: "Microsoft YaHei", size: 20, color: "222222" }, paragraph: { spacing: { line: 280 } } },
      },
    },
    sections: [{
      properties: { page: { margin: { top: 680, right: 700, bottom: 650, left: 700 } } },
      children,
    }],
  });

  return Packer.toBlob(doc);
}

export async function downloadResumeDocx(input: ResumeDocxInput) {
  const blob = await buildResumeDocx(input);
  const targetRole = inferTargetRole(input.jd).replace(/[\\/:*?"<>|]/g, "-");
  const fileName = `${input.profile.name || "CareerVault"}-${targetRole || "定制简历"}.docx`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
