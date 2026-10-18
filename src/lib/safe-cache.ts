import { cache as reactCache } from "react";

/**
 * Safe wrapper around React's request-scoped cache().
 * React.cache is only defined in React Server Component runtimes (react-server).
 * In Node.js Route Handlers, test suites, or standalone scripts, it safely falls back
 * to a pass-through function, preventing "cache is not a function" runtime errors.
 */
export const safeCache =
  typeof reactCache === "function"
    ? reactCache
    : <T extends (...args: any[]) => any>(fn: T): T => fn;
