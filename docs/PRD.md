# CareerVault V1 Product Requirements

## Product idea

CareerVault is not a generic resume writer. It is a personal career memory system that stores verified experiences once and reuses them for different opportunities.

The V1 promise is simple:

> Tell CareerVault what you actually did. CareerVault helps you remember the missing details, chooses the most relevant evidence for a job, and turns it into a concise one-page resume without inventing facts.

## Target users

Primary users:

- university students applying for internships or graduate roles;
- early-career professionals who repeatedly tailor resumes;
- users with scattered project, campus, research, competition, volunteer, and work experiences.

## V1 scope

V1 contains only six user-facing capabilities.

### 1. Personal profile

Capture only reusable resume basics:

- name;
- email;
- phone;
- target city;
- school;
- major;
- degree;
- graduation date.

The first-use flow should stay lightweight. CareerVault must not force users to complete their entire history before receiving value.

### 2. Experience library

Users can save reusable experience cards for internships, work, projects, campus roles, competitions, research, coursework, and volunteer work.

Each card separates:

- raw description;
- actions;
- tools/methods;
- outcomes;
- verified facts.

### 3. AI-guided experience enrichment

The system should identify missing information and ask concise follow-up questions rather than rewriting vague input immediately.

Good follow-up areas include:

- what the user personally did;
- tools and methods used;
- scale and scope;
- difficulties solved;
- outcomes and deliverables;
- numbers that the user can actually verify.

V1 includes a deterministic local question generator so the flow works before a model provider is connected.

### 4. Paste job description

The user pastes a JD into one field. V1 intentionally avoids job crawling and automatic application workflows.

### 5. Job-to-experience matching

The system ranks saved experiences by relevance to the JD and shows which terms matched.

V1 uses transparent keyword matching. A later semantic matcher can replace it without changing the Experience data model.

The product should avoid a fake universal “ATS score”. It should describe relevance and evidence coverage instead.

### 6. One-page resume

CareerVault selects the most relevant experiences and creates a concise one-page preview from verified data.

V1 does not include dozens of templates, PDF export, cover letters, interview coaching, job tracking, or automatic applications.

## Product rules

### Facts are immutable source material

AI can change wording, emphasis, ordering, and selection. It must not silently change the underlying facts.

### No invented metrics

If a result is not known, CareerVault asks the user. It must not invent percentages, user counts, revenue, efficiency improvements, leadership ownership, technologies, awards, or responsibilities.

### Show why content was selected

The product should make job-to-experience matching understandable instead of hiding it behind an unexplained score.

### Low-friction first use

A user should be able to create a basic profile, add one experience, paste one JD, and see a resume draft in a single session.

## Out of scope for V1

- job board search;
- automatic applications;
- application CRM;
- video mock interviews;
- salary analysis;
- social/community features;
- dozens of resume templates;
- cover letters;
- portfolio hosting;
- automated public-profile scraping.

These may be considered only after the six-function loop is proven useful.
