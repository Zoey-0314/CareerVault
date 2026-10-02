# CareerVault P1 — Job application workflow

This batch is based on recurring real-world job-search pain points: applicants lose track of which resume version was sent to which company, job descriptions disappear after postings close, and interview preparation becomes disconnected from the exact JD/resume pair the interviewer received.

Design rule: CareerVault is not becoming a generic job board. The job workspace exists to preserve continuity between career facts, one target role, the exact resume snapshot used for that target, and later interview preparation.

Minimum application record:
- company + role
- saved JD snapshot (not only a URL)
- source URL (optional)
- application channel
- status
- application date
- immutable resume-version link once submitted
- one-line notes / next action

A target may be edited before submission. A resume version is an immutable snapshot once saved. Marking a target as applied requires a saved resume version so CareerVault never loses the answer to “what exactly did I send them?”.
