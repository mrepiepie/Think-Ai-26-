# Legislature Watch

Legislature Watch answers one question on demand: **does the official page for a law still match our saved copy?** It runs only when someone asks, through the checklist button or the MCP tools. There is no background polling, and the app never calls it "live".

> **Not legal advice.** A changed page means someone should read it. It doesn't tell you what the change means for you.

## What a check does

1. Reads the site's `robots.txt`, and stops if it asks tools to stay out.
2. Requests the official URL from `data/laws/sources.json`: at most one page request, no retries, a 20-second timeout, a 5 MB limit, and a User-Agent naming this project. Redirects are reported, not followed.
3. Extracts and cleans the text with `src/lib/law-text.ts`.
4. Compares it with `data/laws/<id>.txt` using a hash that ignores spacing, capitals and most punctuation, but keeps `[ ] $ %`. In bill text, brackets mark deleted law.
5. If the text differs, computes a sentence-level diff and asks Groq to summarize **only that diff**. The summary is labelled "AI summary of changes - verify against the official page" and appears next to the raw excerpts.
6. Appends a record to `data/watch/checks.ndjson`.
7. A `changed` result adds a "Text changed" entry to the alerts panel, with an exact excerpt of the new text as evidence.

**It never edits `data/laws/*.txt` or rule cards.** After reviewing a change, update the saved text by hand and re-run the law reader (`npm run extract-laws -- <law-id>`).

## Results

| Status | Meaning |
|---|---|
| `unchanged` | The page's cleaned text matches the saved copy. |
| `changed` | The text differs. Includes the diff, evidence and, if Groq is available, a summary. |
| `unreachable` | Not compared. Comes with the HTTP status or error. Also used if `robots.txt` can't be read (the page isn't requested), and for a 200 response where under half of the saved passages appear, such as a challenge page. That could also be a full rewrite, so check it by hand. |
| `blocked` | Not compared. `robots.txt` disallows the page, or the site answered 403. |
| `no-baseline` | The page was reached, but no saved copy exists to compare with. |

## What it can reach today

As of the check on 8 Nov 2026 from a home connection. **Only 2 of the 8 laws can really be compared.** Results may differ from another network.

| Law | Source behaviour | Result |
|---|---|---|
| NYC Local Law 144 | Word file (`.docx`, labelled `application/msword`). No `robots.txt`. | Compared |
| New York RAISE Act | HTML. `robots.txt` only names GPTBot. | Compared |
| Illinois HB 3773 | Connection times out, including `robots.txt`. No saved copy either. | `unreachable` |
| Texas TRAIGA | `robots.txt` says `Disallow: /TLODOCS/`, and the page is under `/tlodocs/`. | `blocked` (see below) |
| Colorado SB 26-189 | `robots.txt` disallows `/laws/session-laws/*/download`. | `blocked` |
| California SB 243, AB 2013, SB 53 | Cloudflare challenge: `robots.txt` answers 403. | `blocked` |

Nothing here tries to get past a block. Other ways to widen coverage are a source that permits automated access, or asking the site's operator.

## Limits

- **Cleaning is only proven for NYC and New York.** The script that first made `data/laws/*.txt` was never saved, so `law-text.ts` rebuilds that cleaning. Both proven sources reproduce the saved hash exactly from their real pages. The Texas and California profiles have never run against a real page, because those sites refuse us. If one becomes reachable, treat its first `changed` as a possible cleaning problem until a person has looked at the diff.
- **Robots paths compare case-insensitively, which is stricter than RFC 9309.** Read literally, `Disallow: /TLODOCS/` doesn't cover `/tlodocs/`, but the Texas server ignores case, so we treat it as the same folder. The reason is explained in `src/lib/robots.ts`.
- **PDFs aren't parsed.** Colorado is the only PDF source and robots blocks it anyway. A reachable PDF would report `unreachable`.
- **Some punctuation changes are invisible,** such as a comma or a decimal point (`1.5` and `15` hash the same).
- **An unchanged result covers the text at that URL, nothing more.** It can't see a newer version published at a different address, a court ruling, or a later amendment.
- **Page text is untrusted.** The summary prompt treats it as data and the UI shows it as plain text, but an MCP client receives diff excerpts from a web page. They should be read as data, not instructions.

## Vercel: the log needs a database

**Vercel's file system is not persistent,** so the append-only log only works locally. A deployed version needs a database or KV store behind `src/lib/watch-log.ts`. If a write fails, the check still returns its result with `persisted: false`.

The check route and MCP server answer localhost only, so on a deployment the button explains that checks only run on the local app. `GET /api/watch/status` is public but only reads the log and makes no outside requests.

## MCP server

A second MCP server at `http://localhost:3000/api/watch/mcp`, using the same packages as `/api/mcp`.

**It has no authentication and no rate limiting.** It answers localhost only through the same Host/Origin guard (`src/lib/local-only.ts`), and any other Host or Origin gets a 403. Add both before any public deployment.

| Tool | Input | Annotations | What it does |
|---|---|---|---|
| `list_sources` | none | read-only | Official URLs, whether a saved copy exists, and the last result per law. |
| `check_law` | `law_id` | **not read-only**, open world | Runs one check and logs it. May spend Groq tokens. |
| `check_all` | none | **not read-only**, open world | Runs every check in turn with a 1.5-second delay, reading `robots.txt` once per site. Don't run it in a loop. |
| `get_watch_log` | `law_id?`, `limit?` (1 to 200, default 20) | read-only | Past records, newest first. |

Every response ends with "Not legal advice.", including errors.

### Connect it

Start the app with `npm run dev`, then:

```bash
claude mcp add --transport http legislature-watch http://localhost:3000/api/watch/mcp
```

Run `/mcp` inside Claude Code to check the connection. To try it with the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector@latest --cli --transport http \
  --server-url http://localhost:3000/api/watch/mcp --method tools/call \
  --tool-name list_sources --format json
```

## Code

| File | Purpose |
|---|---|
| `src/lib/legislature-watch.ts` | The check itself, the diff and the AI summary. |
| `src/lib/law-text.ts` | Text extraction, per-source cleaning and hashing. |
| `src/lib/robots.ts` | `robots.txt` rules. |
| `src/lib/watch-log.ts` | The append-only log. |
| `src/lib/watch-types.ts` | Shared types, and turning log records into law events. |
| `src/lib/watch-mcp-tools.ts`, `src/app/api/watch/mcp/` | The MCP server. |
| `src/app/api/watch/check/`, `src/app/api/watch/status/` | Routes for the UI. |

Tests are in `src/lib/legislature-watch.test.ts`. They use fixture pages and a fake `fetch`, so `npm test` never touches the network.
