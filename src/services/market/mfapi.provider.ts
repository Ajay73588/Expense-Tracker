import { z } from "zod";
import { cache } from "../../lib/cache";
import { fetchJson, ProviderError } from "../../lib/http";
import { createLogger } from "../../lib/logger";
import type { MutualFundNavRequest, MutualFundPriceProvider, NavOutcome, QuoteFailureReason } from "./market-data.provider";

const log = createLogger("MfApiProvider");

/**
 * mfapi.in adapter — free, keyless AMFI NAV mirror. NAVs are published once per business day,
 * so a "price" here is the latest available NAV, not an intraday value.
 *
 * Scheme matching never trusts a name alone:
 *   1. If AMFI schemeCode or ISIN is available, exact identifier match wins.
 *   2. Otherwise candidates must match all core distinctive terms, respect Direct/Regular and Growth/IDCW.
 *   3. If exactly one candidate survives, it is accepted with live NAV (not rejected due to date NAV drift).
 *   4. If multiple candidates survive, statement NAV disambiguates if one is clearly closest within tolerance.
 *   5. Zero or genuinely ambiguous survivors → NOT_FOUND.
 */
const searchSchema = z.array(z.object({ schemeCode: z.union([z.number(), z.string()]), schemeName: z.string() }));
const latestSchema = z.object({
  meta: z
    .object({
      scheme_code: z.union([z.number(), z.string()]).optional(),
      scheme_name: z.string().optional(),
      isin_growth: z.string().nullable().optional(),
      isin_div_reinvestment: z.string().nullable().optional(),
    })
    .passthrough(),
  data: z.array(z.object({ date: z.string(), nav: z.union([z.string(), z.number()]) })).min(1),
});

const NAV_PLAUSIBILITY_TOLERANCE = 0.30;
const NOISE = new Set(["fund", "funds", "plan", "option", "scheme", "the", "of", "and", "-", "&"]);
const CODE_TTL_S = 30 * 24 * 3600;

export function normalizeMfTokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bmidcap\b/g, "mid cap")
    .replace(/\bsmallcap\b/g, "small cap")
    .replace(/\blargecap\b/g, "large cap")
    .replace(/\bflexicap\b/g, "flexi cap")
    .replace(/\bmulticap\b/g, "multi cap")
    .replace(/\bmicrocap\b/g, "micro cap")
    .replace(/\bnifty50\b/g, "nifty 50")
    .replace(/\boff\s+shore\b/g, "offshore")
    .replace(/\bfund\s+of\s+funds?\b/g, "fof")
    .split(/\s+/)
    .filter(Boolean);
}

function searchQuery(name: string): string {
  const stop = new Set(["direct", "regular", "growth", "plan", "idcw", "option", "dividend"]);
  const out: string[] = [];
  for (const t of normalizeMfTokens(name)) {
    if (stop.has(t)) break;
    out.push(t);
    if (out.length === 4) break;
  }
  return (out.length >= 2 ? out : normalizeMfTokens(name).slice(0, 3)).join(" ");
}

function parseMfDate(d: string): Date | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(d);
  return m ? new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]))) : null;
}

function failure(err: unknown): { reason: QuoteFailureReason; message: string } {
  if (err instanceof ProviderError) {
    const reason: QuoteFailureReason =
      err.kind === "timeout" ? "TIMEOUT" : err.kind === "rate_limited" ? "RATE_LIMITED" : err.kind === "not_found" ? "NOT_FOUND" : "PROVIDER_ERROR";
    return { reason, message: err.message };
  }
  return { reason: "PROVIDER_ERROR", message: err instanceof Error ? err.message : "Unknown error" };
}

export function createMfApiProvider(opts: { baseUrl?: string; fetchImpl?: typeof fetch } = {}): MutualFundPriceProvider {
  const base = (opts.baseUrl ?? process.env.MFAPI_BASE_URL ?? "https://api.mfapi.in").replace(/\/$/, "");
  const get = (path: string) => fetchJson(`${base}${path}`, { fetchImpl: opts.fetchImpl });
  let rateLimitCooldownUntil = 0;

  async function latest(code: string | number) {
    const parsed = latestSchema.safeParse(await get(`/mf/${code}/latest`));
    if (!parsed.success) throw new ProviderError("invalid_response", "Unexpected NAV response shape");
    const nav = Number(parsed.data.data[0].nav);
    if (!(nav > 0)) throw new ProviderError("invalid_response", "Non-positive NAV");
    return { nav, asOf: parseMfDate(parsed.data.data[0].date), meta: parsed.data.meta, code: String(code) };
  }

  return {
    name: "mfapi.in",

    async getLatestNav(req: MutualFundNavRequest): Promise<NavOutcome> {
      try {
        if (Date.now() < rateLimitCooldownUntil) {
          return {
            ok: false,
            reason: "RATE_LIMITED",
            message: "MFAPI rate limit cooldown in effect; request withheld",
          };
        }

        // Direct scheme code provided
        if (req.schemeCode) {
          const l = await latest(req.schemeCode);
          return { ok: true, nav: l.nav, schemeCode: l.code, schemeName: l.meta.scheme_name ?? req.name, asOf: l.asOf };
        }

        const normTokens = normalizeMfTokens(req.name);
        const codeKey = `mfapi:code:${req.isin ?? normTokens.join("_")}`;
        const knownCode = await cache.get<string>(codeKey);
        if (knownCode) {
          const l = await latest(knownCode);
          return { ok: true, nav: l.nav, schemeCode: l.code, schemeName: l.meta.scheme_name ?? req.name, asOf: l.asOf };
        }

        const q = searchQuery(req.name);
        const list = searchSchema.safeParse(await get(`/mf/search?q=${encodeURIComponent(q)}`));
        if (!list.success) throw new ProviderError("invalid_response", "Unexpected search response shape");

        const want = normTokens.filter((t) => !NOISE.has(t));
        const wantDirect = want.includes("direct") || want.includes("dir");
        const wantRegular = want.includes("regular") || want.includes("reg");
        const isIdcw = want.some((t) => ["idcw", "dividend", "payout", "reinvestment", "bonus"].includes(t));
        const core = want.filter((t) => !["direct", "dir", "regular", "reg", "growth", "gr", "idcw", "dividend", "payout", "reinvestment", "bonus"].includes(t));

        let cands = list.data.filter((c) => {
          const t = new Set(normalizeMfTokens(c.schemeName));
          if (!core.every((w) => t.has(w))) return false;
          const candIsIdcw = ["idcw", "dividend", "payout", "bonus"].some((x) => t.has(x));
          if (candIsIdcw !== isIdcw) return false;
          const candIsDirect = t.has("direct") || t.has("dir");
          if (wantDirect && !candIsDirect) return false;
          if (wantRegular && candIsDirect) return false;
          return true;
        });

        if (cands.length === 0) {
          log.info("mfapi.search.nomatch", { requested: req.name, query: q, coreWords: core, wantDirect, wantRegular, isIdcw });
          return { ok: false, reason: "NOT_FOUND", message: "No matching scheme found" };
        }

        cands = cands.slice(0, 8); // bound candidate NAV fetches

        const fetched = await Promise.all(cands.map((c) => latest(c.schemeCode).catch(() => null)));
        const live = fetched.filter((x): x is NonNullable<typeof x> => x !== null);

        if (live.length === 0) {
          return { ok: false, reason: "NOT_FOUND", message: "Failed to fetch live NAV for matching schemes" };
        }

        // 1) exact ISIN match
        if (req.isin) {
          const byIsin = live.filter((x) => x.meta.isin_growth === req.isin || x.meta.isin_div_reinvestment === req.isin);
          if (byIsin.length === 1) return pick(byIsin[0], req, codeKey);
        }

        // 2) statement NAV filtering if statementNav provided
        let pool = live;
        if (req.statementNav && req.statementNav > 0) {
          pool = live.filter(
            (x) => Math.abs(x.nav - (req.statementNav as number)) / (req.statementNav as number) <= NAV_PLAUSIBILITY_TOLERANCE
          );
          if (pool.length === 0) {
            log.info("mfapi.search.drift_exceeded", {
              requested: req.name,
              statementNav: req.statementNav,
              candidateNavs: live.map((l) => ({ code: l.code, nav: l.nav })),
            });
            return { ok: false, reason: "NOT_FOUND", message: "No scheme matched the name and statement NAV" };
          }
        }

        // 3) Exactly one candidate survivor
        if (pool.length === 1) {
          return pick(pool[0], req, codeKey);
        }

        // 4) Disambiguate multiple candidates using statement NAV proximity
        if (req.statementNav && req.statementNav > 0 && pool.length > 1) {
          const diffs = pool.map((x) => ({
            item: x,
            pctDiff: Math.abs(x.nav - (req.statementNav as number)) / (req.statementNav as number),
          })).sort((a, b) => a.pctDiff - b.pctDiff);

          // If closest candidate is significantly closer than the runner up (at least 3% closer)
          if (diffs[1].pctDiff > diffs[0].pctDiff + 0.03) {
            return pick(diffs[0].item, req, codeKey);
          }
        }

        log.info("mfapi.search.ambiguous", {
          requested: req.name,
          candidateCount: pool.length,
          candidateCodes: pool.map((l) => l.code),
        });

        return {
          ok: false,
          reason: "NOT_FOUND",
          message: "Several schemes match; refusing to guess",
        };
      } catch (err) {
        const f = failure(err);
        if (f.reason === "RATE_LIMITED") {
          rateLimitCooldownUntil = Date.now() + 60_000;
        }
        return { ok: false, ...f };
      }
    },
  };

  async function pick(
    l: { nav: number; code: string; asOf: Date | null; meta: { scheme_name?: string } },
    req: MutualFundNavRequest,
    codeKey: string
  ): Promise<NavOutcome> {
    await cache.set(codeKey, l.code, CODE_TTL_S);
    return { ok: true, nav: l.nav, schemeCode: l.code, schemeName: l.meta.scheme_name ?? req.name, asOf: l.asOf };
  }
}
