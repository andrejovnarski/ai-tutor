---
name: codex-task
description: Hand a coding task to Codex and run the full loop — write the task into docs/codex/HANDOFF.md, create the branch, dispatch Codex, review its diff, run all suites, commit, log it. Use whenever the owner wants Codex to code something in adaptive-tutor.
---

# Codex task loop (adaptive-tutor)

Claude is the lead (scopes, reviews, owns git). Codex is the implementer (edits files only).
Codex runs sandboxed: it can edit the workspace but can't write `.git` or use the network, so
**Claude does all git and all Docker/db/e2e runs**. Shared notes: `docs/codex/HANDOFF.md`.

## 1. Scope the task
- If the owner's request is big, split it into tasks Codex can finish in one run (≈ one
  reviewable diff). Ask the owner only about real product decisions (AskUserQuestion,
  recommended option first).
- Fill the template under **Active task** in HANDOFF.md: branch `codex/<slug>`, goal, context
  (spec/plan paths, exact files), Do, Don't, Acceptance. Be concrete: name files and functions.

## 2. Prepare git
- `git status` must be clean apart from known untracked files; don't sweep in the owner's
  untracked work.
- `git switch -c codex/<slug>` from `main`. Commit the HANDOFF.md task text on the branch
  (`docs(codex): T<n> task`).

## 3. Dispatch
- Agent tool, `subagent_type: "codex:codex-rescue"`, `run_in_background` for anything
  bigger than a small fix. Prompt:
  > Write-capable task (--write). Repo /home/andrej/Projects/adaptive-tutor, branch already
  > checked out. Read AGENTS.md and docs/codex/HANDOFF.md, then do task T<n> exactly as
  > written there. Follow every Codex rule. When done, fill the "Codex report" under T<n>
  > in HANDOFF.md and return the same report.
- Fix rounds: same agent type, add "--resume" so Codex keeps its thread; point to the
  "Fix round N" section you wrote under the task.
- Tell the owner in one line what Codex is working on.

## 4. Review (never skip)
- Read `git diff` fully. Check: does it meet Acceptance, stay in scope, follow rules (no new
  child-data logging/storage, no new deps, tests written first)?
- Run yourself: `npm run typecheck`, `npm test`, and when the task touches db/server/UI,
  `echo 'npm run test:db' | newgrp docker` and e2e (prod build on :3001, never touch :3000).
- For non-trivial diffs also get a second opinion: `feature-dev:code-reviewer` agent on the
  branch diff (or `/codex:adversarial-review` if the owner wants Codex to self-check).
- Problems → write "Fix round N" (numbered, specific, file:line) under the task, dispatch again.
  Max 3 rounds; after that fix it yourself or ask the owner.

## 5. Finish
- Commit Codex's changes on the branch with a clear message (+ the attribution trailer).
- Move the task to the **Done log** (branch, commit range, one-line result); reset Active task
  to "_None_". Commit.
- Report to the owner in plain words: what changed, test results, choices Codex made, open
  questions. Ask before merging to `main`; never push (owner pushes from their terminal).
