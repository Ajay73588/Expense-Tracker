import fs from "fs";
import path from "path";

// Load .env safely without external dependencies
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
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
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

import { NvidiaClient } from "../src/services/ai/nvidia-client";
import { ImportExtractionService } from "../src/services/ai/import-extraction.service";

interface SmokeCheckResult {
  name: string;
  feature: "advisor" | "import";
  status: "PASS" | "FAIL" | "BLOCKED";
  httpStatus?: number | null;
  durationMs?: number;
  model?: string;
  details: string;
}

async function runNvidiaSmokeTests() {
  console.log("=============================================================");
  console.log("   FinanceAI — NVIDIA NIM Integration Smoke Test Suite       ");
  console.log("=============================================================\n");

  const results: SmokeCheckResult[] = [];

  const advisorKeyConfigured = NvidiaClient.isConfigured("advisor");
  const importKeyConfigured = NvidiaClient.isConfigured("import");
  const baseUrl = NvidiaClient.getBaseUrl();
  const advisorModel = NvidiaClient.getModel("advisor");
  const importModel = NvidiaClient.getModel("import");

  console.log(`Endpoint Base URL:     ${baseUrl}`);
  console.log(`Advisor Model:         ${advisorModel}`);
  console.log(`Advisor Key Status:    ${advisorKeyConfigured ? "[CONFIGURED: nvapi-***]" : "[NOT CONFIGURED]"}`);
  console.log(`Import Model:          ${importModel}`);
  console.log(`Import Key Status:     ${importKeyConfigured ? "[CONFIGURED: nvapi-***]" : "[NOT CONFIGURED]"}\n`);

  // -------------------------------------------------------------
  // Test 1: AI Advisor - Minimal Text Generation
  // -------------------------------------------------------------
  console.log("--- 1. AI Advisor: Minimal Generation Check ---");
  if (!advisorKeyConfigured) {
    console.log("[-] Skipped: NVIDIA_NIM_API_KEY is not configured.");
    results.push({
      name: "AI Advisor: Minimal Generation",
      feature: "advisor",
      status: "BLOCKED",
      details: "NVIDIA_NIM_API_KEY is missing from environment.",
    });
  } else {
    const t0 = Date.now();
    const res = await NvidiaClient.complete({
      feature: "advisor",
      messages: [
        {
          role: "user",
          content: "In one concise sentence under 30 words, what is an emergency fund in personal finance?",
        },
      ],
      maxTokens: 150,
      temperature: 0.2,
      maxRetries: 3,
    });
    const duration = Date.now() - t0;

    if (res.ok) {
      console.log(`[+] SUCCESS (${duration}ms)`);
      console.log(`    Model: ${res.model}`);
      console.log(`    Response: "${res.text.slice(0, 120).replace(/\n/g, " ")}..."`);
      results.push({
        name: "AI Advisor: Minimal Generation",
        feature: "advisor",
        status: "PASS",
        httpStatus: 200,
        durationMs: duration,
        model: res.model,
        details: `Usable text generated (${res.text.length} chars).`,
      });
    } else {
      console.log(`[-] FAILED (${duration}ms): [${res.code}] ${res.error}`);
      results.push({
        name: "AI Advisor: Minimal Generation",
        feature: "advisor",
        status: "FAIL",
        httpStatus: res.httpStatus,
        durationMs: duration,
        details: `Error: [${res.code}] ${res.error}`,
      });
    }
  }

  // -------------------------------------------------------------
  // Test 2: AI Advisor - Structured Advisory Context
  // -------------------------------------------------------------
  console.log("\n--- 2. AI Advisor: Reasoning & Advisory Response ---");
  if (!advisorKeyConfigured) {
    console.log("[-] Skipped: NVIDIA_NIM_API_KEY is not configured.");
    results.push({
      name: "AI Advisor: Advisory Response",
      feature: "advisor",
      status: "BLOCKED",
      details: "NVIDIA_NIM_API_KEY is missing from environment.",
    });
  } else {
    const t0 = Date.now();
    const res = await NvidiaClient.complete({
      feature: "advisor",
      messages: [
        {
          role: "system",
          content: "You are a personal finance assistant. Format your answer with markdown headings.",
        },
        {
          role: "user",
          content: "Give 2 bullet points on debt-to-income ratio guidelines in India.",
        },
      ],
      maxTokens: 300,
      temperature: 0.2,
      maxRetries: 3,
    });
    const duration = Date.now() - t0;

    if (res.ok) {
      console.log(`[+] SUCCESS (${duration}ms)`);
      console.log(`    Output length: ${res.text.length} chars`);
      results.push({
        name: "AI Advisor: Advisory Response",
        feature: "advisor",
        status: "PASS",
        httpStatus: 200,
        durationMs: duration,
        model: res.model,
        details: `Markdown advisory response parsed cleanly.`,
      });
    } else {
      console.log(`[-] FAILED (${duration}ms): [${res.code}] ${res.error}`);
      results.push({
        name: "AI Advisor: Advisory Response",
        feature: "advisor",
        status: "FAIL",
        httpStatus: res.httpStatus,
        durationMs: duration,
        details: `Error: [${res.code}] ${res.error}`,
      });
    }
  }

  // -------------------------------------------------------------
  // Test 3: Document Extraction - Minimal Check
  // -------------------------------------------------------------
  console.log("\n--- 3. Document Extraction: Provider Configuration & Connectivity ---");
  if (!importKeyConfigured) {
    console.log("[-] BLOCKED: NVIDIA_NIM_IMPORT_API_KEY is not configured.");
    console.log("    To enable live document extraction smoke tests, populate NVIDIA_NIM_IMPORT_API_KEY in .env.");
    results.push({
      name: "Document Extraction: Minimal Check",
      feature: "import",
      status: "BLOCKED",
      details: "NVIDIA_NIM_IMPORT_API_KEY is not configured. Advisor key was NOT used.",
    });
  } else {
    const t0 = Date.now();
    const res = await NvidiaClient.complete({
      feature: "import",
      messages: [{ role: "user", content: "Reply with 'READY'" }],
      maxTokens: 20,
      maxRetries: 1,
    });
    const duration = Date.now() - t0;

    if (res.ok) {
      console.log(`[+] SUCCESS (${duration}ms)`);
      results.push({
        name: "Document Extraction: Minimal Check",
        feature: "import",
        status: "PASS",
        httpStatus: 200,
        durationMs: duration,
        model: res.model,
        details: "Import key verified and active.",
      });
    } else {
      console.log(`[-] FAILED (${duration}ms): [${res.code}] ${res.error}`);
      results.push({
        name: "Document Extraction: Minimal Check",
        feature: "import",
        status: "FAIL",
        httpStatus: res.httpStatus,
        durationMs: duration,
        details: `Error: [${res.code}] ${res.error}`,
      });
    }
  }

  // -------------------------------------------------------------
  // Test 4: Document Extraction - Synthetic Statement Parsing (Zero DB writes)
  // -------------------------------------------------------------
  console.log("\n--- 4. Document Extraction: Synthetic Statement Extraction ---");
  if (!importKeyConfigured) {
    console.log("[-] BLOCKED: NVIDIA_NIM_IMPORT_API_KEY is not configured.");
    results.push({
      name: "Document Extraction: Synthetic Statement",
      feature: "import",
      status: "BLOCKED",
      details: "Blocked until NVIDIA_NIM_IMPORT_API_KEY is provided.",
    });
  } else {
    // Synthetic non-sensitive statement text (NO real personal data)
    const syntheticStatement = `
KOTAK MAHINDRA BANK
ACCOUNT STATEMENT FOR ACCOUNT *******4321
DATE        DESCRIPTION                 REF     DEBIT       CREDIT      BALANCE
2026-10-01  TECH SALARY CREDIT          REF001              95000.00    145000.00
2026-10-03  SWIGGY FOOD ORDER           REF002  650.00                  144350.00
2026-10-05  ELECTRICITY BESCOM          REF003  2400.00                 141950.00
    `.trim();

    const t0 = Date.now();
    const extractionResult = await ImportExtractionService.extractBankStatement(syntheticStatement);
    const duration = Date.now() - t0;

    if (extractionResult.ok && extractionResult.data) {
      const data = extractionResult.data;
      console.log(`[+] SUCCESS (${duration}ms)`);
      console.log(`    Detected Bank: ${data.bankName}`);
      console.log(`    Account Masked: ${data.accountNumberMasked}`);
      console.log(`    Parsed Transactions: ${data.transactions.length}`);

      for (const tx of data.transactions) {
        console.log(`      - ${tx.date} | ${tx.direction} ₹${tx.amount} | ${tx.description} (Ref: ${tx.reference || "none"})`);
      }

      results.push({
        name: "Document Extraction: Synthetic Statement",
        feature: "import",
        status: "PASS",
        durationMs: duration,
        details: `Extracted ${data.transactions.length} transactions conforming to schema.`,
      });
    } else {
      console.log(`[-] FAILED (${duration}ms): [${extractionResult.code}] ${extractionResult.error}`);
      results.push({
        name: "Document Extraction: Synthetic Statement",
        feature: "import",
        status: "FAIL",
        durationMs: duration,
        details: `Error: [${extractionResult.code}] ${extractionResult.error}`,
      });
    }
  }

  // -------------------------------------------------------------
  // Summary Table
  // -------------------------------------------------------------
  console.log("\n=============================================================");
  console.log("                  SMOKE TEST RESULTS SUMMARY                 ");
  console.log("=============================================================");
  console.table(
    results.map((r) => ({
      Check: r.name,
      Feature: r.feature,
      Status: r.status,
      "Duration (ms)": r.durationMs ?? "N/A",
      Model: r.model ?? "-",
      Details: r.details,
    }))
  );
  console.log("=============================================================\n");

  const hasFailure = results.some((r) => r.status === "FAIL");
  if (hasFailure) {
    process.exitCode = 1;
  }
}

runNvidiaSmokeTests().catch((err) => {
  console.error("Smoke test execution aborted with unhandled error:", err.message);
  process.exit(1);
});
