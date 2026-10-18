import fs from "fs";

// Load .env safely
if (fs.existsSync(".env")) {
  const content = fs.readFileSync(".env", "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

import { prisma } from "../src/lib/prisma";
import { AIAdvisoryService } from "../src/services/ai/ai-advisory.service";

async function runLiveTests() {
  console.log("=== FinanceAI: Real Live Gemini AI Advisor Smoke Test ===");
  console.log("Active Model Setting:", process.env.GEMINI_MODEL);

  // Find user with real assets in DB
  const user = await prisma.user.findFirst({
    where: {
      assets: {
        some: {},
      },
    },
    include: {
      _count: {
        select: { assets: true },
      },
    },
  });

  if (!user) {
    console.error("No user with assets found in database.");
    process.exit(1);
  }

  console.log(`Testing with real user: ${user.name || "User"} (${user.id}), total assets: ${user._count.assets}\n`);

  // 1. Short general financial question
  console.log("1. Testing Short General Financial Question...");
  const t0 = Date.now();
  const qRes = await AIAdvisoryService.runAction(user.id, "CUSTOM_CHAT", {
    message: "In 2 sentences, what is the 50/30/20 rule in Indian personal finance?",
  });
  console.log(`   Source: ${qRes.source} (${qRes.provider})`);
  console.log(`   Model: ${qRes.model}`);
  console.log(`   Duration: ${qRes.durationMs}ms`);
  console.log(`   Response Preview: ${qRes.response.slice(0, 150).replace(/\n/g, " ")}...\n`);

  // 2. MONTHLY_SUMMARY
  console.log("2. Testing MONTHLY_SUMMARY...");
  const mRes = await AIAdvisoryService.runAction(user.id, "MONTHLY_SUMMARY");
  console.log(`   Source: ${mRes.source} (${mRes.provider})`);
  console.log(`   Model: ${mRes.model}`);
  console.log(`   Duration: ${mRes.durationMs}ms`);
  console.log(`   Response Preview: ${mRes.response.slice(0, 150).replace(/\n/g, " ")}...\n`);

  // 3. PORTFOLIO_ANALYSIS
  console.log("3. Testing PORTFOLIO_ANALYSIS...");
  const pRes = await AIAdvisoryService.runAction(user.id, "PORTFOLIO_ANALYSIS");
  console.log(`   Source: ${pRes.source} (${pRes.provider})`);
  console.log(`   Model: ${pRes.model}`);
  console.log(`   Duration: ${pRes.durationMs}ms`);
  console.log(`   Response Preview: ${pRes.response.slice(0, 150).replace(/\n/g, " ")}...\n`);

  // 4. SUGGEST_INVESTMENTS
  console.log("4. Testing SUGGEST_INVESTMENTS...");
  const sRes = await AIAdvisoryService.runAction(user.id, "SUGGEST_INVESTMENTS");
  console.log(`   Source: ${sRes.source} (${sRes.provider})`);
  console.log(`   Model: ${sRes.model}`);
  console.log(`   Duration: ${sRes.durationMs}ms`);
  console.log(`   Response Preview: ${sRes.response.slice(0, 150).replace(/\n/g, " ")}...\n`);

  console.log("=== Summary ===");
  console.log(`General Question: ${qRes.source === "ai" ? "PASS (Live Gemini)" : "FALLBACK"} in ${qRes.durationMs}ms`);
  console.log(`Monthly Summary: ${mRes.source === "ai" ? "PASS (Live Gemini)" : "FALLBACK"} in ${mRes.durationMs}ms`);
  console.log(`Portfolio Analysis: ${pRes.source === "ai" ? "PASS (Live Gemini)" : "FALLBACK"} in ${pRes.durationMs}ms`);
  console.log(`Suggest Investments: ${sRes.source === "ai" ? "PASS (Live Gemini)" : "FALLBACK"} in ${sRes.durationMs}ms`);
}

runLiveTests()
  .catch((err) => {
    console.error("Test failed with error:", err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
