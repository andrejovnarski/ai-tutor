# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: the child.** Ages 5–8 (kindergarten to grade 2). Older children, grades 3–5, are welcome when they need to strengthen their foundations; they start with grade 2 work. The child plays alone on a tablet browser, often before they can read well. They pick their avatar on "Who's playing?" and work through short sessions with Nova: about 10–15 minutes for ages 5–7 and 15–20 minutes for ages 8–11. Their job is to practise maths and feel they are getting better at it.

**Secondary: the parent (the "grown-up").** The parent is the buyer and gatekeeper. They sign up with an email link (often on a phone), read the privacy notice, give COPPA consent by card verification, and add each child (nickname, grade, avatar). They read the weekly email report, check their child's page, and use their data rights. A parent PIN keeps the parent area away from the child.

## Product Purpose

Brightling AI is an early-maths tutor that adapts to each child in real time. The aim is private-school-quality help for any family. v1 covers one strand, number sense through addition and subtraction (counting to 20, comparing numbers, adding and subtracting within 10, 20 and 100, place value, word problems), aligned to Common Core, in US English.

Success for v1 is that children **come back 3 or more times a week without being asked**. The next goals are measurable learning gains, then paid conversion.

## Positioning

- **Code decides, the AI only talks.** Deterministic code grades every answer and chooses what comes next: knowledge tracing, level steps, step-backs, review, and placement. Nova (Claude) only turns a structured turn plan into a short spoken line. Guards stop Nova from saying the answer early, using a number that isn't in the problem, or going past its word limit. If Nova fails, a canned line is used.
- **The teaching style adapts, not just the level.** Nova chooses between number line, blocks, ten-frame, counters and story for each child, using results and mistake tags, and the retry picture on the board matches the explanation (at present for simple sums within 10).
- **Privacy first, for kids.** COPPA consent comes before any child data is collected. No audio is stored, the child's name is never sent to the AI, and there are no ads, data sales or third-party trackers in the kid area.
- **Voice first, for children who can't read yet.** Speech works both ways (Azure STT/TTS through a server-side proxy). Text is always on screen too, and tapping works whenever speech doesn't.

## Operating Context

- Kid flow: "Who's playing?" picker → play screen (problem, SVG maths visual, large tap choices or number pad, mic, Nova's line) → end-of-session summary card. The end card stays for the rest of the day, with "Play again" as an explicit choice.
- Grown-up flow: sign-in / check your email → privacy notice → consent → parent PIN → your kids → child page (played today, this week, progress, sessions, flagged messages, data download) → account (delete, revoke).
- Weekly report email every Sunday. A distress email goes out immediately if a child says something on the trigger list; the child hears a fixed line telling them to talk to a grown-up they trust.
- Two visual worlds are already in use: the kid side is a "felt board", and the grown-up side is an "exercise book" (Plan 6).

## Capabilities and Constraints

- Stack: Next.js 16 + TypeScript, Supabase (Postgres with RLS), Claude API for Nova, Azure AI Speech, Resend for email, Stripe for consent, hosted on Vercel.
- Speech is off by default (`SPEECH` flag). Nova's lines are canned by default until Claude is turned on.
- Terminology: "grown-up" (not "parent" in kid-facing copy), "Nova" (the tutor), "kid" / "child", skill clusters as named in `src/domain/curriculum`.
- Out of scope for v1: multiply/divide, fractions, geometry, time, money; mood sensing; interest themes; payments; a native app; other languages; school features; a landing page.
- Undecided: pricing and how payment works; placement by skill branch (roadmap §5); child-requested help; interactive maths objects; a progress journey; delayed mastery checks.

## Brand Commitments

- Product name **Brightling AI**. Tutor character **Nova**. ("Math Friend" in older specs is out of date.)
- Plain, simple words everywhere: short sentences and everyday words, for children and for grown-ups.
- Nova has one friendly, patient voice. It steers back to the problem and never chats openly.
- Sender identity: "Brightling AI", hello@mail.brightling.ai.

## Evidence on Hand

- One scripted rehearsal on the dev server (a pretend kindergarten child, 2026-10-19). It passed end to end; the main finding was that placement climbs too fast.
- Playtest observation sheet: https://claude.ai/code/artifact/9cacf3e2-37d4-40c5-a36a-44a24b4d4fcc
- Pre-made Nova audio lives in `public/audio/nova/` once generated.
- **None yet:** observed real-child playtests, families in the pilot, testimonials, learning-gain data, press, pricing. Future work must not make any of these up.

## Product Principles

1. **The child comes first.** When the kid experience and grown-up convenience conflict, the kid experience wins, as long as consent and safety are kept.
2. **Code owns the truth.** No design or copy may suggest that the AI grades work or chooses the next skill. The board, the answer and Nova's words must agree.
3. **Usable without reading.** Every kid-facing step must work by listening and tapping, and text is always on screen as well.
4. **Collect less.** Never add a feature, tracker or field that collects child data beyond what the spec lists.
5. **Always end on a win.** Sessions, retries and endings should leave the child wanting to come back. That is the north-star metric.

## Accessibility & Inclusion

- WCAG AA at minimum: 4.5:1 text contrast, tap targets of 44 px or more (larger for kids), and visible focus.
- Text appears on screen next to any audio, and every speech path has a tap fallback.
- Built for tablet browsers first (iPad class). Grown-up pages must also work at 320 px, because parents open the sign-in email on a phone.
- Copy should suit young children and also not feel babyish to older children who are filling gaps.
