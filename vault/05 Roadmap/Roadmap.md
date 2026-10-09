---
tags: [roadmap]
status: draft
---
# Roadmap (draft)

Draft only — real phases come from the implementation plan after the spec is approved.

```mermaid
gantt
  title Adaptive AI Tutor — draft
  dateFormat YYYY-MM-DD
  section Design
  Brainstorm + spec         :done, d1, 2026-10-08, 2d
  Implementation plan       :active, d2, after d1, 3d
  section v1 build
  Skill map + problem maker :done, b1, after d2, 10d
  Session engine + kid model:b2, after b1, 10d
  Kid app + voice           :b3, after d2, 20d
  Tutor voice (Claude)      :b4, after b2, 7d
  Parent sign-up + report   :b5, after b2, 7d
  section Beta
  Pilot with ~10 families   :p1, after b4, 21d
```

## Later (not v1)
- More strands: multiply/divide, fractions, geometry, time, money
- Mood sensing, interest themes
- Parent dashboard + controls
- Payments
- Native tablet app
- Schools platform, investor data

Related: [[Success Metrics]], [[Design Overview]], [[S1 - Scope v1]]
