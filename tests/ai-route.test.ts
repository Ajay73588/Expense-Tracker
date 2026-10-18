import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as authModule from "../src/lib/auth";
import { AIAdvisoryService } from "../src/services/ai/ai-advisory.service";
import * as aiRoute from "../app/api/ai/route";

describe("POST /api/ai Route Handler Integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authModule, "getCurrentUserId").mockResolvedValue("test-user-id");
  });

  it("successfully handles valid CUSTOM_CHAT request", async () => {
    vi.spyOn(AIAdvisoryService, "runAction").mockResolvedValue({
      response: "Here is your investment guidance.",
      source: "ai",
      provider: "nvidia",
      model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
      fallbackReason: undefined,
      durationMs: 420,
    });

    const req = new NextRequest("http://localhost:3000/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "CUSTOM_CHAT",
        message: "Explain asset allocation.",
      }),
    });

    const res = await aiRoute.POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.source).toBe("ai");
    expect(json.data.provider).toBe("nvidia");
    expect(json.data.model).toBe("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning");
    expect(json.data.response).toBe("Here is your investment guidance.");
  });

  it("successfully returns rule-based fallback when AI is unavailable", async () => {
    vi.spyOn(AIAdvisoryService, "runAction").mockResolvedValue({
      response: "Fallback financial summary",
      source: "fallback",
      provider: "rule-engine",
      model: undefined,
      fallbackReason: "RATE_LIMIT",
      durationMs: 15,
    });

    const req = new NextRequest("http://localhost:3000/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "MONTHLY_SUMMARY",
      }),
    });

    const res = await aiRoute.POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.source).toBe("fallback");
    expect(json.data.provider).toBe("rule-engine");
  });

  it("rejects invalid request payload with 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "INVALID_ACTION",
      }),
    });

    const res = await aiRoute.POST(req);
    expect(res.status).toBe(400);
  });
});
