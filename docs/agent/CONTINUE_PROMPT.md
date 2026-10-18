# FinanceAI — Session Continuation / Resume Prompt

You are resuming development on an existing, partially implemented FinanceAI repository. **Do not restart the project or repeat a full audit unless the progress file is missing, stale, or contradicted by the live code.** Continue from the exact durable handoff.

## Read these first, in order

1. `docs/IMPLEMENTATION_PROGRESS.md` — current state, completed work, test evidence, blockers and next task.
2. `docs/IMPLEMENTATION_PHASES.md` — feature IDs, dependency graph, acceptance criteria and phase status.
3. `docs/CODEBASE_AUDIT.md` — code-grounded implementation status and evidence.
4. `docs/ARCHITECTURE_DECISIONS.md` — decisions/conflicts already resolved.
5. Relevant sections of `FinanceAI_Architecture_v2.3(1).md` (primary target), plus v2.2/v2.1/v2.0 and `audit.md` only when needed.
6. The current code and git diff/status for the specific next task.

If the repository uses different paths or renamed documents, locate the actual equivalents and update the progress file rather than assuming.

## Resume protocol

1. Verify the progress file's **Last verified commit/branch**, **Last updated**, **Current phase**, **Current task**, and **Next actions** against the actual repository/git status. Never overwrite local user changes.
2. Re-run only the minimum targeted command needed to confirm the last checkpoint; do not blindly rerun every baseline check if there is no reason.
3. Open the “Exact resume point” file/function/test and the relevant diff. Confirm which previous command last passed and which one is still pending.
4. Select the first unfinished, unblocked item in the “Next actions” list, but re-check its dependencies and actual code before proceeding.
5. Continue the implementation in small end-to-end increments: code + tests + UI/API where needed + docs.
6. If the agent context/token limit is approaching, stop at a safe checkpoint. Do not begin a risky migration or leave an untested half-change merely to use the remaining context.
7. Update `docs/IMPLEMENTATION_PROGRESS.md` throughout, including after test runs and before yielding. Update `docs/IMPLEMENTATION_PHASES.md` only when phase/feature status actually changes.
8. At the end, provide a concise handoff with files changed, actual commands/results, remaining issues and the next exact starting point.

## Rules that still apply

- The live code, database/migration history, current user requirement and tests are the source of truth for current implementation status. Architecture documents describe target behavior; they are not proof that code exists.
- v2.3 is the preferred target architecture; earlier architecture versions and the FinBoom audit are supporting references.
- Preserve the functioning app, especially existing Groww/INDmoney import flows, auth/demo behavior, and financial data. Add regression tests before modifying these.
- Never say a feature/test is complete unless there is evidence. Use `DONE_TESTED`, `DONE_UNVERIFIED`, `IN_PROGRESS`, `BLOCKED`, `NOT_STARTED`, or `DEFERRED` statuses consistently.
- Never put credentials, `.env` values, raw statement content, PAN, account numbers or identifying financial data in logs, progress files or prompts.
- Every data access/mutation must stay authorized and user-scoped. Provider errors must not overwrite a last-known-good market price.
- Financial computations must remain deterministic and tested; LLMs explain, not calculate authoritative financial values.
- Do not introduce a new provider, paid service, large dependency, database reset, broad refactor or destructive migration without need and a documented plan.
- Before altering schema/data: inspect existing columns and rows, plan backup/backfill/rollback, and verify all consuming service/UI types.
- Don't call external market APIs on every portfolio render; refresh should be intentional/cached and report stale/failure states honestly.

## If the progress file is missing or unusable

Do not guess. Perform a focused repository audit of `package.json`, `prisma/schema.prisma`, migration history, `src/services/`, `src/adapters/`, `app/api/`, tests, git status and README. Recreate `docs/CODEBASE_AUDIT.md`, `docs/IMPLEMENTATION_PHASES.md`, `docs/IMPLEMENTATION_PROGRESS.md` and `docs/ARCHITECTURE_DECISIONS.md` from the current checkout, preserving existing user edits. Mark anything not reverified as `UNVERIFIED`.

## End-of-session checkpoint format

Update the progress file with:
- current branch/commit and timestamp;
- active phase and task ID;
- files created/modified and a one-line purpose each;
- exact commands executed and their actual pass/fail/blocked result;
- last verified passing checkpoint;
- outstanding failures/blockers and why;
- next 3–7 prioritized actions;
- **exact first file/function/test to open next**;
- a warning for any incomplete migration or uncommitted work.

Then summarize the handoff. Continue now from the first unfinished safe task recorded in `docs/IMPLEMENTATION_PROGRESS.md`.
