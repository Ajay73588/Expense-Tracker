/**
 * Stock market-data abstraction. The portfolio never talks to Yahoo (or any vendor) directly;
 * swap the implementation by changing the provider registered in PriceEngineService.
 */
export interface StockQuoteRequest {
  /** Caller's correlation key (unique per security). */
  key: string;
  symbol: string | null;
  isin: string | null;
  /** "NSE" | "BSE" hint for Indian stocks. */
  exchange: string | null;
}

export interface StockQuote {
  price: number;
  currency: string;
  /** Resolved ticker (e.g. "RELIANCE" or "AAPL") without exchange suffix. */
  symbol: string;
  exchange: string | null;
  asOf: Date | null;
}

export type QuoteFailureReason = "NOT_FOUND" | "RATE_LIMITED" | "TIMEOUT" | "PROVIDER_ERROR";
export type QuoteOutcome =
  | { ok: true; quote: StockQuote }
  | { ok: false; reason: QuoteFailureReason; message: string };

export interface MarketDataProvider {
  name: string;
  /** Latest available price for Indian listings (INR). Batched: one provider round-trip per call. */
  getIndianStockQuotes(reqs: StockQuoteRequest[]): Promise<Map<string, QuoteOutcome>>;
  /** Latest available price for US listings (USD). */
  getUSStockQuotes(reqs: StockQuoteRequest[]): Promise<Map<string, QuoteOutcome>>;
}

export interface MutualFundNavRequest {
  name: string;
  isin: string | null;
  /** NAV implied by the broker statement; used only to disambiguate scheme variants. */
  statementNav: number | null;
  /** AMFI Scheme Code if known. */
  schemeCode?: string | null;
}

export type NavOutcome =
  | { ok: true; nav: number; schemeCode: string; schemeName: string; asOf: Date | null }
  | { ok: false; reason: QuoteFailureReason; message: string };

export interface MutualFundPriceProvider {
  name: string;
  getLatestNav(req: MutualFundNavRequest): Promise<NavOutcome>;
}
