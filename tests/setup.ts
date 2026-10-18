import { vi } from "vitest";

// React's server-only `cache()` does not exist outside the Next.js RSC runtime.
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T>(fn: T) => fn }));

// Isolate unit tests from live external AI network requests
delete process.env.NVIDIA_NIM_API_KEY;
delete process.env.NVIDIA_NIM_IMPORT_API_KEY;
delete process.env.GEMINI_API_KEY;
delete process.env.MINIMAX_API_KEY;
