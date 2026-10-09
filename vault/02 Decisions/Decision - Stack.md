---
tags: [decision]
date: 2026-10-08
status: accepted
---
# Decision: Tech stack

Built by one person with Claude, target 1–2 months to real families.

| Part | Pick | Why |
|---|---|---|
| App | Next.js + TypeScript | One codebase front + back |
| Data + auth | Supabase (Postgres) | Auth, DB, row-level security in one |
| Tutor brain | Claude API | Talk, explain, re-explain |
| Voice | Cloud STT + TTS vendor | Browser speech is weak for kids; vendor must not keep kid audio (COPPA) |
| Hosting | Vercel | Push = live |
| Email | Resend (custom SMTP for Supabase Auth) | Owner's choice, 2026-10-09; sign its data processing agreement |

Open: which speech vendor (pick in a later section).

Related: [[Decision - Approach]], [[Decision - Platform]]
