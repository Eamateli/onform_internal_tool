# Project rule files — read order

1. **`.cursorrules`** — project source of truth (architecture, phases, hard rules). Read this first.
2. **`AGENTS.md`** / **`CLAUDE.md`** — Next.js 16 specific reminders (below).
3. **`Progress.md`** — running log of completed steps.

If `.cursorrules` and this file disagree, `.cursorrules` wins on intent; this file wins on Next.js 16 API specifics.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
