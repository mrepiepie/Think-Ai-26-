# State AI Law Compliance Mapper

**Which state AI laws apply to my product, and what do I have to do?** Describe your AI product in plain English and get a per-state checklist built from the official law text, plus a draft notice that cites the law word for word.

ThinkAI'26 · Team Monster · US assignment
*Working title. The final name is still to be decided.*

> **Not legal advice.** This is a hackathon prototype. Always check with a lawyer.

---

## The problem

The US has no single federal AI law, so every state writes its own. A business selling everywhere has to follow all of them at once, the same way it handles sales tax.

- **The volume is large and growing.** In 2025, lawmakers in all 50 states introduced 1,208 AI bills and enacted about 145. That is nearly double 2024 (635 introduced, 99 enacted). [MultiState](https://www.multistate.ai/artificial-intelligence-ai-legislation)
- **It keeps accelerating.** By March 2026, 45 states had already introduced 1,561 AI bills, more than in all of 2024. [ai2.work](https://ai2.work/blog/state-ai-bills-surge-past-1-500-as-congress-remains-deadlocked)
- **Federal action doesn't remove the duty.** Executive Order 14365 (Dec 11, 2025) set up a DOJ task force to challenge state AI laws. An executive order can't override state law by itself, so companies must keep complying until a court blocks a law. [Law and the Workplace](https://www.lawandtheworkplace.com/2026/04/what-president-trumps-ai-executive-order-14365-means-for-employers/)
- **The rules move under your feet.** Colorado's original AI Act (SB 24-205) never took effect: it was delayed, challenged in court, then repealed and replaced by SB 26-189, which takes effect Jan 1, 2027. [Security Boulevard](https://securityboulevard.com/2026/11/us-state-ai-laws-in-force-what-an-enterprise-deployer-actually-owes/)

## Personas

| Persona | Question they ask | Screen |
|---|---|---|
| **Small company** (priority) | "Which AI rules apply to me, in which states, and what must I do?" | Product reader, compliance map, checklist, notice drafter |
| **Citizen** | "Is a data center near me raising my bills, and what can I do?" | Data center watchdog map |
| **State AG investigator** | "Which companies may be breaking state AI or data laws, and what evidence do we have?" | Complaints feed, flagged companies, cross-state table, case file |

## What works today vs. roadmap

### ✅ Working (real data, real AI)
- **Law library from official sources.** Official text is saved for 7 of the 8 tracked laws, from state legislature and city council sites (see [Data sources](#data-sources-and-attribution)).
- **AI law reader with quotes checked in code.** Groq turns each law into a structured "rule card": who is covered, triggers, duties, penalties, enforcement, cure period and effective dates.
  - Every item carries an exact quote, which is then checked against the official text in code.
  - Extracted so far: **7 laws, 309 items, 299 verified, 10 failed.** Failed items are never shown as facts.

  | Law | Items | Verified | Failed |
  |---|---|---|---|
  | NYC Local Law 144 | 10 | 10 | 0 |
  | California SB 243 | 15 | 14 | 1 |
  | California AB 2013 | 4 | 4 | 0 |
  | Texas TRAIGA (HB 149) | 89 | 86 | 3 |
  | Colorado SB 26-189 | 62 | 59 | 3 |
  | California SB 53 | 91 | 89 | 2 |
  | New York RAISE Act | 38 | 37 | 1 |

- **AI product reader.** It turns a free-text product description into a profile:
  - company name, if the description states it (used in drafts);
  - role (developer, deployer or both);
  - features from a fixed list of 9;
  - US states plus NYC;
  - whether the company is a government agency.

  Anything unclear comes back as "unknown", and the user confirms everything with toggle chips before matching runs.
- **Matching engine (no AI).** Hand-reviewed applicability rules for each law. Every duty is sorted by who it is addressed to: **applies to you**, **needs review** or **doesn't apply** (always with a reason). Covered by unit tests.
- **Streamed notice drafter.** Drafts a notice for any law with a notice or disclosure duty that applies to you. It streams word by word over plain HTTP, has Stop and Copy, cites `[Qn]` quotes and uses `[placeholders]` for unknowns.
- **Law change alerts and upcoming deadlines.** Built from a reviewed list of dated events, each linked to its source and checked against the official text or PRD section 3 by a test. Lines about your product are computed from the match result.
- **Map and globe UI.** States are colored by computed status. NYC has its own pin and never colors New York State.
- **Compliance MCP server.** Six read-only tools for AI assistants at `/api/mcp`. Local demo only (see [MCP](#mcp)).
- **Legislature Watch.** An on-demand check of whether each official page still matches our saved copy, from the checklist or an MCP server. Only 2 of 8 laws can really be compared today, because the other sites block or don't answer automated requests (see [Legislature Watch](#legislature-watch)).

### 🧪 Sample data (UI built, data is placeholder)
- Citizen screen (data center watchdog)
- AG investigator screen

### 🗺️ Roadmap
- Extract **Illinois HB 3773**. It has no official text saved yet, because the official site refused automated download. Until then it uses PRD facts only and is marked "Rules not extracted yet".
- An "All states" map layer covering all 50 states.
- RAG "Ask the law": questions answered from the official text.
- Live data center news for the citizen screen.

## How it works

```
 Official law text (data/laws/*.txt)
          │
          ▼
 AI law reader (Groq, offline script)  ──►  rule cards: duties, who, timing, quote
          │
          ▼
 Quote verification in CODE  ──►  only quotes found word for word in the law are facts
          │
 ─────────┼──────────────────────────────── in the app ─────────────────────────
          │
 Product description ──► AI product reader ──► user confirms profile (chips)
          │                                              │
          ▼                                              ▼
 Matching engine (plain code, no AI): law rules + duty addressee rules
          │
          ▼
 Checklist per state / NYC: applies · needs review · doesn't apply (with reason)
 Status from your ticks: Action needed now · Action needed by <date> · All confirmed
          │
          ▼
 AI notice draft, streamed: built ONLY from verified quotes, cites [Q1], [Q2]…
```

## Why you can trust it

- **Quotes are checked in code, not by the AI.** A rule-card item only counts as a fact if its quote is found word for word in the official text. Failed items are hidden and counted ("N more… not verified").
- **Matching is plain, tested code.** It uses a small, reviewed table of law rules plus keyword rules for who each duty addresses. Each law rule lists the rule-card items it relies on, and a test fails if any of them goes missing or unverified. Tests cover:
  - the example company;
  - a government agency;
  - a frontier model developer;
  - a California companion chatbot for minors;
  - a delivery app that uses location data;
  - NYC versus New York State.
- **Nothing is silently dropped.** Duties we can't place go into "Needs review", never into "applies" or "hidden". Every duty that doesn't apply says why (for example "Applies to government agencies").
- **Drafts cite only verified quotes.** The server re-runs matching and sends the AI only the verified quotes for that law's notice duties, plus the confirmed profile. Every draft starts with "DRAFT - not legal advice - review with a lawyer". The UI marks which quotes were cited.
- **The status labels say only what we know.** We never say "compliant". Status reflects only which duties you have ticked:
  - **Action needed now**: an unticked duty is already in force.
  - **Action needed by \<date\>**: only future duties are unticked.
  - **All confirmed**: every duty that applies is ticked.
- **Every item links to the official law text** through "Read the law".

## Tech stack

- **Next.js 16.4.5** (App Router, Route Handlers for the API), React 19, **TypeScript**
- **Tailwind CSS v4** and **shadcn/ui**, with lucide icons
- **d3-geo** with topojson for the flat map and globe
- **Groq** (OpenAI-compatible API). Model names live in `GROQ_MODELS` in [`src/lib/groq.ts`](src/lib/groq.ts):

  | Model | Used for |
  |---|---|
  | `openai/gpt-oss-120b` | Law reader (offline script): strict JSON schema extraction of rule cards |
  | `openai/gpt-oss-20b` | Product reader (live): strict JSON schema profile |
  | `qwen/qwen3.8-27b` | Notice drafter (live): plain text streaming. This is a Groq preview model; the fallback is `openai/gpt-oss-20b` |

- **zod** for schemas (also sent to Groq as JSON Schema) and request validation
- **node:test** with `tsx` for unit tests (no extra test framework)
- **Deploy target:** Vercel

## Getting started

**Prerequisites:** Node.js 20.9 or newer, npm, and a [Groq API key](https://console.groq.com/keys).

```bash
npm install
cp .env.example .env.local      # then put your own key in .env.local
npm run dev                     # http://localhost:3000
```

`.env.local` must contain:

```
GROQ_API_KEY=your-key-here
```

> **Never commit your key.** `.env.local` is git-ignored. Only `.env.example` (empty) is in the repo. On Vercel, set `GROQ_API_KEY` in the project's environment variables.

**Try it:** open the Small Company screen and click **Load example**, then **Analyze**, then **Run matching**. Click a state or the NYC pin, tick duties, and click **Draft notice**.

**Other commands:**

```bash
npm test                 # matching engine unit tests
npm run lint             # ESLint
npm run build            # production build

npm run extract-laws                     # re-run the law reader for every law in data/laws/sources.json
npm run extract-laws -- ca-sb53          # one law (or several ids); other laws' cards are kept
npm run extract-laws -- --no-cache       # ignore cached chunk results
```

The law reader caches each chunk's reply in `.cache/extract-laws/`. If it stops on a rate limit, run the same command again and it resumes where it left off. Output goes to `src/data/generated/rule-cards.json`.

## MCP

The app includes a read-only MCP server at `http://localhost:3000/api/mcp`, with tools to list and search laws, read rule cards, analyze a product, check a profile and draft a notice. To connect Claude Code while `npm run dev` is running:

```bash
claude mcp add --transport http compliance http://localhost:3000/api/mcp
```

**It has no authentication or rate limiting, so it answers localhost only.** It needs both before any public deployment. Tools, examples and testing steps are in [docs/mcp.md](docs/mcp.md).

## Legislature Watch

Compares each official law page with our saved copy, only when asked. Use the **Check official source** button on a law in the checklist, or the second MCP server:

```bash
claude mcp add --transport http legislature-watch http://localhost:3000/api/watch/mcp
```

Each check returns `unchanged`, `changed`, `unreachable`, `blocked` or `no-baseline`, and is added to an append-only log in `data/watch/`. A change shows the raw diff and a labelled AI summary of that diff. **Law text and rule cards are never updated automatically:** after reviewing a change, re-run the law reader.

- **Coverage is limited.** It respects `robots.txt` and never gets around a block, so most sites can't be compared today.
- **Local only.** The check route and MCP server have no auth or rate limiting, so they answer localhost only.
- **Vercel needs a database.** Its file system isn't persistent, so a deployed version needs a database or KV store for the log.

Details, including per-site results and limits, are in [docs/legislature-watch.md](docs/legislature-watch.md).

## Project structure

```
data/laws/                    Official law texts (.txt) + sources.json (URLs, publisher, fetch date)
data/watch/                   Legislature Watch check log (append-only, local only)
docs/prd.txt                  Product requirements: the source of truth for facts and scope
scripts/extract-laws.ts       AI law reader: law text → verified rule cards
src/app/api/product-reader/   POST: description → draft profile (Groq, structured output)
src/app/api/draft-notice/     POST: law + profile → streamed notice draft (Groq, text stream)
src/app/api/mcp/              Compliance MCP server (local only; see docs/mcp.md)
src/app/api/watch/            Legislature Watch: MCP server and check route (local only), status route
src/data/generated/           rule-cards.json written by the law reader
src/data/laws.ts              The 8 tracked laws (facts from the PRD)
src/data/law-library.ts       Official sources + verified rule-card access
src/lib/matching.ts           Matching engine: law rules, duty classification, status (no AI)
src/lib/matching.test.ts      Unit tests for the matching engine
src/lib/product-reader.ts     AI product reader (web route and MCP)
src/lib/notice-draft.ts       AI notice drafter (web route and MCP)
src/lib/mcp-tools.ts          MCP tool definitions
src/lib/compliance-views.ts   What the MCP tools return (no AI), with tests
src/lib/groq.ts               Groq client: model config, retries, rate limits, streaming
src/lib/quote-verify.ts       Checks that a quote appears in the official text
src/lib/legislature-watch.ts  Official page checks: robots, fetch, diff, AI summary of the diff
src/lib/law-text.ts           Page text extraction, per-source cleaning and hashing
src/lib/product-profile.ts    Feature list and zod schemas for the product profile
src/components/dashboard/     Persona screens, map/globe, checklist, notice drafter
public/geo/                   Map data (US states/counties, world countries)
```

## Data sources and attribution

**Official law texts** (fetched Nov 7, 2026, unless noted):
- NYC Local Law 144 of 2021: [New York City Council (Legistar)](https://legistar.council.nyc.gov/View.ashx?M=F&ID=10369162&GUID=F25C6911-8267-48AF-9048-180D44091624)
- Illinois HB 3773 (Public Act 103-0804): [Illinois General Assembly](https://ilga.gov/Legislation/publicacts/view/103-0804). *Not fetched: the site refused automated download.*
- Texas HB 149 (TRAIGA): [Texas Legislature Online](https://capitol.texas.gov/tlodocs/89R/billtext/html/HB00149F.htm)
- Colorado SB 26-189: [Colorado General Assembly](https://leg.colorado.gov/laws/session-laws/SB26-189/131/download)
- California SB 243: [California Legislative Information](https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202520260SB243)
- California AB 2013: [California Legislative Information](https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202320240AB2013)
- California SB 53: [California Legislative Information](https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202520260SB53)
- New York RAISE Act (S8828, Chapter 96 of 2026): [New York State Assembly](https://nyassembly.gov/leg/?default_fld=&leg_video=&bn=S08828&term=2025&Summary=Y&Actions=Y&Text=Y)

**Background facts:** the verified sources in [`docs/prd.txt`](docs/prd.txt) section 3.

**Map data:**
- US states and counties: US Census Bureau, via [us-atlas](https://github.com/topojson/us-atlas).
- World countries: [Natural Earth](https://www.naturalearthdata.com/) admin-0 boundaries, India point-of-view.

## Limitations

- **Only 8 laws are tracked, and 7 are extracted.** Illinois uses PRD summaries only, so it has no quotes and no draft button.
- **SB 53's effective date comes from the PRD** and is labelled "From PRD summary", because the official text doesn't state it. RAISE's date comes from the official text (chapter 96, section 3), verified by a test.
- **"Large frontier developer" duties in SB 53 and RAISE stay in "Needs review".** They only bind developers with over $500M in revenue, and the profile doesn't ask for revenue.
- **The MCP servers have no auth or rate limiting,** so they answer localhost only.
- **Duty ids are positions in `rule-cards.json`.** Re-running the law reader can shift them; the tests catch this.
- **The addressee rules are keyword-based.** Unusual wording lands in "Needs review" rather than being guessed.
- **The product reader can misread a description.** That is why the user confirms the profile before matching.
- **Ticked duties are not saved.** Checkbox state lives in the browser and is lost on reload.
- **Groq free-tier limits apply** (for example 8K tokens per minute per model). The drafter runs on a preview model.
- **The NYC text is the enacted local law.** Later Admin Code amendments, if any, are not included.
- **"All confirmed" only means you ticked every duty.** It does not mean you comply with the law.

## Not legal advice

This tool helps you find and read the rules that may apply to your AI product. It is not legal advice, does not create a lawyer-client relationship, and may be incomplete or out of date: laws change often (Colorado's AI law was replaced before it ever took effect). Always read the linked official text and review your obligations with a qualified lawyer.

## Team

Team Monster: [names]
