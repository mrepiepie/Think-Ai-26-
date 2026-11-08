# Compliance MCP server

An [MCP](https://modelcontextprotocol.io) server built into this Next.js app, at `/api/mcp`. It lets an AI assistant or any MCP client use the same law data, matching engine, product reader and notice drafter as the web app.

- **Transport:** Streamable HTTP, stateless (no sessions; `GET` returns 405).
- **Packages:** [`mcp-handler`](https://github.com/vercel/mcp-handler) 2.x (Vercel's adapter for Next.js) with `@modelcontextprotocol/server` 2.x.
- **Code:** route in [`src/app/api/mcp/route.ts`](../src/app/api/mcp/route.ts), tools in [`src/lib/mcp-tools.ts`](../src/lib/mcp-tools.ts), response shapes in [`src/lib/compliance-views.ts`](../src/lib/compliance-views.ts).

> **Not legal advice.** Every tool response ends with that line, including errors.

## Security: local demo only

**The server has no authentication and no rate limiting.** It needs both before any public deployment.

- The route answers **localhost only**. Any other `Host` or `Origin` gets a 403, including on a Vercel deployment and DNS-rebinding attempts from a web page. This protects the Groq key, because `analyze_product` and `draft_notice` spend it.
- To go public: add auth and rate limiting first, then change the allowed hosts in the route.
- All tools are read-only and marked `readOnlyHint: true`. No tool reads files or environment variables, and only `src/lib/groq.ts` reads `GROQ_API_KEY`. Keys don't appear in responses or logs.

## Tools

Only `analyze_product` and `draft_notice` use AI (Groq). Input is validated with zod; bad input returns `isError: true` with a clear message.

The examples below are based on real runs and shortened. AI output varies from run to run.

### `list_laws`

Input: `state?` (USPS code, or `NYC` for the city only; `NY` also lists NYC's law), `status?` (`in-force`, `coming-soon`, `challenged`, `enforcement-paused`).

```json
{ "state": "NY", "status": "coming-soon" }
```

```json
{
  "count": 1,
  "laws": [
    {
      "id": "ny-raise",
      "title": "New York RAISE Act",
      "jurisdiction": "New York",
      "status": ["Coming soon"],
      "effective": "Takes effect Jan 1, 2027",
      "effective_date": "2027-01-01",
      "effective_date_source": "Official law text",
      "official_url": "https://nyassembly.gov/leg/?default_fld=&leg_video=&bn=S08828&term=2025&Summary=Y&Actions=Y&Text=Y",
      "extracted": true
    }
  ]
}
```

### `get_rule_card`

Input: `law_id`. Returns verified items only, and says how many were hidden. A law with no card (Illinois) gets a message instead of items.

```json
{ "law_id": "ny-raise" }
```

```json
{
  "law_id": "ny-raise",
  "title": "New York RAISE Act as amended: Senate Bill S8828 (2025-2026), Chapter 96 of the Laws of 2026, ...",
  "official_url": "https://nyassembly.gov/leg/?...",
  "extracted": true,
  "verified_items": 37,
  "unverified_hidden": 1,
  "message": "1 unverified item was hidden (quote not found in the official text).",
  "coveredParties": ["..."],
  "triggers": ["..."],
  "obligations": [
    {
      "id": "ny-raise/obligations/7",
      "text": "Report any critical safety incident to the office within 72 hours of determination or knowledge.",
      "who": "frontier developer",
      "timing": "within seventy-two hours",
      "quote": "a frontier developer shall report any critical safety incident ...",
      "official_url": "https://nyassembly.gov/leg/?..."
    }
  ],
  "penalties": ["..."],
  "enforcedBy": ["..."],
  "curePeriod": [],
  "effectiveDate": ["..."]
}
```

### `search_laws`

Input: `query` (2 to 200 characters), `law_id?`, `limit?` (1 to 50, default 10). Plain keyword search over verified items, no AI. Every word must match the start of a word, so `disclos` finds "disclosure".

```json
{ "query": "72 hours" }
```

```json
{
  "query": "72 hours",
  "total_matches": 1,
  "matches": [
    {
      "id": "ny-raise/obligations/7",
      "law_id": "ny-raise",
      "law": "New York RAISE Act",
      "type": "obligations",
      "text": "Report any critical safety incident to the office within 72 hours of determination or knowledge.",
      "quote": "a frontier developer shall report any critical safety incident ...",
      "official_url": "https://nyassembly.gov/leg/?..."
    }
  ]
}
```

### `analyze_product` (AI)

Input: `description` (20 to 4,000 characters). Returns a draft profile. Each quote is checked against the description: `found`, `not_found` or `no_quote`. A human should confirm the draft before using it.

```json
{ "description": "Parrotfish Hiring Co. (14 staff) makes ShortlistBot, an AI resume screener that ranks job applicants ..." }
```

```json
{
  "draft_profile": {
    "company_name": { "value": "Parrotfish Hiring Co.", "quote": "Parrotfish Hiring Co.", "quote_check": "found" },
    "role": { "value": "both", "quote": "Parrotfish Hiring Co. (14 staff) makes ShortlistBot, ...", "quote_check": "not_found" },
    "features": [
      { "id": "resume_screening", "label": "Resume screening", "status": "yes", "quote": "AI resume screener", "quote_check": "found" }
    ],
    "jurisdictions": [
      { "code": "NYC", "name": "New York City", "status": "yes", "quote": "New York City", "quote_check": "found" }
    ],
    "is_government": "no",
    "notes": []
  },
  "unknown_fields": [],
  "human_review": "This is an AI draft. A human should confirm every field and resolve anything unknown, then pass the confirmed profile to check_product."
}
```

### `check_product`

Input: `profile`, a confirmed profile. Runs the matching engine, no AI. Status assumes nothing is done yet, since MCP has no checkboxes, and it never says you comply. Laws that don't apply return a law-level reason and a duty count.

```json
{
  "profile": {
    "role": "both",
    "features": ["resume_screening", "automated_employment_decision", "uses_location_or_zip"],
    "jurisdictions": ["NYC", "IL", "CO", "TX"],
    "isGovernment": false
  }
}
```

```json
{
  "as_of": "2026-11-08",
  "note": "Status assumes no duty has been done yet: ...",
  "jurisdictions": [
    {
      "key": "NYC",
      "name": "New York City",
      "status": "Action needed now",
      "needs_review_count": 0,
      "laws": [
        {
          "law_id": "nyc-ll144",
          "status": "Action needed now",
          "applies": true,
          "reason": "Covers: Employers and employment agencies using an automated employment decision tool in New York City",
          "applicable": [
            {
              "id": "nyc-ll144/obligations/0",
              "text": "Tool must have a bias audit completed within one year before its use.",
              "who": "employer or employment agency",
              "timing": "no more than one year prior to the use",
              "in_force": true,
              "effective_date": "2023-01-01",
              "effective_date_source": "Official law text",
              "quote": "...",
              "official_url": "https://legistar.council.nyc.gov/...",
              "can_draft_notice": false
            }
          ],
          "needs_review": [],
          "doesnt_apply": [],
          "unverified_hidden": 0
        }
      ]
    }
  ],
  "no_tracked_laws": []
}
```

Results for this profile:

| Jurisdiction | Status | Applies | Needs review | Doesn't apply |
|---|---|---|---|---|
| New York City (LL144) | Action needed now | 5 | 0 | 0 |
| Illinois (HB 3773) | Action needed now | 3 (from PRD summary, no quotes) | 0 | 0 |
| Texas (TRAIGA) | Action needed now | 5 | 5 | 35 |
| Colorado (SB 26-189) | Action needed by Jan 1, 2027 | 10 | 7 | 9 |
| New York State (RAISE) | Not applicable | 0 | 0 | 17 |

### `draft_notice` (AI)

Input: `law_id`, `profile`. The server re-runs matching, gives the AI only the verified quotes of notice duties that apply, and returns the whole draft at once. If no such duty applies, it returns an error.

```json
{ "law_id": "nyc-ll144", "profile": { "role": "both", "features": ["resume_screening"], "jurisdictions": ["NYC"], "isGovernment": false } }
```

```text
DRAFT - not legal advice - review with a lawyer

[Company name] will use [Product name] to screen resumes and make automated employment decisions for candidates residing in New York City [Q2]. ...

Quotes relied on: Q2, Q3

---
Verified quotes from the official text (NYC Local Law 144):
[Q1] "..."
[Q2] "..."

Not legal advice.
```

### Errors

Rate limits and other Groq failures use the same handling as the web app and come back as `isError: true`:

```text
Error: The AI service is busy (rate limit). Try again in 7 seconds. (retry_after_seconds: 7)

Not legal advice.
```

## Test it

Start the app first: `npm run dev`. The AI tools need `GROQ_API_KEY` in `.env.local`.

### MCP Inspector

The Inspector's own Node requirement is `^22.23.4`, `^24.22.1` or `>=26.12.1`.

**UI:** run `npx @modelcontextprotocol/inspector@latest`, open `http://127.0.0.1:6274`, choose **Streamable HTTP**, enter `http://localhost:3000/api/mcp` and connect. Paste the session token printed in the terminal if asked.

**CLI:**

```bash
npx @modelcontextprotocol/inspector@latest --cli --transport http \
  --server-url http://localhost:3000/api/mcp --method tools/list --format json

npx @modelcontextprotocol/inspector@latest --cli --transport http \
  --server-url http://localhost:3000/api/mcp --method tools/call \
  --tool-name search_laws --tool-args-json '{"query":"72 hours"}' --format json
```

## Connect Claude Code

```bash
claude mcp add --transport http compliance http://localhost:3000/api/mcp
```

This adds it for you in the current project. Use `--scope user` for all your projects, or `--scope project` to share it through `.mcp.json`. The dev server must be running when you use it. Run `/mcp` inside Claude Code to check the connection.
