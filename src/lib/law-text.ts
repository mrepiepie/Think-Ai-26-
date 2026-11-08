import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";

/**
 * Official page -> clean law text, shared by the law reader and Legislature Watch.
 *
 * data/laws/*.txt were made by a one-off step that was never saved, so this
 * rebuilds it. Only NYC and New York could be proven against the saved text
 * from a live page (VALIDATED_AGAINST_LIVE_PAGE); the other sources refuse
 * automated requests, so their profiles are untested against a real page.
 *
 * No I/O here. Text from a page is untrusted data.
 */

/** data/laws/*.txt start with a short provenance header ending in a ===== rule. */
export function lawBody(fileText: string): string {
  const marker = fileText.indexOf("\n" + "=".repeat(70));
  return marker === -1 ? fileText : fileText.slice(fileText.indexOf("\n", marker + 1) + 1);
}

/* ------------------------------------------------------------------ */
/* Extraction                                                          */
/* ------------------------------------------------------------------ */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  sect: "§",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] !== "#") return NAMED_ENTITIES[code.toLowerCase()] ?? whole;
    const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
  });
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|head)\b[\s\S]*?<\/\1\s*>/gi, "\n")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<(br|p|div|tr|li|h[1-6]|table|section|article|pre)\b[^>]*>/gi, "\n")
      .replace(/<\/(p|div|tr|li|h[1-6]|table|section|article|pre)\s*>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  );
}

/** Longest word/document.xml we'll inflate: guards against a zip bomb. */
const MAX_DOCX_XML_BYTES = 20 * 1024 * 1024;

function readZipEntry(zip: Buffer, name: string): Buffer | null {
  let end = zip.length - 22;
  while (end >= 0 && zip.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error("not a readable ZIP file");
  let at = zip.readUInt32LE(end + 16);
  const count = zip.readUInt16LE(end + 10);
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(at) !== 0x02014b50) throw new Error("corrupt ZIP directory");
    const method = zip.readUInt16LE(at + 10);
    const compressed = zip.readUInt32LE(at + 20);
    const nameLen = zip.readUInt16LE(at + 28);
    const extraLen = zip.readUInt16LE(at + 30);
    const commentLen = zip.readUInt16LE(at + 32);
    const local = zip.readUInt32LE(at + 42);
    if (zip.toString("utf8", at + 46, at + 46 + nameLen) === name) {
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const data = zip.subarray(start, start + compressed);
      return method === 0 ? data : inflateRawSync(data, { maxOutputLength: MAX_DOCX_XML_BYTES });
    }
    at += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

function docxToText(zip: Buffer): string {
  const xml = readZipEntry(zip, "word/document.xml");
  if (!xml) throw new Error("no word/document.xml in the file");
  const paragraphs = [...xml.toString("utf8").matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((p) =>
    [...p[0].matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>|<w:(?:tab|br)\b[^>]*\/>/g)].map((m) => m[1] ?? " ").join(""),
  );
  return decodeEntities(paragraphs.join("\n\n"));
}

export class UnsupportedFormatError extends Error {}

/**
 * Picks the format from the bytes, because headers can't be trusted here:
 * NYC's Legistar labels a .docx as application/msword.
 */
export function extractLawText(bytes: Buffer, contentType: string | null): string {
  if (bytes.subarray(0, 4).toString("latin1") === "%PDF") {
    throw new UnsupportedFormatError("PDF text extraction is not supported");
  }
  if (bytes.subarray(0, 4).toString("latin1") === "PK\u0003\u0004") {
    try {
      return docxToText(bytes);
    } catch (err) {
      throw new UnsupportedFormatError(`could not read the Word file (${err instanceof Error ? err.message : "error"})`);
    }
  }
  if (bytes.subarray(0, 8).toString("hex") === "d0cf11e0a1b11ae1") {
    throw new UnsupportedFormatError("old binary Word files are not supported");
  }
  const text = bytes.toString("utf8");
  return contentType?.includes("text/plain") ? text : htmlToText(text);
}

/* ------------------------------------------------------------------ */
/* Cleaning                                                            */
/* ------------------------------------------------------------------ */

interface CleanProfile {
  /** Keep text from the first match on. */
  start?: RegExp;
  /** Keep text before the first match after `start`. */
  end?: RegExp;
  /** Cut from `from` up to (not including) `to`. */
  cut?: { from: RegExp; to: RegExp };
  /** Lines that are page furniture, not law. */
  dropLines?: RegExp[];
  /** Printed bills: remove each line's leading number. */
  numberedLines?: boolean;
}

const CALIFORNIA: CleanProfile = {
  start: /(?:Assembly|Senate) Bill No\.\s+\d+/,
  // The saved copies omit the Legislative Counsel's Digest.
  cut: { from: /LEGISLATIVE COUNSEL.S DIGEST/i, to: /The people of the State of California do enact as follows/i },
};

export const CLEAN_PROFILES: Record<string, CleanProfile> = {
  "nyc-ll144": {
    start: /Int\. No\. 1894-A/,
    // "..Title" and "..Body" are Word form labels; the rest is the drafter's sign-off block.
    dropLines: [/^\.\.(?:Title|Body)$/, /^[A-Z]{2}\/ ?[A-Z]{2}$/, /^LS #\d+$/, /^\d+\/\d+\/\d{4} \d+:\d+ [ap]m$/],
  },
  "ny-raise": {
    start: /STATE OF NEW YORK/,
    end: /Go to top/,
    numberedLines: true,
    dropLines: [/^S\. \d+\s+\d+$/, /^EXPLANATION--/, /is old law to be omitted\.$/, /^[A-Z]{3}\d{5}-\d{2}-\d$/],
  },
  "tx-traiga": { start: /H\.B\. No\. 149/ },
  "ca-sb243": CALIFORNIA,
  "ca-ab2013": CALIFORNIA,
  "ca-sb53": CALIFORNIA,
};

/** Sources whose cleaning has been shown to reproduce the saved text from a real page. */
export const VALIDATED_AGAINST_LIVE_PAGE = ["nyc-ll144", "ny-raise"];

/** Printed-bill line numbers: "    12  text". A second run of spaces keeps paragraph indents. */
const LINE_NUMBER = /^\s*\d{1,3} {2}/;

function unwrapNumberedLines(lines: string[]): string {
  const out: string[] = [];
  for (const raw of lines) {
    const hadNumber = LINE_NUMBER.test(raw);
    const line = raw.replace(LINE_NUMBER, "");
    // After a line number, an indent starts a paragraph. Otherwise the line continues.
    if (!line.trim()) {
      out.push("");
    } else if (hadNumber && !line.startsWith(" ") && out.length && out[out.length - 1] !== "") {
      const prev = out[out.length - 1];
      out[out.length - 1] = /[a-z]-$/.test(prev) && /^[a-z]/.test(line.trim()) ? prev.slice(0, -1) + line.trim() : `${prev} ${line.trim()}`;
    } else {
      out.push("", line.trim());
    }
  }
  return out.join("\n");
}

export function cleanLawText(lawId: string, raw: string): string {
  const profile = CLEAN_PROFILES[lawId] ?? {};
  let text = raw.replace(/\r\n?/g, "\n").normalize("NFKC");

  if (profile.start) {
    const at = text.search(profile.start);
    if (at !== -1) text = text.slice(at);
  }
  if (profile.end) {
    const at = text.search(profile.end);
    if (at !== -1) text = text.slice(0, at);
  }
  if (profile.cut) {
    const from = text.search(profile.cut.from);
    const to = text.search(profile.cut.to);
    if (from !== -1 && to > from) text = text.slice(0, from) + text.slice(to);
  }

  let lines = text.split("\n");
  if (profile.dropLines) {
    lines = lines.filter((l) => !profile.dropLines!.some((re) => re.test(l.trim())));
  }
  const joined = profile.numberedLines ? unwrapNumberedLines(lines) : lines.join("\n");

  return joined
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ------------------------------------------------------------------ */
/* Comparing                                                           */
/* ------------------------------------------------------------------ */

/**
 * Like normalizeForMatch (ignores case, spacing and most punctuation, so line
 * wrapping or curly quotes never count as a change), but keeps [ ] $ %. In
 * bill text a moved bracket changes what is law, and "$" and "%" change amounts.
 */
export function normalizeForHash(text: string): string {
  return text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9[\]$%]+/g, "");
}

export function hashLawText(text: string): string {
  return createHash("sha256").update(normalizeForHash(text)).digest("hex");
}

/** A fragment this short ("Section 2.", "Sec. 3.") belongs with the words after it. */
const MIN_PASSAGE_WORDS = 4;

/** Sentence-sized passages, so a diff survives re-wrapped paragraphs. */
export function splitPassages(text: string): string[] {
  return text
    .split(/\n\s*\n|\n/)
    .flatMap((paragraph) => {
      const passages: string[] = [];
      let pending = "";
      for (const part of paragraph.split(/(?<=[.;:])\s+/)) {
        pending = pending ? `${pending} ${part}` : part;
        if (pending.split(/\s+/).length >= MIN_PASSAGE_WORDS) {
          passages.push(pending);
          pending = "";
        }
      }
      return pending ? [...passages, pending] : passages;
    })
    .map((s) => s.trim())
    .filter((s) => normalizeForHash(s).length > 0);
}
