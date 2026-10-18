# FinanceAI Agent Pack

This pack is intended to guide an AI coding agent working inside your existing FinanceAI repository.

## Files

1. **`MASTER_AGENT_PROMPT.md`** — paste this into the coding agent at the start of a substantial development session. It defines the product, engineering rules, existing functionality to preserve, architecture priorities, testing, security and mandatory documentation updates.
2. **`CONTINUE_PROMPT.md`** — use this when an agent context/session ends or token limits are reached. It instructs the next agent to continue from the recorded checkpoint rather than restarting.
3. **`IMPLEMENTATION_PHASES.md`** — dependency-aware implementation plan with stable feature IDs, acceptance gates, test requirements and global definition of done.
4. **`IMPLEMENTATION_PROGRESS_TEMPLATE.md`** — initial template for the repository's `docs/IMPLEMENTATION_PROGRESS.md`.

## Recommended setup

1. Open the actual FinanceAI repository in your coding agent/IDE.
2. Provide the latest repository state plus the architecture documents (`v2.3`, `v2.2`, `v2.1`, `v2.0`) and `audit.md` if they are not already in the repository.
3. Copy `IMPLEMENTATION_PHASES.md` to `docs/IMPLEMENTATION_PHASES.md`.
4. Copy `IMPLEMENTATION_PROGRESS_TEMPLATE.md` to `docs/IMPLEMENTATION_PROGRESS.md`.
5. Ask the agent to use `MASTER_AGENT_PROMPT.md` and then immediately begin the baseline audit and first implementation slice.
6. Keep `docs/IMPLEMENTATION_PROGRESS.md` inside the repo and under version control; never include secret values or real private financial statements.
7. When resuming, paste `CONTINUE_PROMPT.md` and make sure the agent has access to the same repository checkout and progress file.

## Important operating principle

The current repository and tests determine what is actually implemented. Architecture files describe target behavior. Do not let the agent rewrite working imports or features simply because old documentation claims they are missing. Insist on evidence from tests and actual runs before marking any capability complete.

The initial progress template intentionally labels current-state claims as unverified until the agent validates the active checkout.
