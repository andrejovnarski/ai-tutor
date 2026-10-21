---
tags: [roadmap]
status: active
---
# Roadmap

Updated 2026-10-21. Details per feature: `docs/improvements/learning-experience-roadmap.md` and `docs/superpowers/specs/`.

```mermaid
gantt
  title Adaptive AI Tutor
  dateFormat YYYY-MM-DD
  section Design
  Brainstorm + spec         :done, d1, 2026-10-08, 2d
  Implementation plan       :done, d2, after d1, 1d
  section v1 build
  Skill map + problem maker :done, b1, after d2, 10d
  Session engine + kid model:done, b2, after b1, 10d
  Tutor voice (Claude) (done) :done, b4, after b2, 7d
  3a Sign-up + data (done)  :done, b5a, after b2, 7d
  3b Consent + report (done) :done, b5b, after b5a, 7d
  5a Kid play screen (done) :done, b3a, after b4, 7d
  5b Speech (Azure) (done)  :done, b3b, after b3a, 10d
  6 Grown-up screens (done) :done, b6, 2026-10-10, 1d
  section Learning improvements
  Session ending, style on board, wording :done, m1, 2026-10-19, 1d
  Rewards (XP, levels, streaks, stickers) :done, m2, 2026-10-19, 2d
  Placement step cap, Help me, Fill the frame :done, m3, 2026-10-20, 1d
  Progress lines, recall checks :done, m4, 2026-10-20, 1d
  Pocket Planet + grown-up Logbook look :done, m5, 2026-10-21, 1d
  section Pilot
  Playtests with real kids  :active, p0, 2026-10-21, 7d
  Beta with ~10 families    :p1, after p0, 21d
```

BKT defaults: prior 0.2, learn 0.15, slip 0.1; guess from input: 1 ÷ choices, number pad 0.15 (Plan 2).

## Before the beta
- Renew brightling.ai (expires 2026-10-29); verify the Resend mail domain (GoDaddy DNS)
- Push migrations 0009–0010 to hosted Supabase; finish Supabase dashboard steps; Vercel deploy
- Speech on: Azure keys, pre-made audio, DPA + lawyer, real iPad check
- Claude voice on: live eval (~$1.10), retry-board number guard fix, lawyer question on kid speech

## Not built yet
- Placement by skill branch (only a step cap so far)
- Saying "help" to the mic; more interactive objects beyond Fill the frame

## Later (not v1)
- More strands: multiply/divide, fractions, geometry, time, money
- Mood sensing, interest themes
- Parent controls
- Payments
- Native tablet app
- Schools platform, investor data

Related: [[Success Metrics]], [[Design Overview]], [[S1 - Scope v1]]
