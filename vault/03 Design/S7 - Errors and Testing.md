---
tags: [design]
status: approved
date: 2026-10-08
---
# Section 7: Errors and testing

## When things break
| Problem | What happens |
|---|---|
| Tablet loses internet | Server saves after every answer. App retries; kid resumes at the same problem. |
| AI slow or down | Canned line for that event (see [[S5 - Tutor Voice]]). |
| Speech-to-text down | Tap buttons and number pad only. Text always shown on screen. |
| Text-to-speech down | Canned lines have pre-made audio files. Text always shown. |
| Voice misheard | Low confidence on a number → "Did you say 12?" with tap yes/no. |
| Template crashes | Skip to another template for the same skill; log it. |
| Kid model loops (keeps stepping back) | Max 3 step-backs in a row → easy review, end on a win; log it. |
| Kid quits mid-problem | No penalty; problem doesn't count. |

## What we watch (server-side only, no kid names)
- **Sessions per kid per week** (north star, [[Success Metrics]])
- AI time to first word, guard rejects, canned-line rate
- Error logs

## Tests
| Kind | What |
|---|---|
| Unit | Checker, BKT, next-skill picker, style picker (seeded) |
| Property | Every template, 1,000 seeds ([[S3 - Skill Map and Problem Maker]]) |
| **Simulated kids** | Bot kids with known skills and habits (e.g. "knows add within 10, counts off by one") play 200 problems. Checks: placement finds the right spot, step-back works, mastery is reached, ~80% right. |
| AI evals | Turn-plan set; guard rules checked by code; tone spot-read |
| Privacy | No name or audio leaves the server; family A can never read family B (row-level security tests) |
| End-to-end | Tablet-size browser: parent sign-up → consent (Stripe test mode) → kid session → report |
| Real kids | 3–5 kids with a parent present, before beta. Watch, don't help. |

Built test-first (TDD).

Related: [[S4 - Kid Model]], [[S5 - Tutor Voice]], [[S6 - Parent Side and Privacy]]
