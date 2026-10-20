# Brightling AI: app design prompt

Prepared October 19, 2026 from the project documentation, Obsidian vault, and current application code.

Copy the prompt below into a design tool or give it to a product designer. It is self-contained, so the receiving tool does not need repository access. This is a design brief, not an instruction to deploy or change the application.

## Context reconciled with the current code

- The current product name is **Brightling AI**. Older documents use **Math Friend** or **Adaptive AI Tutor**. **Nova** is the tutor character, not the product name or a child avatar.
- The current code includes explicit session completion and a separate Play again action. Earlier descriptions of automatic session rollover are historical.
- Parent progress screens already exist, even though early scope documents excluded a parent dashboard. Redesign the existing family experience rather than proposing a school administration product.
- Hints on demand, interactive manipulatives, a child progress journey, richer completion feedback, and delayed retention indicators are proposed improvements. Keep them visibly separate in design deliverables from the current product.
- The privacy and consent documents contain draft language and unresolved review questions. Preserve their status and action meanings; visual design must not introduce legal certifications or promises.

---

## Copyable design prompt

Act as a senior product designer creating a polished, accessible app experience for **Brightling AI**, a personal early-math tutor for children and their parents. Create a cohesive visual system and connected screen designs, including realistic content, interaction states, and responsive layouts.

### Product and audience

Brightling AI helps children build confidence in math through short practice sessions with **Nova**, a warm, patient robot tutor. Practice adapts to the child's knowledge and offers different ways of explaining a problem.

There are two audiences:

- **Children aged 5–7:** early readers who need spoken instructions, pictures, large touch targets, and very few decisions per screen.
- **Children aged 8–11 practicing foundational skills:** more independent readers who can use a number pad. Give them a respectful experience that does not feel like a preschool activity.
- **Parents:** adults using shared tablets and phones to sign in, give consent, add children, understand progress, and manage their family's data.

The implemented curriculum contains 33 skills across eight clusters: counting to 20, comparing numbers, addition within 10, subtraction within 10, addition and subtraction within 20, tens and ones, addition and subtraction within 100, and word problems. It covers K–2 foundations and can serve older children with gaps. Describe that scope accurately.

The desired outcome is that children understand what to do, receive useful support, finish with a sense of accomplishment, and want to return. Parents should understand what their child is learning and how to help.

### Creative direction: one classroom, two complementary spaces

Develop the established visual identity into a more refined product:

**Child experience: a tactile green felt math workspace.** Use the material language of classroom counters, ten-frames, number lines, and base-ten blocks. Make the mathematical objects the most prominent visual element. Use warm cream controls, clear numerals, generous spacing, restrained texture, and subtle physical depth.

**Parent experience: a quiet math exercise book.** Use warm paper, faint square-grid lines, simple index cards, colored tabs, and small cube motifs. Maintain a relationship to the child's workspace through the same green, cream, ink, and Nova character. Parent screens should feel calm, organized, and easy to read.

Aim for a crafted, welcoming learning tool with a recognizable identity. Let the classroom materials provide character. Avoid visual clutter, elaborate scenes, stock photos, glossy 3D mascots, glass effects, neon gradients, and decorative math symbols scattered behind content.

Refine hierarchy, spacing, shape, and finish freely within this direction. Do not change the product into a generic analytics dashboard or a marketing landing page.

### Starting palette and typography

Use these existing colors as the foundation, documenting any accessibility-driven adjustments:

| Role | Color |
| --- | --- |
| Felt green | `#2E6B5E` |
| Deep green | `#23544A` |
| Chalk | `#F4F7F2` |
| Cream answer tray | `#FBFAF5` |
| Dark ink | `#1E2B28` |
| Red counter | `#E4413B` |
| Yellow counter | `#F6C531` |
| Blue math cube | `#3B7DD8` |
| Parent paper | `#F6F8F5` |
| Parent grid | `#DBE6EE` |
| Quiet parent text | `#4D5C58` |
| Parent link | `#2A64B8` |
| Destructive parent action | `#C3332D` |

Red counters represent mathematical quantities, not failure. In the parent area, reserve destructive red styling for deletion actions. Do not use color alone to communicate status.

Use **Andika** for child text, numerals, and shared headings. Use **Atkinson Hyperlegible** for parent body text. Keep sentence case, recognizable numerals, clear punctuation, and comfortable line spacing.

Starting child type scale: 22, 28, 40, and 64 px. Tutor text is approximately 28 px for younger children and 22 px for older children. Starting parent scale: 17 px body, 15 px secondary text, 32 px main heading, and 21 px section headings. Adjust responsively while preserving readability.

### Nova

Preserve Nova's identity: a small round cream robot, dark face panel, expressive eyes, short antenna with a yellow light, and a blue body detail. Create consistent calm, curious, and cheerful expressions. Nova should feel patient and approachable.

Nova introduces problems, encourages thinking, explains, and celebrates progress. Keep the math visually dominant. Tapping Nova replays the spoken line; make that affordance discoverable. Use one brief celebratory movement after success, with a reduced-motion equivalent.

Do not introduce an open-ended chat feed, emotional dependency language, or a sad or disappointed mascot response to mistakes.

### Current child screens and behavior

**1. Child picker**

Heading: “Who's playing?” Show large avatar-and-name tiles. Existing avatar choices are fox, bear, owl, frog, duck, rabbit, cat, and turtle. Include a quiet “Grown-ups” entry. Provide an empty state leading the adult to add the first child. Children do not create accounts or enter passwords.

**2. Main practice screen**

Design first at **1024 × 768 landscape**, then **768 × 1024 portrait**. Both tablet layouts should fit the primary learning task without page scrolling or clipped controls.

Use three clear regions:

- A compact tutor region with Nova, a left-aligned speech bubble, replay affordance, and a low-emphasis “I'm done for now” action.
- A large central felt board containing one problem, its mathematical representation, and a short prompt.
- A cream answer tray with two or four large choices, or a numeric keypad, plus an optional microphone.

Make child answer buttons, keypad keys, microphone, and voice-confirmation controls at least **88 × 88 px**, normally with **16 px gaps**. The number pad contains 0–9, Delete, and OK, with a clearly visible entry and disabled submission when empty.

Illustrate every supported representation: grouped objects, ten-frames, number lines, tens-and-ones blocks, equations with a missing number, and illustrated word problems. Mathematical quantities must be exact and countable. Include dense examples such as 20 objects and two-digit place value without overcrowding the board.

Use a coherent example sequence: “What is 3 plus 4?” with three red counters and four yellow counters; answer choices 5, 7, 8, and 6; then a supportive retry or success state. In a hint state, keep the total unstated. In a final explanation state, show how the groups make 7.

**3. Feedback and retry states**

Show correct-answer feedback, a first incorrect attempt with support, a second attempt, and a final explanation after two unsuccessful tries. Preserve enough context to associate feedback with the problem it describes. Do not combine feedback about one problem with an unrelated visual in a confusing way.

Use supportive language such as “Let's try another way.” Avoid “Wrong,” “Easy,” “Failed,” harsh error marks, or public comparisons. Keep Nova's lines brief: at most 25 words for younger children and 40 for older children.

**4. Speech states**

Provide designs for idle, listening, processing, “I heard: twelve,” and “Did you say 12?” with large Yes and No controls. Recording starts only after the child taps the mic and stops automatically. Visually distinguish listening from processing using labels or shapes as well as color.

When listening starts, Nova stops speaking. Tapping an answer remains a valid alternative. Include microphone permission denied, no speech detected, speech failure, and speech-disabled layouts. Keep visible text alongside spoken content. Do not add an always-listening interaction.

**5. Session completion**

Show “Great work today!”, the number of problems, and the number right on the first try. Give “Play again” and “Back to kids” clear, balanced treatment. Ending is a successful outcome.

The existing completion behavior retains the end card for the rest of the New York calendar day. Reopening it that day shows the same summary; Play again explicitly starts another session. A later-day visit starts fresh. Do not imply that an adaptive session contains a fixed number of questions unless the product provides that information.

**6. Loading and connection recovery**

Design initial loading, answer submission with locked inputs, reconnecting with the current problem retained, final connection failure, and an actionable retry. Avoid claiming an answer has been saved until confirmed. Maintain a stable layout during transitions.

### Current parent screens

Design parent screens at **390 × 844** and **1024 × 768**, with layouts that also work at **320 px width**. Parent pages may scroll vertically. Use a readable centered column, approximately 560 px wide where appropriate, with left-aligned content and clear navigation.

Include:

1. **Sign in:** Brightling AI identity, Nova, email field, “Email me a sign-in link,” “No password to remember,” expired-link and deleted-account messages.
2. **Check your email:** simple confirmation and next instruction.
3. **Set or enter a parent PIN:** a four-digit field, labels, validation, lockout, and recovery states. This is the shared-device grown-up gate.
4. **Consent:** “One step before your child plays,” readable notice summary, full-notice link, required guardian acknowledgment, and the existing verification action. Preserve the visible draft-review banner wherever applicable.
5. **Privacy notice:** readable sections, clear hierarchy, version information, and a return path.
6. **Your kids:** avatar, name, grade, last-played label, Add a child, and Account and privacy. Include no-consent and no-children states.
7. **Add a child:** first name or nickname, grade, and eight avatar options with clear selected and focus states. Collect no additional child information.
8. **Child's week:** sessions, minutes, days practiced, skills mastered, current focus, difficult areas, and session history. Use restrained cube or calendar motifs with explicit text labels. Show a useful empty week. Keep data download and deletion accessible without competing with progress.
9. **Account and privacy:** explain data-management actions, provide privacy access, and preserve explicit confirmation before deletion. Child deletion requires typing the child's name; account deletion requires typing DELETE.
10. **Weekly report email:** a mobile-readable companion using the same visual language, with a section per child, progress, current difficulty, and a short home activity.

Use fictional sample data such as Mia, Kindergarten, four sessions and 38 minutes this week. Ensure names, quantities, dates, and summaries are internally consistent across connected screens. Clearly label sample data in the design handoff.

The hierarchy should help parents answer: What improved? What is still difficult? What can we try together for two minutes? Avoid technical mastery probabilities, internal mistake tags, or unsupported learning-gain claims.

### Proposed improvements: separate concept frames

Create a separately labeled “Proposed improvements” section. These concepts are not all supported by the current application:

- **Help me:** a large, accessible action offering a small hint, then a more explicit visual demonstration. Distinguish assisted practice from independent success in parent-facing concepts.
- **Matched explanation visuals:** show the same problem represented with counters, a ten-frame, or a number line as Nova changes explanation. Support comprehension without automatically printing the answer during an initial hint.
- **Interactive making ten:** demonstrate a child filling a ten-frame with counters. Include tap-to-place, reset or undo, and an equivalent keyboard interaction. Dragging must not be the only way to complete it.
- **Personal progress journey:** a small set of meaningful skill milestones, with a next step and a modest celebration. Keep the main practice screen focused. Avoid streak-loss penalties, leaderboards, endless reward loops, and competitive comparisons.
- **Richer completion:** one specific supported achievement and an optional next-visit preview, without pressure to continue.
- **Delayed checks:** a plain-language indication of skills demonstrated again on a later visit. Keep it distinct from an initial placement estimate.

A child may know addition but need help with subtraction. Progress concepts should accommodate uneven strengths rather than implying all skills follow one linear level. Treat future confidence and retention labels as proposed data requirements, not values already available from the application.

### Accessibility and interaction requirements

- Strong text and control contrast; validate actual combinations rather than assuming every palette pairing works.
- Visible keyboard focus and complete keyboard access.
- Text labels and accessible descriptions for mathematical visuals and icon controls.
- A touch alternative to dragging; an answer alternative to speech.
- Reduced-motion treatment for every animated state.
- Reading order that follows tutor instruction, problem, then answers.
- No hover-only instructions or essential interactions.
- Layouts that accommodate long names, larger text, dense representations, and unavailable audio.
- Stable placement of primary controls and no surprise movement while answering.
- Plain, supportive US English and minimal child-facing chrome.

### Product boundaries

Keep the experience centered on practice and family progress. Do not add pricing, subscriptions, advertising, public profiles, school administration, social features, an open chat interface, or unsupported curriculum as core screens.

Preserve the existing consent-before-child-profile flow and parent gate. Do not invent legal approval badges, claim verified regulatory compliance, remove a draft notice, or rewrite the meaning of consent and data actions. Legal text is supplied content awaiting the project's review process.

### Deliverables

Produce:

1. A concise visual rationale tied to learning, readability, and parent trust.
2. A compact design system: semantic colors, typography, spacing, radii, shadows, icons, mathematical object styles, and Nova expressions.
3. Reusable components with default, pressed, focus, disabled, loading, selected, success, and error variants where applicable.
4. Connected high-fidelity child and parent screens at the requested sizes.
5. An interaction prototype covering child selection → problem → answer → support or success → completion → explicit play again; and parent sign-in → consent → profile → weekly progress.
6. Annotated speech, network, empty, validation, and destructive-action states.
7. Separate proposed-feature frames, with their additional interaction and data requirements identified.
8. A practical handoff covering responsive rules, accessible labels, transition timing, and which components can be shared across the two experiences.

Prioritize the main child practice screen, its support state, and a parent's weekly summary first. Carry the chosen system through the remaining screens. Deliver a consistent app design rather than unrelated attractive mockups.

If generating prototype code, use the existing Next.js App Router, React, TypeScript, CSS Modules, and SVG approach. Preserve routes, server behavior, grading, progression, and data boundaries. Use local fixture data for demonstrations and identify simulated functionality. Do not introduce external tracking or replace backend logic as part of visual work.

### Final design quality check

The work is ready for review when a child can identify the problem and answer controls immediately, Nova's instructions match the visible math, a mistake leads to understandable support, finishing feels complete, and a parent can understand the child's week without interpreting internal metrics. Every screen should belong to the same Brightling AI product.
