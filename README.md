# CareerVault

> **Tell your story once. Tailor it for every opportunity.**  
> **经历认真整理一次，此后围绕真实事实，针对不同岗位选材、改写、投递和准备面试。**

CareerVault 是一个 **local-first 的职业经历资产库 + AI 求职工作台**。

它不是从“一份已经写好的简历”开始，而是先保存你真正做过的事情、个人贡献、证据和边界，再把这些事实用于岗位匹配、定制简历、投递版本留档和面试准备。

CareerVault is a **local-first career evidence vault and AI-assisted job application workspace**. It stores defensible career facts first, then uses them to tailor resumes, preserve submitted versions, and prepare for interviews without inventing achievements.

**正式入口 / Primary app:** https://career-vault-sage.vercel.app/

GitHub Pages 仅作为静态镜像。由于浏览器 IndexedDB 按域名隔离，GitHub Pages 与 Vercel 的本地数据不会自动共享。

---

# 中文说明

## 1. CareerVault 解决什么问题？

很多求职工具默认你已经有一份完整简历，但真实情况往往是：

- 项目、实习、比赛结束几个月后，具体细节已经忘了；
- 只记得“参与开发”“负责运营”，却说不清本人真正做了什么；
- AI 很容易为了让简历“更好看”自动补数字、夸大 ownership；
- 同一段经历投不同岗位时，需要重新选择重点；
- AI Coding / Vibe Coding 项目里，代码可能大量由 AI 辅助生成，但本人仍做了需求、审查、调试、集成、测试或验收，需要把边界说清；
- 奖状、证书、聘书很多，不知道哪些值得写，也容易把“识别准确度”和“简历价值”混为一谈；
- 同时投多个岗位后，容易忘记“这家公司收到的是哪一版简历”；
- 面试前真正需要准备的是对方看到的那份简历和当时的 JD，而不是今天已经改过的主经历库。

CareerVault 把流程拆成：

```text
真实经历 / 奖项证据
        ↓
AI 追问与结构化
        ↓
职业事实资产库
        ↓
目标岗位 + JD 快照
        ↓
语义匹配与事实约束简历
        ↓
ResumeVersion 投递快照
        ↓
基于实际投递版的面试准备
        ↓
面试复盘（不反向伪造成新成果）
```

---

## 2. 核心原则

### Facts are the source of truth

AI 可以帮助提取、追问、排序、压缩和改写，但不能替用户创造事实。

CareerVault 明确禁止把没有依据的信息包装进简历，例如：

- 没统计过的百分比；
- 不存在的用户量或性能提升；
- 把“参与”改成“主导”；
- 没使用过的技术；
- 没有发生过的项目结果；
- AI 生成的代码被包装成本人独立编写。

### Resume is an output, not the database

长期保存的是经历事实，而不是某一份简历话术。同一段经历可以针对不同岗位用不同角度表达，但底层事实不变。

### AI participation is an internal truth boundary

Experience V3 将 AI 参与拆成：

- `aiContribution`：AI 做了什么；
- `userContribution`：本人决定、审查、修改、调试、集成、测试或验证了什么；
- `interviewPrep`：正式面试前必须准备解释的问题和薄弱点。

这些内部信息不会因为存在于 CareerVault 就自动进入简历正文。

---

## 3. 已实现功能

### 3.1 个人档案

保存简历真正需要的基础信息：姓名、邮箱、电话、求职城市、学校、专业、学历和毕业时间。

默认不强制收集年龄、性别、身高、详细住址等低价值或敏感字段。

### 3.2 Experience V3 经历库

支持实习、工作、项目、校园经历、比赛、科研、课程设计和志愿经历。

一段经历不再只是一个文本框，而是分成：

```text
基础信息
├── 时间
├── 公司 / 组织
├── 岗位 / 项目名
└── 原始描述

可用于简历的事实
├── 具体动作
├── 工具 / 技术
├── 结果 / 交付
├── 规模 / 范围
├── 个人贡献 / ownership
├── 难点与处理
└── 证据 / 可追溯材料

内部真实性信息
├── 是否 AI 辅助
├── AI 做了什么
├── 本人做了什么
└── 面试准备 / 薄弱点 / 复习主题
```

旧版 `verifiedFacts[]` 数据会继续兼容并迁移，不要求用户重新录入。

### 3.3 HR 风格 AI 追问

CareerVault 不给用户一次性扔一整份 STAR 表，而是根据现有事实判断“下一条最值得问什么”。

系统支持：

- 一次只问一个高价值问题；
- 快捷回答与自由输入；
- “不知道 / 记不清 / 没有统计”；
- 重复问题检测；
- 多事实提取；
- 模糊内容二次确认；
- AI 参与边界追问；
- 面试准备项沉淀；
- 调用失败时明确报错，不把本地规则伪装成远程 AI。

### 3.4 Vibe Coding / AI Coding 工作区导入

CareerVault 可以生成一段 `CAREERVAULT_IMPORT_V1` Prompt，让真正能访问原代码仓库 / 工作区的 AI 读取 README、代码、Git 历史、测试和配置，并输出可验证事实。

它要求区分：

- AI 生成了什么；
- 用户做了什么需求定义、架构决策、提示词设计、调试、集成、测试、验收和文档；
- 哪些信息工作区无法确认，需要本人继续回答。

### 3.5 奖项 / 证书 / 聘书

支持手动录入和图片识别。

图片识别采用多阶段流程：

```text
原图全文转录
    ↓
关键字段视觉复核
    ↓
结构化提取与职业价值判断
```

重点字段包括名称、颁发/主办/聘任单位、日期、奖级/名次/认证等级/职位任期等。

不同类型的材料会使用不同字段提示，例如：

- 证书：发证机构、认证/考试等级；
- 竞赛：赛事主办方、奖级/名次；
- 荣誉：评选单位、荣誉称号；
- 聘书/任命书：出具/聘任单位、职位/任期。

系统同时区分两个概念：

- **识别置信度**：图片字段是否读得可靠；
- **简历价值**：这项材料是否值得放进目标简历。

二者不是同一个分数。

> PDF 是否可直接送入模型取决于当前 AI Provider。当前 DeepSeek 部署主要使用图片视觉输入；不支持时前端会要求先将 PDF 转成图片，而不是假装已经识别。

### 3.6 岗位库 / JobTarget

CareerVault 不再只有一个会被覆盖的 JD。

每个 `JobTarget` 可以保存：

- 公司；
- 岗位名称；
- JD 原文快照；
- 招聘链接；
- 投递渠道；
- 优先级；
- 当前阶段；
- 投递日期；
- 下一步；
- 简短备注。

保存 JD 原文是为了避免招聘链接下架后，面试前无法恢复当时的岗位要求。

### 3.7 JD 语义匹配

本地规则先进行快速关键词/证据匹配，AI 定制阶段再进行语义重排，因此不要求经历和 JD 使用完全相同的词。

AI 仍只能从经历库中存在的事实进行选材。

### 3.8 Grounded AI Resume

一页简历必须先有目标岗位。

AI 简历写作不是自由生成：每条 bullet 都必须引用 CareerVault 中真实存在的 `fact ID`。服务端会拒绝：

- 不存在的事实引用；
- 来源事实里没有的新数字；
- 没有 ownership 证据却写出的“独立 / 主导”；
- 把 AI 参与和面试准备直接包装成个人成果。

网页预览和 Word `.docx` 导出使用同一套内容。

### 3.9 ResumeVersion 投递快照

同一岗位可以保存多个简历版本。

一旦标记“已投递”，CareerVault 会锁定实际使用的 `ResumeVersion`。后续即使主经历库、JD 或 AI 改写发生变化，也不会修改历史投递快照。

这使系统能够回答：

> **这家公司当时收到的到底是哪一版？**

### 3.10 面试准备与复盘

面试准备基于：

```text
实际投递 ResumeVersion
+ 当时保存的 JD snapshot
+ 被选中的经历事实
```

而不是基于今天已经修改过的主数据。

AI 只生成：

- 简历 claim 追问；
- JD 匹配追问；
- 技术 / 业务深挖问题；
- 决策与协作问题；
- 需要复习的主题；
- 当前证据缺口。

它不会替用户编“标准答案”。

每轮面试后可以记录实际问题、卡点、讲清楚的内容和下一轮要补什么。复盘会影响下一轮准备优先级，但不会被当作新的简历成果。

### 3.11 求职准备度

Dashboard 不再只统计“填了多少字段”，而是按五个维度判断：

- 基础档案；
- 经历证据；
- 目标岗位；
- 岗位定制简历；
- 投递后的面试准备。

并给出当前最值得完成的下一动作。

---

## 4. 数据存储与隐私

CareerVault 采用 **local-first** 设计。

### IndexedDB

默认业务数据保存在当前浏览器 IndexedDB 中。

证书图片等二进制附件与主 Vault JSON 分开保存到独立的 IndexedDB attachment store，避免几十张图片把主状态记录和普通读写拖得越来越大。

Local-first 的含义是：

- 不注册账号也可以使用；
- 关闭浏览器后数据仍保留；
- 数据默认属于当前浏览器域名；
- 清理网站数据、换浏览器或换设备仍可能丢失。

因此提供 JSON 备份导出 / 恢复。

### Vercel 与 GitHub Pages

推荐正式使用：

```text
https://career-vault-sage.vercel.app/
```

GitHub Pages 是静态镜像。两个域名拥有各自独立的 IndexedDB，本地数据不会自动互相出现。镜像页面会明确提示这一点。

### Supabase（可选）

支持 Magic Link 登录和可选云同步。恢复前会比较本地/云端更新时间，避免无提示覆盖较新的数据。

当前云同步仍以 Vault payload 为中心；本地附件 Blob store 主要解决浏览器主状态膨胀问题，并不等同于已经实现独立云对象存储。

---

## 5. AI Provider 架构

当前部署使用 **DeepSeek**，后端采用 Provider Adapter，不把 API Key 放进前端。

```text
Vercel Frontend / GitHub Pages Mirror
                 ↓
        Vercel Serverless API
                 ↓
           AI Provider Adapter
             ↙         ↘
        DeepSeek      OpenAI-compatible
```

主要 API：

```text
/api/status          Provider / 模型 / 能力状态
/api/interview       经历追问与事实提取
/api/credential      奖项证书图片识别与评估
/api/jd              JD 图片识别
/api/resume          事实约束的语义匹配与简历改写
/api/interview-prep  基于实际投递版本的面试准备
```

推荐的 DeepSeek 环境变量：

```text
AI_PROVIDER=deepseek
AI_API_KEY=your_deepseek_key
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-flash
ALLOWED_ORIGIN=https://your-frontend-domain
```

不要把 `AI_API_KEY` 写入 GitHub、客户端源码或任何 `NEXT_PUBLIC_*` 环境变量。

代码保留 OpenAI-compatible Provider 结构，切换 Provider 不需要重写整个业务层。

---

## 6. 公共部署安全

公开版本包含多层基础保护：

- 浏览器侧每日 AI 操作额度；
- 服务端上游分钟 / 小时级调用上限；
- 相同请求短时间去重；
- 单请求 payload / output token 上限；
- AI 状态和 fallback 明示；
- 删除和覆盖类操作保护。

如果面向大量陌生用户公开，仍建议在 Vercel Firewall 或外部持久化限流服务中增加真正的 IP / 用户级跨实例限流。

---

## 7. 技术栈

- Next.js 16
- React 19
- TypeScript
- Lucide Icons
- IndexedDB
- DeepSeek / OpenAI-compatible Responses API
- Vercel Serverless Functions
- Supabase（可选云同步）
- `docx`（Word 简历）
- Vitest
- GitHub Actions
- GitHub Pages mirror

---

## 8. 本地开发

```bash
npm install
npm run dev
```

默认打开：

```text
http://localhost:3000
```

质量检查：

```bash
npm run typecheck
npm test
npm run build
```

CI 会依次执行 TypeScript 检查、Vitest 单元测试和 Production Build。

---

# English

## What is CareerVault?

CareerVault is a **local-first career evidence vault and AI-assisted job application workspace**.

Most resume tools start from an existing resume. CareerVault starts earlier: it helps you preserve what you actually did, what you personally owned, what evidence exists, and what remains uncertain. Those verified facts can then be reused across multiple job targets without rewriting your history every time.

The product flow is:

```text
Career facts and credentials
          ↓
AI-guided fact completion
          ↓
Structured evidence vault
          ↓
JobTarget + saved JD snapshot
          ↓
Semantic evidence matching
          ↓
Fact-grounded one-page resume
          ↓
Immutable ResumeVersion submitted snapshot
          ↓
Interview preparation from the exact submitted version
          ↓
Interview debrief for the next round
```

## Key principles

**Facts are the source of truth.** AI may rewrite or compress known facts, but it must not invent metrics, technologies, ownership, outcomes, awards, or responsibilities.

**The resume is an output, not the database.** Career history is stored as reusable structured evidence. A single experience can be expressed differently for different JDs without changing the underlying facts.

**AI participation is tracked truthfully.** AI-generated code is not silently presented as independently authored work. CareerVault separates what AI assisted with from what the user personally decided, reviewed, modified, debugged, integrated, tested, or validated.

## Current capabilities

- Local-first personal profile
- Experience V3 structured evidence model
- Adaptive AI HR follow-up
- Vibe Coding / AI Coding workspace import
- Credential and appointment-letter image recognition
- Separate recognition confidence and resume-value assessment
- Multiple `JobTarget` records with frozen JD snapshots
- Semantic JD-to-experience matching
- Grounded resume bullets with fact-ID validation
- Editable one-page preview and real `.docx` export
- Immutable `ResumeVersion` application snapshots
- Interview preparation based on the exact submitted resume and JD
- Interview debrief loop without converting debrief notes into fake achievements
- Explainable job-readiness dashboard
- JSON backup / restore
- Optional Supabase cloud sync
- DeepSeek-first provider adapter with OpenAI-compatible support
- AI usage safeguards and explicit provider/fallback status
- Vitest unit tests in CI

## Data model highlights

### Experience V3

Resume-safe evidence is separated from internal truth and interview preparation:

```text
Experience
├─ actions / tools / outcomes
├─ evidence
│  ├─ scale
│  ├─ ownership
│  ├─ difficulties
│  └─ artifacts
├─ aiContext
│  ├─ assisted
│  ├─ aiContribution
│  └─ userContribution
└─ interviewPrep
   ├─ questions
   ├─ weakPoints
   └─ topicsToReview
```

### Job applications

Each target preserves its own JD and application context. A submitted application references a frozen `ResumeVersion`, so later edits cannot rewrite history.

### Credential attachments

Credential binary data is stored separately from the main IndexedDB Vault record. Runtime previews are hydrated when needed, while the normal structured state remains lightweight.

## AI configuration

Recommended DeepSeek configuration:

```text
AI_PROVIDER=deepseek
AI_API_KEY=your_deepseek_key
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-flash
ALLOWED_ORIGIN=https://your-frontend-domain
```

Never expose the API key through client-side code or `NEXT_PUBLIC_*` variables.

## Deployment

**Primary app:** https://career-vault-sage.vercel.app/

GitHub Pages is maintained as a static mirror. Because IndexedDB is origin-scoped, local data from the Vercel domain does not automatically appear on the GitHub Pages domain.

## Development

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
```

## Status

CareerVault is an actively developed project. The current priority is reliability, truth-preserving AI behavior, clear data ownership, and a coherent workflow from career evidence to a defensible application — not automatic mass application or invented interview answers.

## License

See `LICENSE`.
