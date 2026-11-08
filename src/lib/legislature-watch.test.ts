import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { deflateRawSync } from "node:zlib";
import sources from "../../data/laws/sources.json";
import { buildAlerts, buildDeadlines } from "./law-alerts";
import {
  CLEAN_PROFILES,
  cleanLawText,
  extractLawText,
  hashLawText,
  htmlToText,
  lawBody,
  normalizeForHash,
  UnsupportedFormatError,
} from "./law-text";
import {
  checkAll,
  checkLaw,
  diffPassages,
  pickEvidence,
  summaryPrompt,
  USER_AGENT,
  WATCH_SOURCES,
  watchStatus,
  type WatchDeps,
  type WatchSource,
} from "./legislature-watch";
import { GroqError } from "./groq";
import { normalizeForMatch, verifyQuote } from "./quote-verify";
import { isAllowedByRobots } from "./robots";
import { parseWatchLog } from "./watch-log";
import { latestByLaw, summarizeWatch, watchEvents, type WatchRecord } from "./watch-types";

/* No test here touches the network: every request goes through a fake fetch. */

const SAVED = `Section 1. An employer shall notify each candidate before using an automated tool.

Section 2. A violation is subject to a civil penalty of up to $500.

Section 3. The department shall publish an annual report on enforcement of this law.

Section 4. This act takes effect on January 1, 2027.`;

const page = (text: string) =>
  `<!doctype html><html><head><title>Bill</title><style>p{color:red}</style><script>var x=1</script></head><body>${text
    .split("\n\n")
    .map((p) => `<p>${p}</p>`)
    .join("\n")}</body></html>`;

const CHANGED = SAVED.replace("up to $500", "up to $1,500");
const DELETION_ONLY = SAVED.replace("Section 3. The department shall publish an annual report on enforcement of this law.\n\n", "");
const CHALLENGE_PAGE = "<html><body><h1>Just a moment...</h1><p>Checking your browser before accessing this site.</p></body></html>";

const SOURCE: WatchSource = { id: "test-law", title: "Test Law", url: "https://law.example.gov/bill?id=1", file: "x" };

type FakeResponse = Response | Error;

/** Fake site: routes by URL, and records every request made. */
function site(routes: { robots?: () => FakeResponse; page?: () => FakeResponse }) {
  const requests: { url: string; init: RequestInit | undefined }[] = [];
  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, init });
    const route = url.endsWith("/robots.txt") ? (routes.robots ?? (() => new Response("", { status: 404 }))) : routes.page;
    const out = route ? route() : new Response("", { status: 500 });
    if (out instanceof Error) throw out;
    return out;
  }) as typeof fetch;
  return { fakeFetch, requests };
}

const html = (body: string, status = 200) => new Response(body, { status, headers: { "content-type": "text/html" } });

interface Harness {
  deps: WatchDeps;
  log: WatchRecord[];
  summarized: number;
}

function harness(fakeFetch: typeof fetch, over: Partial<WatchDeps> = {}): Harness {
  const h: Harness = {
    log: [],
    summarized: 0,
    deps: {
      fetch: fakeFetch,
      readSaved: () => SAVED,
      summarize: async () => {
        h.summarized++;
        return "The maximum penalty changed.";
      },
      readLog: async () => h.log,
      appendLog: async (r) => {
        h.log.push(r);
        return true;
      },
      now: () => new Date("2026-11-08T12:00:00Z"),
      sleep: async () => {},
      ...over,
    },
  };
  return h;
}

describe("checkLaw: the five results", () => {
  it("unchanged: re-wrapped lines and curly quotes aren't a change", async () => {
    const rewrapped = SAVED.replace("notify each candidate", "notify  each\n   candidate");
    const { fakeFetch, requests } = site({ page: () => html(page(rewrapped)) });
    const h = harness(fakeFetch);
    const r = await checkLaw(SOURCE, h.deps);
    assert.equal(r.status, "unchanged");
    assert.equal(r.savedHash, r.liveHash);
    assert.equal(r.diff, null);
    assert.equal(h.summarized, 0, "no AI when nothing changed");
    assert.equal(requests.filter((q) => !q.url.endsWith("/robots.txt")).length, 1);
  });

  it("changed: readable diff, exact evidence from the new text, labelled-ready summary", async () => {
    const { fakeFetch } = site({ page: () => html(page(CHANGED)) });
    const h = harness(fakeFetch);
    const r = await checkLaw(SOURCE, h.deps);
    assert.equal(r.status, "changed");
    assert.notEqual(r.savedHash, r.liveHash);
    assert.deepEqual(r.diff?.added, ["Section 2. A violation is subject to a civil penalty of up to $1,500."]);
    assert.deepEqual(r.diff?.removed, ["Section 2. A violation is subject to a civil penalty of up to $500."]);
    assert.equal(r.evidence, "Section 2. A violation is subject to a civil penalty of up to $1,500.");
    assert.ok(verifyQuote(r.evidence!, normalizeForMatch(CHANGED)).verified);
    assert.ok(!verifyQuote(r.evidence!, normalizeForMatch(SAVED)).verified, "evidence is the NEW text");
    assert.equal(r.aiSummary, "The maximum penalty changed.");
  });

  it("changed: a moved bill bracket counts, because brackets mark deleted law", async () => {
    const bracketed = SAVED.replace("up to $500", "up to [$500]");
    const { fakeFetch } = site({ page: () => html(page(bracketed)) });
    assert.equal((await checkLaw(SOURCE, harness(fakeFetch).deps)).status, "changed");
  });

  it("changed, deletion only: evidence is the new text next to the deletion", async () => {
    const { fakeFetch } = site({ page: () => html(page(DELETION_ONLY)) });
    const r = await checkLaw(SOURCE, harness(fakeFetch).deps);
    assert.equal(r.status, "changed");
    assert.equal(r.diff?.addedCount, 0);
    assert.equal(r.diff?.removedCount, 1);
    assert.match(r.evidence!, /^Section 4\./);
    assert.ok(verifyQuote(r.evidence!, normalizeForMatch(DELETION_ONLY)).verified);
  });

  it("unreachable: an HTTP error keeps its status", async () => {
    const { fakeFetch } = site({ page: () => html("gone", 404) });
    const r = await checkLaw(SOURCE, harness(fakeFetch).deps);
    assert.equal(r.status, "unreachable");
    assert.equal(r.httpStatus, 404);
    assert.match(r.reason!, /HTTP 404/);
    assert.equal(r.liveHash, null);
  });

  it("unreachable: a rate limit is reported once, with no retry", async () => {
    const { fakeFetch, requests } = site({ page: () => html("slow down", 429) });
    const r = await checkLaw(SOURCE, harness(fakeFetch).deps);
    assert.equal(r.status, "unreachable");
    assert.equal(r.httpStatus, 429);
    assert.equal(requests.filter((q) => !q.url.endsWith("/robots.txt")).length, 1);
  });

  it("unreachable: a network error or timeout names the error", async () => {
    const timeout = new Error("slow");
    timeout.name = "TimeoutError";
    for (const [err, pattern] of [
      [timeout, /timed out after 20s/],
      [Object.assign(new Error("fetch failed"), { cause: { code: "ECONNRESET" } }), /ECONNRESET/],
    ] as const) {
      const { fakeFetch } = site({ page: () => err });
      const r = await checkLaw(SOURCE, harness(fakeFetch).deps);
      assert.equal(r.status, "unreachable");
      assert.equal(r.httpStatus, null);
      assert.match(r.reason!, pattern);
    }
  });

  it("unreachable: a redirect is reported, not followed", async () => {
    const { fakeFetch, requests } = site({
      page: () => new Response(null, { status: 302, headers: { location: "https://other.example.com/" } }),
    });
    const r = await checkLaw(SOURCE, harness(fakeFetch).deps);
    assert.equal(r.status, "unreachable");
    assert.equal(r.httpStatus, 302);
    assert.match(r.reason!, /other\.example\.com/);
    const pageRequests = requests.filter((q) => !q.url.endsWith("/robots.txt"));
    assert.equal(pageRequests.length, 1);
    assert.equal(pageRequests[0].init?.redirect, "manual");
  });

  it("unreachable, never changed: a 200 challenge page is not a law change", async () => {
    const { fakeFetch } = site({ page: () => html(CHALLENGE_PAGE) });
    const h = harness(fakeFetch);
    const r = await checkLaw(SOURCE, h.deps);
    assert.equal(r.status, "unreachable");
    assert.equal(r.httpStatus, 200);
    assert.match(r.reason!, /no recognisable law text/);
    assert.equal(h.summarized, 0);
    assert.deepEqual(watchEvents(h.log), []);
  });

  it("unreachable: a PDF is reported as unreadable, not guessed at", async () => {
    const { fakeFetch } = site({
      page: () => new Response(Buffer.from("%PDF-1.7 ..."), { headers: { "content-type": "application/pdf" } }),
    });
    const r = await checkLaw(SOURCE, harness(fakeFetch).deps);
    assert.equal(r.status, "unreachable");
    assert.match(r.reason!, /PDF/);
  });

  it("blocked: robots.txt disallows, and the page is never requested", async () => {
    const { fakeFetch, requests } = site({ robots: () => html("User-agent: *\nDisallow: /bill\n"), page: () => html(page(SAVED)) });
    const r = await checkLaw(SOURCE, harness(fakeFetch).deps);
    assert.equal(r.status, "blocked");
    assert.match(r.reason!, /robots\.txt/);
    assert.deepEqual(requests.map((q) => q.url), ["https://law.example.gov/robots.txt"]);
  });

  it("blocked: robots.txt itself refused with a 403, and the page is never requested", async () => {
    const { fakeFetch, requests } = site({ robots: () => html("Just a moment...", 403), page: () => html(page(SAVED)) });
    const r = await checkLaw(SOURCE, harness(fakeFetch).deps);
    assert.equal(r.status, "blocked");
    assert.equal(r.httpStatus, 403);
    assert.equal(requests.length, 1);
  });

  it("blocked: the page answers 403", async () => {
    const { fakeFetch } = site({ page: () => html("denied", 403) });
    const r = await checkLaw(SOURCE, harness(fakeFetch).deps);
    assert.equal(r.status, "blocked");
    assert.equal(r.httpStatus, 403);
  });

  it("unreachable: robots.txt can't be read, so the page is not requested (RFC 9309)", async () => {
    const timeout = new Error("slow");
    timeout.name = "TimeoutError";
    for (const robots of [() => timeout, () => html("oops", 503)]) {
      const { fakeFetch, requests } = site({ robots, page: () => html(page(SAVED)) });
      const r = await checkLaw(SOURCE, harness(fakeFetch).deps);
      assert.equal(r.status, "unreachable");
      assert.equal(requests.length, 1, "only robots.txt was requested");
    }
  });

  it("no-baseline: page reached but nothing saved, and it is never called changed", async () => {
    const { fakeFetch } = site({ page: () => html(page(SAVED)) });
    const h = harness(fakeFetch, { readSaved: () => null });
    const r = await checkLaw(SOURCE, h.deps);
    assert.equal(r.status, "no-baseline");
    assert.equal(r.savedHash, null);
    assert.ok(r.liveHash);
    assert.equal(h.summarized, 0);
  });

  it("identifies itself with a User-Agent naming the project, with a timeout", async () => {
    const { fakeFetch, requests } = site({ page: () => html(page(SAVED)) });
    await checkLaw(SOURCE, harness(fakeFetch).deps);
    assert.match(USER_AGENT, /ThinkAI-compliance-mapper/);
    assert.doesNotMatch(USER_AGENT, /@/);
    for (const q of requests) {
      assert.equal((q.init?.headers as Record<string, string>)["User-Agent"], USER_AGENT);
      assert.ok(q.init?.signal);
    }
  });
});

describe("AI summary", () => {
  it("a Groq failure still reports changed, with the raw diff and the reason", async () => {
    const { fakeFetch } = site({ page: () => html(page(CHANGED)) });
    const h = harness(fakeFetch, {
      summarize: async () => {
        throw new GroqError("rate-limit", "busy");
      },
    });
    const r = await checkLaw(SOURCE, h.deps);
    assert.equal(r.status, "changed");
    assert.equal(r.aiSummary, null);
    assert.match(r.aiSummaryError!, /rate-limit/);
    assert.ok(r.diff?.added.length);
  });

  it("re-checking the same new text reuses the summary instead of spending tokens", async () => {
    const { fakeFetch } = site({ page: () => html(page(CHANGED)) });
    const h = harness(fakeFetch);
    await checkLaw(SOURCE, h.deps);
    const second = await checkLaw(SOURCE, h.deps);
    assert.equal(h.summarized, 1);
    assert.equal(second.aiSummary, "The maximum penalty changed.");
  });

  it("the prompt holds only the diff, not the whole law", () => {
    const prompt = summaryPrompt(SOURCE, { added: ["new words"], removed: ["old words"], addedCount: 1, removedCount: 1 });
    assert.match(prompt, /new words/);
    assert.match(prompt, /old words/);
    assert.doesNotMatch(prompt, /annual report/);
  });

  it("a long diff is cut, and the prompt says so", () => {
    const big = Array.from({ length: 20 }, () => "x".repeat(600));
    assert.match(summaryPrompt(SOURCE, { added: big, removed: [], addedCount: 20, removedCount: 0 }), /list cut short/);
  });
});

describe("the event a change creates", () => {
  it("has the new type, source kind, the official URL and exact new-text evidence", async () => {
    const { fakeFetch } = site({ page: () => html(page(CHANGED)) });
    const h = harness(fakeFetch);
    await checkLaw({ ...SOURCE, id: "ca-sb243" }, h.deps);
    const [event, ...rest] = watchEvents(h.log);
    assert.equal(rest.length, 0);
    assert.equal(event.type, "text-changed");
    assert.equal(event.sourceKind, "Official page check");
    assert.equal(event.lawId, "ca-sb243");
    assert.equal(event.sourceUrl, SOURCE.url);
    assert.equal(event.date, "2026-11-08");
    assert.match(event.description, /Re-run the law reader after review/);
    assert.ok(verifyQuote(event.evidence, normalizeForMatch(CHANGED)).verified);
  });

  it("re-checks don't duplicate it, and new text makes a new one", async () => {
    let body = CHANGED;
    const { fakeFetch } = site({ page: () => html(page(body)) });
    const h = harness(fakeFetch);
    await checkLaw(SOURCE, h.deps);
    await checkLaw(SOURCE, h.deps);
    assert.equal(watchEvents(h.log).length, 1);
    body = SAVED.replace("up to $500", "up to $9,000");
    await checkLaw(SOURCE, h.deps);
    assert.equal(watchEvents(h.log).length, 2);
  });

  it("only a changed record with evidence makes an event", async () => {
    const { fakeFetch } = site({ page: () => html(page(SAVED)) });
    const h = harness(fakeFetch);
    await checkLaw(SOURCE, h.deps);
    assert.deepEqual(watchEvents(h.log), []);
    const r = { ...h.log[0], status: "changed" as const, evidence: null, liveHash: "abc" };
    assert.deepEqual(watchEvents([r]), []);
  });

  it("shows in the alerts panel, but is never UPCOMING and never a deadline", async () => {
    const { fakeFetch } = site({ page: () => html(page(CHANGED)) });
    const h = harness(fakeFetch);
    await checkLaw({ ...SOURCE, id: "ca-sb243" }, h.deps);
    const events = watchEvents(h.log);
    const today = "2026-11-08";
    const alerts = buildAlerts(events, null, new Set(), today);
    assert.equal(alerts.rows.length, 1);
    assert.equal(alerts.rows[0].typeLabel, "Text changed");
    assert.equal(alerts.rows[0].sourceKind, "Official page check");
    assert.equal(alerts.rows[0].upcoming, false, "a check dated today already happened");
    assert.deepEqual(buildDeadlines(events, null, new Set(), today), []);
  });
});

describe("the log and what the code won't touch", () => {
  it("every check appends one record with the required fields", async () => {
    const { fakeFetch } = site({ page: () => html(page(CHANGED)) });
    const h = harness(fakeFetch);
    await checkLaw(SOURCE, h.deps);
    await checkLaw(SOURCE, h.deps);
    assert.equal(h.log.length, 2);
    const r = h.log[0];
    assert.equal(r.lawId, "test-law");
    assert.equal(r.url, SOURCE.url);
    assert.equal(r.checkedAt, "2026-11-08T12:00:00.000Z");
    assert.ok(r.savedHash && r.liveHash && r.diff && r.evidence && r.aiSummary);
  });

  it("a failed log write (e.g. on Vercel) still returns the result, marked unsaved", async () => {
    const { fakeFetch } = site({ page: () => html(page(SAVED)) });
    const r = await checkLaw(SOURCE, harness(fakeFetch, { appendLog: async () => false }).deps);
    assert.equal(r.status, "unchanged");
    assert.equal(r.persisted, false);
  });

  it("reading the log skips a damaged line", () => {
    const good = JSON.stringify({ lawId: "a" });
    assert.equal(parseWatchLog(`${good}\n{broken\n\n${good}\n`).length, 2);
  });

  it("a change leaves data/laws and rule cards alone", async () => {
    const files = [path.join("data", "laws", "ca-sb243.txt"), path.join("src", "data", "generated", "rule-cards.json")];
    const before = files.map((f) => statSync(f).mtimeMs);
    const { fakeFetch } = site({ page: () => html(page(CHANGED)) });
    await checkLaw(SOURCE, harness(fakeFetch).deps);
    assert.deepEqual(files.map((f) => statSync(f).mtimeMs), before);
    for (const file of ["src/lib/legislature-watch.ts", "src/lib/watch-log.ts"]) {
      assert.doesNotMatch(readFileSync(file, "utf8"), /writeFile|data", "laws"|rule-cards/, file);
    }
  });
});

describe("checkAll", () => {
  it("runs every law in turn with a delay, reading robots.txt once per site", async () => {
    const { fakeFetch, requests } = site({ robots: () => html("User-agent: *\nDisallow: /\n") });
    const sleeps: number[] = [];
    const results = await checkAll(harness(fakeFetch, { sleep: async (ms) => void sleeps.push(ms) }).deps);
    assert.equal(results.length, WATCH_SOURCES.length);
    assert.ok(results.every((r) => r.status === "blocked"));
    assert.equal(sleeps.length, WATCH_SOURCES.length - 1);
    const robots = requests.map((q) => q.url);
    assert.equal(robots.length, new Set(robots).size, "no site's robots.txt is read twice");
    assert.ok(robots.length < WATCH_SOURCES.length, "the California laws share a host");
    assert.ok(robots.every((u) => u.endsWith("/robots.txt")), "robots said no, so no page was requested");
  });
});

describe("watchStatus and summary", () => {
  const rec = (lawId: string, status: WatchRecord["status"], checkedAt: string): WatchRecord => ({
    lawId,
    url: "https://x",
    checkedAt,
    status,
    httpStatus: null,
    reason: null,
    savedHash: null,
    liveHash: null,
    diff: null,
    evidence: null,
    aiSummary: null,
    aiSummaryError: null,
  });

  it("uses each law's newest record, and only counts real comparisons as compared", async () => {
    const records = [
      rec("a", "blocked", "2026-11-08T01:00:00Z"),
      rec("a", "unchanged", "2026-11-08T02:00:00Z"),
      rec("b", "unreachable", "2026-11-08T03:00:00Z"),
      rec("c", "no-baseline", "2026-11-08T04:00:00Z"),
    ];
    const latest = latestByLaw(records);
    assert.equal(latest.a.status, "unchanged");
    const summary = summarizeWatch(latest, 8);
    assert.equal(summary.compared, 1);
    assert.equal(summary.total, 8);
    assert.equal(summary.lastCheckedAt, "2026-11-08T04:00:00Z");
    assert.equal(summary.counts.blocked, 0);
  });

  it("no checks: no last-checked date", async () => {
    const status = await watchStatus(async () => []);
    assert.equal(status.summary.lastCheckedAt, null);
    assert.deepEqual(status.events, []);
    assert.equal(status.summary.total, sources.length);
  });
});

describe("diffPassages", () => {
  it("marks only what differs", () => {
    const ops = diffPassages("The first sentence stays here. The second sentence goes here.", "The first sentence stays here. A third sentence comes here.");
    assert.deepEqual(ops.filter((o) => o.kind !== "same").map((o) => [o.kind, o.text]), [
      ["del", "The second sentence goes here."],
      ["add", "A third sentence comes here."],
    ]);
  });
  it("a short addition borrows neighbours until the evidence can be verified", () => {
    const next = "A long enough opening sentence for the law text. Another long enough closing sentence of it. Ok.";
    const ops = diffPassages("A long enough opening sentence for the law text. Another long enough closing sentence of it.", next);
    const evidence = pickEvidence(ops, next)!;
    assert.match(evidence, /closing sentence of it\. Ok\.$/);
    assert.ok(verifyQuote(evidence, normalizeForMatch(next)).verified);
  });
});

describe("cleaning reproduces the saved law text", () => {
  const saved = (id: string) => lawBody(readFileSync(path.join("data", "laws", `${id}.txt`), "utf8"));

  it("cleaning a saved text leaves its hash alone, so no profile cuts real law", () => {
    for (const s of sources.filter((x) => x.file)) {
      assert.equal(hashLawText(cleanLawText(s.id, saved(s.id))), hashLawText(saved(s.id)), s.id);
    }
  });

  it("every law with a saved copy has a known outcome: a profile, or a format we don't parse", () => {
    for (const s of sources) {
      assert.ok(CLEAN_PROFILES[s.id] || ["il-hb3773", "co-sb26-189"].includes(s.id), s.id);
    }
  });

  it("New York: printed-bill page furniture is removed (numbers, page headers, footer)", () => {
    const fixture = `<html><body><p>Summary of the bill</p><h3>S08828 Text:</h3><pre>
<PRE WIDTH="99">
<FONT SIZE=5><B>                STATE OF NEW YORK</B></FONT>

     1    Section 1. Short title. This act shall be known as the frontier law for
     2  develop-
     3  ers of models.

         EXPLANATION--Matter in <B><U>italics</U></B> (underscored) is new; matter in brackets
                              [<B><S> </S></B>] is old law to be omitted.
                                                                   LBD00047-16-6
</PRE><P CLASS="brk"><PRE WIDTH="99">
        S. 8828                             2

     1    &sect; 2. This act shall take effect [<B><S>soon</S></B>] <B><U>now</U></B>.
</pre></pre><a href='#'>Go to top</a><footer>Assembly footer</footer></body></html>`;
    const text = cleanLawText("ny-raise", extractLawText(Buffer.from(fixture), "text/html"));
    assert.equal(
      text,
      "STATE OF NEW YORK\n\nSection 1. Short title. This act shall be known as the frontier law for developers of models.\n\n§ 2. This act shall take effect [soon] now.",
    );
  });

  it("New York: its saved text, printed like the official page, hashes the same", () => {
    const body = saved("ny-raise");
    const printed = body
      .split(/\n\s*\n/)
      .map((para, i) => `${String((i % 45) + 1).padStart(6)}    ${para.replace(/§/g, "&sect;").replace(/&(?!sect;)/g, "&amp;").replace(/</g, "&lt;")}`)
      .join("\n");
    const fixture = `<html><body><p>Summary</p><pre>\n${printed}\n</pre><a>Go to top</a><footer>x</footer></body></html>`;
    const live = cleanLawText("ny-raise", extractLawText(Buffer.from(fixture), "text/html"));
    assert.equal(hashLawText(live), hashLawText(body));
  });

  it("NYC: a Word file sent as application/msword is read by its bytes", () => {
    const docx = zipWith(
      "word/document.xml",
      `<w:document><w:body><w:p w:rsid="1"><w:r><w:t>Int. No. 1894-A</w:t></w:r></w:p><w:p><w:r><w:t>..Title</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">A Local Law &amp; </w:t></w:r><w:r><w:t>its text.</w:t></w:r></w:p><w:p><w:r><w:t>SJ/ IB</w:t></w:r></w:p><w:p><w:r><w:t>LS #11903</w:t></w:r></w:p><w:p><w:r><w:t>11/1/2021 11:32 pm</w:t></w:r></w:p></w:body></w:document>`,
    );
    const text = cleanLawText("nyc-ll144", extractLawText(docx, "application/msword"));
    assert.equal(text, "Int. No. 1894-A\n\nA Local Law & its text.");
  });

  it("a damaged Word file and a binary .doc are errors, not guesses", () => {
    assert.throws(() => extractLawText(Buffer.from("PK\u0003\u0004garbage"), null), UnsupportedFormatError);
    assert.throws(() => extractLawText(Buffer.from("d0cf11e0a1b11ae1", "hex"), null), UnsupportedFormatError);
  });

  it("HTML: scripts and styles go, entities are decoded", () => {
    const text = htmlToText("<head><title>t</title></head><script>a()</script><style>b</style><p>Sec.&nbsp;1 &amp; &#167;2</p>");
    assert.equal(text.trim(), "Sec. 1 & §2");
  });

  it("the hash ignores spacing and quotes, but not brackets, dollars or words", () => {
    assert.equal(normalizeForHash("the  “law’s” text"), normalizeForHash('the "law\'s"\ntext'));
    for (const other of ["[a] b", "$1 b", "a c"]) assert.notEqual(hashLawText("a b"), hashLawText(other));
  });
});

describe("robots.txt", () => {
  const AGENT = "ThinkAI-compliance-mapper";
  const allowed = (txt: string, p: string) => isAllowedByRobots(txt, AGENT, p);

  it("Texas: a rule in capitals covers the lowercase folder (our deliberate choice)", () => {
    const tx = "User-agent: *\nDisallow: /Reports/\nDisallow: /TLODOCS/\n";
    assert.equal(allowed(tx, "/tlodocs/89R/billtext/html/HB00149F.htm"), false);
    assert.equal(allowed(tx, "/BillLookup/"), true);
  });
  it("Colorado: the wildcard download rule beats the shorter Allow", () => {
    const co = "User-agent: *\nDisallow: /admin/\nDisallow: /laws/session-laws/*/download\nAllow: /\n";
    assert.equal(allowed(co, "/laws/session-laws/SB26-189/131/download"), false);
    assert.equal(allowed(co, "/bills/sb26-189"), true);
  });
  it("New York: a rule for another bot doesn't apply to us", () => {
    const ny = "User-agent: GPTBot\nDisallow: /\n";
    assert.equal(allowed(ny, "/leg/?bn=S08828"), true);
  });
  it("a group naming us replaces the * group", () => {
    const txt = "User-agent: *\nDisallow: /\n\nUser-agent: ThinkAI-compliance-mapper\nDisallow: /private\n";
    assert.equal(allowed(txt, "/public"), true);
    assert.equal(allowed(txt, "/private/x"), false);
  });
  it("Allow wins a tie, $ anchors, comments and empty Disallow are ignored", () => {
    assert.equal(allowed("User-agent: *\nDisallow: /a\nAllow: /a\n", "/a"), true);
    assert.equal(allowed("User-agent: *\nDisallow: /*.pdf$\n", "/x.pdf"), false);
    assert.equal(allowed("User-agent: *\nDisallow: /*.pdf$\n", "/x.pdf?y=1"), true);
    assert.equal(allowed("User-agent: * # all\nDisallow: # nothing\n", "/x"), true);
  });
  it("shared agent lines form one group; a query string counts as part of the path", () => {
    const txt = "User-agent: a\nUser-agent: *\nDisallow: /leg/?bn=\n";
    assert.equal(allowed(txt, "/leg/?bn=1"), false);
    assert.equal(allowed(txt, "/leg/"), true);
  });
  it("no rules at all means allowed", () => {
    assert.equal(allowed("", "/x"), true);
    assert.equal(allowed("<html>not robots</html>", "/x"), true);
  });
});

describe("the MCP server keeps its promises", () => {
  const read = (f: string) => readFileSync(f, "utf8");

  it("the route is localhost-only, through the same guard as /api/mcp", () => {
    for (const route of ["src/app/api/mcp/route.ts", "src/app/api/watch/mcp/route.ts"]) {
      assert.match(read(route), /localOnly\(/, route);
    }
    assert.match(read("src/app/api/watch/check/route.ts"), /localOnly\(/);
  });

  it("the check tools are marked as not read-only; the list and log tools stay read-only", () => {
    const tools = read("src/lib/watch-mcp-tools.ts");
    const block = (name: string) => tools.slice(tools.indexOf(`"${name}"`), tools.indexOf("addTool(server", tools.indexOf(`"${name}"`)));
    assert.match(block("check_law"), /writes: true/);
    assert.match(block("check_all"), /writes: true/);
    assert.doesNotMatch(block("list_sources"), /writes: true/);
    assert.doesNotMatch(tools.slice(tools.indexOf('"get_watch_log"')), /writes: true/);
    const helpers = read("src/lib/mcp-helpers.ts");
    assert.match(helpers, /readOnlyHint: !spec\.writes/);
  });

  it("every response goes through the disclaimer helper", () => {
    assert.match(read("src/lib/mcp-helpers.ts"), /withDisclaimer\(text\)/);
    assert.doesNotMatch(read("src/lib/watch-mcp-tools.ts"), /content: \[/);
  });
});

/** The smallest ZIP that has one deflated file. */
function zipWith(name: string, text: string): Buffer {
  const data = deflateRawSync(Buffer.from(text));
  const nameBytes = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt16LE(nameBytes.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt16LE(nameBytes.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + nameBytes.length, 12);
  end.writeUInt32LE(local.length + nameBytes.length + data.length, 16);
  return Buffer.concat([local, nameBytes, data, central, nameBytes, end]);
}
