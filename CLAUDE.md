# CLAUDE.md

## Project
State AI Law Compliance Mapper (working title), ThinkAI'26, Team Monster.

- **The PRD is the source of truth: [docs/prd.txt](docs/prd.txt).** Read it before doing any feature work.
- **Deploy target: Vercel.**
- **LLM: Groq**, with the key in `GROQ_API_KEY`. See `.env.example`.

## Stack
Next.js (App Router, TypeScript, `src/` directory), Tailwind CSS v4, shadcn/ui (components in `src/components/ui/`), ESLint, npm.
This Next.js version has breaking changes from older versions. See [AGENTS.md](AGENTS.md) and `node_modules/next/dist/docs/`.

## Rules (always apply)
- Work only inside `C:\Users\coolp\OneDrive\Desktop\ThinkAi\ThinkAI-compliance-mapper`.
- Never read, change or reuse anything in `..\ThinkAITariffs`.
- Never commit, never run `git init`, never push. The user handles git.
- Never read or print the contents of `.env` or `.env.local` (or any `.env*.local`). Only `.env.example` may be read or edited.

## Commands
- `npm run dev` starts the dev server at http://localhost:3000
- `npm run build` makes a production build
- `npm run lint` runs ESLint
- `npm test` runs the tests (node:test via tsx)
- `npm run extract-laws -- <law-id>` re-runs the Groq law reader for one law (cached chunks are reused)

## Where things live
- Official law texts: `data/laws/*.txt`, with official URLs in `data/laws/sources.json`
- AI rule cards (quotes verified in code): `src/data/generated/rule-cards.json`
- Law reader script: `scripts/extract-laws.ts`; quote checking: `src/lib/quote-verify.ts`
- Groq client and model config: `src/lib/groq.ts`
- Product reader: `src/lib/product-profile.ts`, `src/lib/product-reader.ts` and `src/app/api/product-reader/`
- Confirm step (questions from code, not AI): `src/lib/confirm-questions.ts`
- Matching engine (plain code, no AI) and its reviewed law table: `src/lib/matching.ts`, tests in `src/lib/matching.test.ts`
- Law events (reviewed, sourced) and computed alerts/deadlines: `src/data/law-events.ts`, `src/lib/law-alerts.ts`, tests in `src/lib/law-alerts.test.ts`
- Notice drafter: `src/lib/notice.ts`, `src/lib/notice-draft.ts` and `src/app/api/draft-notice/`
- Compliance MCP server: `src/app/api/mcp/route.ts` and `src/lib/mcp-tools.ts`; docs in `docs/mcp.md`
- `.cache/` holds Groq extraction caches (git-ignored)

## Data and honesty rules (always apply)
- Law facts come only from official law text (verified quotes) or PRD section 3. Never invent laws, dates, penalties or quotes.
- Only verified rule-card items are shown as duties. Unverified items stay hidden and counted.
- "Enforced by", "Penalty" and "Cure period" use the hand-reviewed `reviewedFacts` in `src/lib/matching.ts`, not the AI's rule-card items. Each quote is tested against the law text; "not stated" lines are tested by checking the text is silent.
- Matching stays plain code with tests. Don't move legal decisions into the AI.
- Never show "Compliant" or "Non-compliant". Use "Action needed now", "Action needed by <date>", "All confirmed", "Review needed".
- Sample or placeholder content is labelled "Sample data". Never invent quotes from real, named people. Fictional companies only on the investigator screen.
- Every AI-drafted document starts with "DRAFT - not legal advice - review with a lawyer" and cites only verified quotes as [Qn].
- The MCP server is localhost-only and unauthenticated. Keep it that way unless auth and rate limiting are added.
- Groq free tier has daily token limits: don't run the law reader in loops; make sure no background process is left running.