# Luke development

Keep Luke agent and startup instructions in this project directory. Martin does
not want agent instruction files placed in his home directory. If a session
starts with the home directory as its working directory, locate this project
before answering a Luke startup request.

## Start here in every new session

- First user-facing step in a new interactive Luke editing session: ask exactly "Er du klar for å starte litt redigering av nettsiden din?" and wait for an affirmative answer before opening apps or starting code work. If the supplied startup prompt explicitly says START-LUKE.command already received that confirmation, do not ask twice or reopen the tabs. This gate concerns starting an editing session, not read-only questions or maintenance of these setup files during the current session.
- After confirmation, prepare apps using `./START-LUKE.command --confirmed` when local execution permits, then read this file, `LES-MEG.md`, and `START-HER.md`, check Git status and summarize readiness. If preparation fails, report the actual missing capability. Startup consent does not authorize SQL, deployment, or a code change by itself.
- Read `LES-MEG.md` before changing code. It contains the Norwegian project handover, user preferences, recent decisions, and verification limits.
- This directory is the main working repository. Inspect `git status`, branch, recent commits, and the actual remote before editing or publishing. Preserve unrelated user changes.
- At the end of substantive work, update the status and handover in `LES-MEG.md` with changes, checks, publication status, any database migrations, and the next step. Distinguish verified results from assumptions and pending work. Never store credentials or tokens there.
- Maintain the handover continuously, not only when coding ends. Record new explicit user preferences, corrections, decisions, changed requirements, discovered constraints, and useful workflow details as they arise. Routine documentation updates are authorized; do not wait for the user to request them again. Revise superseded guidance so the current instructions stay unambiguous, preserve useful dated history, and avoid duplicates or inferred personal traits. Update `AGENTS.md` too when a lasting working rule changes. Read and follow the maintenance section in `LES-MEG.md`.
- Communicate in plain Norwegian Bokmål. The user is new to Terminal: explain where commands go and what they do. Complete authorized practical steps yourself when tools and access allow, except where Martin has chosen to paste the provided code or SQL himself.
- Browser access, authentication, permission settings, and reasoning effort are session-specific. Verify them; do not promise that a future session inherits them or claim a setting changed without evidence.

## Keep browser work economical

- Martin prefers to verify ordinary website appearance and interactions himself. For routine UI and feature changes, work from source files, run relevant local checks, and give him copy-ready code or exact file replacements with clear VS Code paths when he will paste the change. Do not automatically drive Chrome through every screen as a visual test.
- Use Chrome or another browser for Stripe, Supabase, Vercel, authentication, or other external account steps when the task genuinely requires those services and no suitable direct tool is available. Make those visits focused and batch related checks. Browser access is not a reason to repeat tests that Martin can do himself.
- Ask Martin to do the final visual walkthrough of routine website changes, or provide a short checklist. State clearly which checks were local, which were done in external services, and which user-facing behavior remains for him to verify. Perform browser verification yourself only when it is necessary to diagnose a specific issue, establish a critical result, or Martin asks for it.
- Prefer concise, copy-ready SQL for Martin to paste in Supabase when that is his chosen workflow. Handle external configuration directly when he asks or when it is needed to complete the task. Never put secrets in chat, code, or handover files.

## Preserve existing users and data

Existing calendars and recipient progress must survive website deployments.

- Keep calendar IDs, account ownership, invitation tokens, quiz question keys and progress keys stable across releases.
- Preserve the IndexedDB database `luke-advent`, its `workspace` store and existing account/local-storage keys. UI updates must not reset or reseed saved data.
- Keep version 1 calendar documents and older optional fields readable. Changes to stored data need a backward-compatible migration rather than replacement with an empty workspace.
- Never run production data resets or database tests against the live Supabase project. Database tests use isolated PGlite databases.
- Keep `tests/fixtures/existing-workspace-v1.json` as a frozen example of saved user data. Update-compatibility tests must continue to preserve its calendar contents, IDs, opened doors and quiz results.
- Run the relevant tests and production build for UI changes. Changes to persistence, permissions or migrations also require the isolated database tests.
