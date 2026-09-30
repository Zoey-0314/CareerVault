# CareerVault

> **Tell your story once. Tailor it for every opportunity.**  
> **经历认真整理一次，此后针对不同岗位自动选材、改写和生成简历。**

CareerVault 是一个 **local-first 的个人职业经历资产库 + AI 简历定制工作台**。

它不是“把一段经历润色得更像 AI 写的”，而是先帮用户长期保存真实经历，再通过专业 HR 风格的追问补全事实，最后根据目标岗位 JD 自动选择最相关的证据、压缩表达并生成一页简历。

CareerVault is a **local-first career memory and AI resume tailoring workspace**. Instead of rewriting a resume from scratch every time, it builds a reusable, verified career evidence vault and turns that evidence into role-specific resumes.

---

## 中文说明

### 为什么做 CareerVault？

大多数 AI 简历工具从“你已经有一份简历”开始。

CareerVault 从更早的一步开始：

> **你到底做过什么？哪些事情值得写？哪些数据是真的？哪些能力有证据？**

很多人的问题并不是不会写简历，而是：

- 实习、比赛、课程项目、校园活动做完几个月后，细节已经忘了；
- 只记得“负责运营”“参与开发”“做过调研”，但说不清自己具体做了什么；
- 每次投不同岗位都从零改简历；
- AI 为了“写得好看”容易自动补数字、夸大 ownership，甚至编造结果；
- Vibe Coding / AI Coding 项目很多工作发生在 AI 工作区里，重新口述项目非常浪费时间；
- 奖状和证书很多，但不知道哪些真的值得写进简历；
- 一段很强的项目，最后常被写成 Git 日志、依赖列表和技术堆砌。

CareerVault 的目标是把这些问题拆成一个长期可复用的流程：

```text
真实经历
   ↓
AI / HR 追问
   ↓
结构化事实资产
   ↓
目标岗位 JD
   ↓
岗位证据匹配
   ↓
一页定制简历
   ↓
Word 导出
```

---

## 核心理念

### 1. Facts are the source of truth

**事实永远优先于“包装”。**

AI 可以：

- 提取事实；
- 帮你追问遗漏信息；
- 判断哪些经历更适合某个岗位；
- 改写表达方式；
- 压缩和排序内容。

AI 不可以擅自：

- 编造百分比；
- 把“参与”写成“主导”；
- 添加没有使用过的技术；
- 虚构项目结果；
- 夸大奖项等级；
- 把模糊数字改成精确数字。

不确定、推断或模糊的信息必须由用户确认后才能进入事实库。

### 2. Resume is an output, not the database

CareerVault 中真正长期保存的是**经历事实**，不是某一份简历。

同一段经历可以针对不同岗位生成不同表达，但底层事实始终保持一致。

### 3. JD decides what matters

简历不是“把所有经历都塞进一页”。

CareerVault 会先读取目标岗位 JD，再决定：

- 哪些经历应该出现；
- 哪些项目应该删掉；
- 每段经历突出什么；
- 哪些工具 / 方法值得写；
- 哪些成果最能证明岗位需要的能力。

---

## V1 已实现功能

### 1. 个人档案

保存简历真正需要的基础信息，例如：

- 姓名
- 邮箱
- 电话
- 求职城市
- 学校
- 专业
- 学历
- 毕业时间

默认不强制收集年龄、性别、身高、详细住址等低价值或敏感信息。

---

### 2. 经历库

目前支持：

- 实习
- 工作
- 项目
- 校园经历
- 比赛
- 科研
- 课程设计
- 志愿经历

每段经历保存的是结构化事实，而不是只有一段“简历话术”：

```text
基础信息
├── 时间
├── 公司 / 组织
├── 岗位 / 项目名
└── 原始描述

经历事实
├── 具体动作
├── 工具 / 技术
├── 规模
├── 结果 / 交付
├── 个人贡献
├── 难点
└── 已确认事实
```

已保存经历支持再次编辑，不需要删除后重新录入。

---

### 3. HR 风格 AI 追问

CareerVault 不会一次丢给用户一大串 STAR 表格。

它采用**一次只问一个最有价值的问题**的方式，例如：

> 你说“负责公众号运营”，具体做得最多的是选题、文案、排版、发布还是数据分析？

> 大概发布过多少篇？记不清准确数字也可以回答范围。

> 这项工作是你独立完成、主要负责、共同完成，还是辅助参与？

系统会动态判断下一步最值得补什么，而不是机械地按固定顺序提问。

支持：

- 快捷回答；
- 自由输入；
- “不知道 / 记不清 / 没有统计”；
- 跳过问题；
- 多事实自动提取；
- 模糊事实二次确认；
- 经历信息完整度提示。

---

### 4. Vibe Coding / AI Coding 工作区导入

对于 Codex、Claude Code、Cursor、Windsurf、ChatGPT Work 等 AI Coding 项目，CareerVault 提供一段可复制 Prompt。

用户可以把 Prompt 发回原项目工作区，让真正能看到仓库、Git 历史、代码和测试的 AI 自动整理：

- 项目目标；
- 用户真实负责的部分；
- 主要功能；
- 技术栈；
- 调试 / 集成 / 测试工作；
- 关键技术决策；
- 可验证成果；
- 工作区无法判断、仍需要本人回答的问题。

工作区输出标准 `CAREERVAULT_IMPORT_V1` JSON，粘贴回 CareerVault 即可导入经历库。

这样可以避免对一个复杂项目重新从头口述。

---

### 5. 奖项 / 证书库

支持：

- 手动录入；
- 上传奖状 / 证书图片；
- GPT 图片识别；
- 自动提取名称、颁发方、日期、等级等信息；
- 自动判断简历使用价值；
- 信息不足时继续追问；
- 已保存奖项 / 证书再次编辑；
- 更换图片后重新识别和评估。

系统关注的不只是“这是什么奖”，还会判断：

> **它到底证明了你什么？**

例如会综合考虑：

- 国际 / 国家 / 省市 / 校级 / 企业 / 行业级别；
- 主办方 / 颁发方；
- 奖项名次或认证等级；
- 是否存在筛选性；
- 与目标岗位的相关性；
- 用户在获奖项目中真正承担了什么。

---

### 6. JD 输入与岗位匹配

JD 支持两种输入方式：

#### 复制粘贴

直接粘贴岗位职责和任职要求。

#### 上传招聘截图

上传招聘平台截图或岗位图片后，由 GPT 视觉模型识别图片中**真实可见的 JD 原文**并自动填入输入框。

识别结果仍可手动修改。

系统不会凭空补写截图里不存在的招聘要求。

---

### 7. JD 驱动的一页简历

一页简历必须基于目标岗位 JD 生成。

CareerVault 会：

- 按岗位相关度选择经历；
- 优先保留强证据；
- 删除无关技术细节；
- 每段经历压缩为少量高价值 bullet；
- 避免把 Git 分支、依赖包、构建命令、开发日志整段放入简历；
- 根据岗位重新组织同一段经历的表达角度；
- 根据相关性选择奖项 / 证书；
- 保持一页优先。

简历版式目前采用克制的一页结构，并预留证件照位置。

支持导出真正的 `.docx` Word 文档，可继续在 Word 中编辑。

---

## 数据存储与隐私

CareerVault 采用 **local-first** 设计。

### 默认：IndexedDB

浏览器端数据保存在 IndexedDB：

- 关闭页面后仍保留；
- 关闭浏览器后仍保留；
- 电脑重启后仍保留；
- 不需要注册账号即可使用。

但 IndexedDB 不是永久云盘。清空网站数据、重装浏览器或更换设备仍可能导致数据丢失。

因此 CareerVault 同时支持：

- JSON 完整备份导出；
- JSON 备份恢复。

### 可选：Supabase 云同步

仓库已包含 Supabase 云同步支持和 RLS Schema，可实现：

```text
邮箱 Magic Link 登录
        ↓
用户独立数据空间
        ↓
跨设备同步 / 恢复
```

未配置 Supabase 时不会影响本地使用。

---

## AI 架构

公开前端**不会包含 OpenAI API Key**。

```text
GitHub Pages / Vercel Frontend
              ↓
      Vercel Serverless API
              ↓
       OpenAI Responses API
```

目前服务端 AI 接口包括：

```text
/api/interview   经历采访与事实提取
/api/credential  奖状 / 证书识别与评估
/api/jd          JD 截图识别
```

前端不会每轮重新发送完整可见聊天记录，而是尽量发送当前结构化经历和最新回答，从而降低上下文冗余。

如果远程 AI 暂时不可用，经历库的核心本地规则仍然可以继续工作。

---

## 技术栈

- **Next.js**
- **React**
- **TypeScript**
- **Lucide Icons**
- **IndexedDB**
- **OpenAI Responses API**
- **Vercel Serverless Functions**
- **Supabase（可选云同步）**
- **docx（Word 简历导出）**
- **GitHub Actions**
- **GitHub Pages**

---

## 本地运行

```bash
npm install
npm run dev
```

然后打开：

```text
http://localhost:3000
```

类型检查：

```bash
npm run typecheck
```

生产构建：

```bash
npm run build
```

---

## OpenAI 配置

请**不要**把 OpenAI API Key 写入前端、GitHub 仓库或任何 `NEXT_PUBLIC_*` 变量。

服务端环境变量：

```text
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=your_model_here
ALLOWED_ORIGIN=https://your-frontend-domain
```

推荐把 Key 保存在 Vercel Environment Variables 中。

---

## 部署方式

推荐架构：

```text
Frontend
GitHub Pages

AI Backend
Vercel

Optional Cloud Data
Supabase
```

仓库已经包含 GitHub Actions CI 和 GitHub Pages 静态部署配置。

当前 Vercel 项目：

https://career-vault-sage.vercel.app/

---

## CareerVault 和普通 AI 改简历有什么不同？

| 普通 AI 改简历 | CareerVault |
| --- | --- |
| 从一份现有简历开始 | 从个人长期经历资产开始 |
| 一次性润色 | 经历长期积累、反复复用 |
| 经常直接“优化措辞” | 先追问事实，再决定怎么写 |
| 容易自动补量化结果 | 无依据的数据禁止进入事实库 |
| 一份简历改成另一份 | JD 决定选材和表达 |
| 用户自己重新讲 AI Coding 项目 | 原工作区可直接导出经历事实 |
| 奖项只是文本列表 | 图片识别 + 含金量 + 证明力判断 |
| 输出文本 | 一页简历 + Word 文档 |

---

## 当前状态

CareerVault 目前处于 **V1 持续完善阶段**。

已完成核心闭环：

```text
个人档案
  +
经历 / 项目 / 奖项
  ↓
AI 追问与事实确认
  ↓
职业经历资产库
  ↓
JD 文本 / 图片识别
  ↓
岗位证据匹配
  ↓
一页定制简历
  ↓
Word 导出
```

接下来的重点不是堆更多功能，而是继续提升：

- HR 规则质量；
- 经历追问质量；
- JD 语义匹配；
- 简历 bullet 压缩质量；
- 云同步体验；
- 真实招聘场景下的可靠性。

---

# English

## What is CareerVault?

CareerVault is a **local-first career memory and AI resume tailoring workspace**.

Most AI resume tools start with an existing resume and rewrite it. CareerVault starts earlier:

> **What did you actually do, what can be verified, and what should matter for this specific role?**

Instead of storing only resume wording, CareerVault stores reusable career evidence. The same verified experience can later be reframed for engineering, product, operations, research, or other roles without changing the underlying facts.

---

## The problem

People often forget the useful details behind internships, projects, competitions and campus work. Months later, an experience becomes a vague sentence such as:

> “Worked on CAD drawings.”

or:

> “Helped operate a social media account.”

A generic AI can rewrite those sentences, but it cannot safely invent the missing evidence.

CareerVault therefore treats resume writing as an evidence problem first and a writing problem second.

---

## Core workflow

```text
Real experience
      ↓
HR-style AI interview
      ↓
Verified structured evidence
      ↓
Target job description
      ↓
Evidence-to-role matching
      ↓
Tailored one-page resume
      ↓
Editable Word document
```

---

## Key features

### Personal profile

Store only useful resume information such as contact details, education, major, degree and graduation date.

### Experience Vault

Supports internships, work experience, projects, campus activities, competitions, research, coursework and volunteering.

Each experience can contain structured evidence such as:

- concrete actions;
- tools and technologies;
- scale;
- outcomes and deliverables;
- ownership;
- challenges;
- verified facts.

Saved experiences can be edited at any time.

### HR-style follow-up interview

CareerVault asks **one high-value question at a time** instead of presenting a large STAR form.

It can:

- extract multiple facts from one answer;
- ask for scale, ownership, outcomes or evidence;
- accept approximate answers without forcing fake precision;
- let users skip unknown questions;
- require confirmation before saving inferred or ambiguous claims.

### Vibe Coding / AI Coding workspace import

CareerVault can generate a prompt for Codex, Claude Code, Cursor, Windsurf, ChatGPT Work and similar coding workspaces.

The original workspace can inspect the repository, Git history, tests and implementation details, then return structured `CAREERVAULT_IMPORT_V1` JSON containing:

- project purpose;
- actual user contribution;
- technical decisions;
- implemented features;
- testing / debugging / integration work;
- verifiable results;
- remaining questions that only the user can answer.

This avoids re-explaining a complex AI-assisted project from scratch.

### Awards & Credentials

Users can manually enter an award or upload an image.

CareerVault can:

- read certificate images;
- extract the name, issuer, date and level;
- estimate resume usefulness;
- evaluate what the credential actually proves;
- ask follow-up questions when ownership or significance is unclear;
- edit saved credentials later;
- replace an image and re-run analysis.

### Job Description input

Job descriptions can be added by:

- copy and paste;
- uploading a screenshot or job-posting image.

The vision endpoint extracts only text that is actually visible in the image. The result remains editable before matching.

### JD-driven resume generation

CareerVault does not generate a generic “best resume”.

A target JD is required first.

The system then:

- ranks experiences by relevance;
- selects defensible evidence;
- removes implementation noise;
- compresses each experience into a small number of high-value bullets;
- chooses relevant awards and credentials;
- keeps the resume concise and one-page oriented.

The resume can be exported as a real `.docx` Word document and edited further in Microsoft Word.

---

## AI safety principle

> **Facts are the source of truth. AI may extract, rank and reframe facts, but it must not invent them.**

CareerVault must not fabricate:

- metrics;
- ownership;
- technologies;
- outcomes;
- dates;
- award levels;
- skill proficiency.

Ambiguous or inferred claims stay pending until the user confirms or edits them.

---

## Data & privacy

CareerVault is **local-first**.

By default, browser data is stored in IndexedDB. It survives normal page closes, browser restarts and computer restarts, but it can still be lost when site data is cleared or when switching devices.

Users can therefore export and restore a complete JSON backup.

Optional Supabase cloud sync is supported through magic-link authentication and Row Level Security.

---

## Architecture

```text
GitHub Pages / Vercel frontend
              ↓
      Vercel Serverless API
              ↓
       OpenAI Responses API

Optional persistence
              ↓
           Supabase
```

Server-side AI routes:

```text
/api/interview   experience interviewing and fact extraction
/api/credential  credential image analysis and evaluation
/api/jd          job-description screenshot extraction
```

The OpenAI API key is never exposed to the public frontend.

---

## Tech stack

- Next.js
- React
- TypeScript
- Lucide Icons
- IndexedDB
- OpenAI Responses API
- Vercel Serverless Functions
- Supabase (optional)
- docx
- GitHub Actions
- GitHub Pages

---

## Development

```bash
npm install
npm run dev
```

Type checking:

```bash
npm run typecheck
```

Production build:

```bash
npm run build
```

---

## OpenAI configuration

Never expose an OpenAI API key through client-side code or `NEXT_PUBLIC_*` variables.

Configure the server environment instead:

```text
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=your_model_here
ALLOWED_ORIGIN=https://your-frontend-domain
```

Vercel Environment Variables are the recommended location for these secrets.

---

## Project status

CareerVault is currently in active **V1 development**.

The main end-to-end workflow is already implemented:

```text
Profile
+ Experiences / Projects / Credentials
                ↓
       AI fact interviewing
                ↓
       Career evidence vault
                ↓
     JD text / image extraction
                ↓
       Evidence-role matching
                ↓
       Tailored one-page resume
                ↓
            Word export
```

The next stage focuses on quality rather than feature count: better HR rules, better interviewing, stronger semantic matching, better resume compression and more reliable cloud sync.

---

## License

A license has not yet been selected for this repository. Please review the repository terms before redistributing or incorporating the project into another product.
