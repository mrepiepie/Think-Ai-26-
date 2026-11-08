/**
 * Minimal robots.txt reader (RFC 9309): user-agent groups, longest match,
 * Allow wins a tie, and the `*` and `$` wildcards. Pure, no I/O.
 *
 * One deliberate difference: paths compare CASE-INSENSITIVELY. The standard
 * is case-sensitive, but Texas's robots.txt says `Disallow: /TLODOCS/` while
 * its law page is at `/tlodocs/...` on a server that ignores case, so a strict
 * reading would let us into a folder the site asks robots to stay out of. When
 * in doubt, we stay out.
 */

interface Rule {
  allow: boolean;
  pattern: string;
  regex: RegExp;
}

function toRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .replace(/[.+?^{}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`, "i");
}

function rulesFor(robotsTxt: string, agent: string): Rule[] {
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;
  let inAgentLines = false;

  for (const rawLine of robotsTxt.split(/\r\n|\n|\r/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === "user-agent") {
      if (!current || !inAgentLines) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      inAgentLines = true;
    } else if (key === "allow" || key === "disallow") {
      inAgentLines = false;
      if (current && value) {
        current.rules.push({ allow: key === "allow", pattern: value, regex: toRegex(value) });
      }
    }
  }

  const token = agent.toLowerCase();
  const named = groups.filter((g) => g.agents.some((a) => a !== "*" && a !== "" && token.startsWith(a)));
  const chosen = named.length ? named : groups.filter((g) => g.agents.includes("*"));
  return chosen.flatMap((g) => g.rules);
}

/** `pathAndQuery` is the URL's path plus its query string. */
export function isAllowedByRobots(robotsTxt: string, agent: string, pathAndQuery: string): boolean {
  let best: Rule | null = null;
  for (const rule of rulesFor(robotsTxt, agent)) {
    if (!rule.regex.test(pathAndQuery)) continue;
    if (
      !best ||
      rule.pattern.length > best.pattern.length ||
      (rule.pattern.length === best.pattern.length && rule.allow)
    ) {
      best = rule;
    }
  }
  return best ? best.allow : true;
}
