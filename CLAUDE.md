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
