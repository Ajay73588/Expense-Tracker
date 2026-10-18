"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/utils/cn";

interface Message {
  role: "user" | "assistant";
  content: string;
  source?: "ai" | "fallback";
  fallbackReason?: string;
  model?: string;
  isDailyQuota?: boolean;
}

const QUICK_ACTIONS = [
  { label: "Analyze Portfolio", action: "PORTFOLIO_ANALYSIS", icon: "◈", desc: "Strengths, risks, recommendations" },
  { label: "Investment Suggestions", action: "SUGGEST_INVESTMENTS", icon: "↗", desc: "Tailored to your profile" },
  { label: "Rebalancing Advice", action: "REBALANCING_ADVICE", icon: "⇌", desc: "Drift vs targets" },
  { label: "Financial Roadmap", action: "FINANCIAL_ROADMAP", icon: "◎", desc: "12-month plan" },
  { label: "Monthly Summary", action: "MONTHLY_SUMMARY", icon: "◧", desc: "Last 30 days recap" },
  { label: "Market Insights", action: "MARKET_INSIGHTS", icon: "✦", desc: "For your holdings" },
];

// Enhanced markdown renderer for better visual structure
function renderMarkdown(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    // Handle Headers (###)
    if (line.startsWith("### ")) {
      return (
        <h3 key={i} className="text-brand-400 font-bold text-base mt-4 mb-2 first:mt-0">
          {line.slice(4)}
        </h3>
      );
    }

    // Handle Bold and Italic
    const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    const rendered = parts.map((p, j) => {
      if (p.startsWith("**") && p.endsWith("**"))
        return <strong key={j} className="text-white font-semibold">{p.slice(2, -2)}</strong>;
      if (p.startsWith("*") && p.endsWith("*"))
        return <em key={j} className="text-gray-400 not-italic">{p.slice(1, -1)}</em>;
      return <span key={j}>{p}</span>;
    });

    // Handle Bullet Points
    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      const content = line.trim().slice(2);
      return (
        <div key={i} className="flex gap-2 ml-1 my-0.5 items-start">
          <span className="text-brand-500 mt-1 shrink-0">{"•"}</span>
          <span className="text-gray-300 leading-relaxed">{rendered}</span>
        </div>
      );
    }

    return (
      <p key={i} className={cn("leading-relaxed text-gray-300", line === "" ? "h-2" : "my-1")}>
        {rendered}
      </p>
    );
  });
}

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [engineStatus, setEngineStatus] = useState<"checking" | "nvidia" | "gemini" | "fallback">("checking");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(opts: { action?: string; message?: string }) {
    const action = opts.action ?? "CUSTOM_CHAT";

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: opts.message ?? `Run: ${opts.action?.replace(/_/g, " ")}` },
    ];
    setMessages(newMessages);
    setLoading(true);
    setInput("");

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          message: opts.message,
          history: messages,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setMessages([
          ...newMessages,
          {
            role: "assistant",
            content: json.data.response,
            source: json.data.source,
            fallbackReason: json.data.fallbackReason,
            model: json.data.model,
            isDailyQuota: json.data.isDailyQuota,
          },
        ]);
        if (json.data.source === "ai") {
          setEngineStatus("nvidia");
        } else if (json.data.source === "fallback") {
          setEngineStatus("fallback");
        }
      } else {
        setMessages([...newMessages, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
      }
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Network error. Please check your connection." }]);
    }
    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) send({ action: "CUSTOM_CHAT", message: input.trim() });
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="flex items-end justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Advisor</h1>
          <p className="text-sm text-gray-500 mt-1">Powered by financial context from your portfolio.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400 bg-bg-card border border-bg-border rounded-lg px-3 py-1.5">
          <span
            className={cn(
              "w-2 h-2 rounded-full inline-block",
              engineStatus === "nvidia" || engineStatus === "gemini" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
            )}
          />
          <span className="font-medium">
            {engineStatus === "nvidia" || engineStatus === "gemini"
              ? "NVIDIA NIM Active"
              : engineStatus === "fallback"
              ? "Rule Engine Fallback Active"
              : "AI Ready"}
          </span>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto space-y-4 min-h-0 pr-1">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 pb-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-3xl mx-auto mb-4">✦</div>
              <h2 className="text-lg font-semibold text-white mb-1">Your AI Financial Advisor</h2>
              <p className="text-sm text-gray-500 max-w-sm text-center">Ask anything about your finances, or use a quick action below.</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-2xl">
              {QUICK_ACTIONS.map((qa) => (
                <button
                  key={qa.action}
                  onClick={() => send({ action: qa.action })}
                  disabled={loading}
                  className="card card-hover p-4 text-left hover:border-brand-600/40 transition-colors group"
                >
                  <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">{qa.icon}</div>
                  <div className="text-sm font-medium text-gray-200">{qa.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{qa.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-sm mr-2 mt-1 shrink-0">✦</div>
            )}
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                msg.role === "user"
                  ? "bg-brand-600/20 text-gray-100 border border-brand-600/30 rounded-br-sm"
                  : "bg-bg-card border border-bg-border rounded-bl-sm"
              )}
            >
              {msg.role === "assistant" ? (
                <div className="ai-prose space-y-0.5">
                  {msg.source === "fallback" && (
                    <div className="mb-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                        <span>
                          {msg.fallbackReason === "RATE_LIMIT" || msg.isDailyQuota
                            ? "AI Provider Quota Exhausted"
                            : msg.fallbackReason === "SERVICE_UNAVAILABLE"
                            ? "AI Provider Temporarily Unavailable (503)"
                            : msg.fallbackReason === "TIMEOUT"
                            ? "AI Request Timed Out"
                            : msg.fallbackReason === "AUTH_ERROR"
                            ? "NVIDIA NIM Unauthorized / Key Invalid"
                            : msg.fallbackReason === "NOT_CONFIGURED"
                            ? "AI Provider Not Configured"
                            : "Deterministic Engine Active"}
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-200/80 mt-1 leading-snug">
                        {msg.fallbackReason === "RATE_LIMIT" || msg.isDailyQuota
                          ? "NVIDIA NIM API rate limit reached. Switched immediately to local rule engine (AI bypassed)."
                          : msg.fallbackReason === "SERVICE_UNAVAILABLE"
                          ? "NVIDIA NIM service is temporarily overloaded. Returned local rule-based financial advice."
                          : msg.fallbackReason === "AUTH_ERROR"
                          ? "NVIDIA NIM API credentials invalid or unauthorized. Switched to local rule engine."
                          : "Live AI is unavailable. This response was generated locally and does not use NVIDIA NIM."}
                      </p>
                    </div>
                  )}

                  {renderMarkdown(msg.content)}

                  {msg.source === "ai" && (
                    <p className="text-[10px] text-gray-500 mt-2 pt-2 border-t border-bg-border flex items-center justify-between">
                      <span className="text-emerald-400 flex items-center gap-1 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                        Live NVIDIA NIM ({msg.model ? msg.model.replace("nvidia/", "") : "Nemotron"})
                      </span>
                      <span className="text-emerald-400/80 text-[10px] font-medium">Live AI response</span>
                    </p>
                  )}
                  {msg.source === "fallback" && (
                    <p className="text-[10px] text-gray-500 mt-2 pt-2 border-t border-bg-border flex items-center justify-between">
                      <span className="text-amber-400/90 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                        Rule Engine Fallback
                      </span>
                      <span className="text-gray-400 text-[10px]">
                        {msg.fallbackReason ? `Reason: ${msg.fallbackReason} (AI bypassed)` : "AI bypassed"}
                      </span>
                    </p>
                  )}
                </div>
              ) : (
                <p>{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-sm mr-2 mt-1 shrink-0">✦</div>
            <div className="bg-bg-card border border-bg-border rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce [animation-delay:0ms]"></span>
                <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce [animation-delay:150ms]"></span>
                <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce [animation-delay:300ms]"></span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick action chips (if messages exist) */}
      {messages.length > 0 && (
        <div className="flex gap-2 flex-wrap py-2 shrink-0">
          {QUICK_ACTIONS.slice(0, 3).map((qa) => (
            <button
              key={qa.action}
              onClick={() => send({ action: qa.action })}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-full bg-bg-hover border border-bg-border text-gray-400 hover:text-white hover:border-brand-600/40 transition-colors"
            >
              {qa.icon} {qa.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 pt-2">
        <div className="flex gap-3 bg-bg-card border border-bg-border rounded-xl p-2">
          <textarea
            className="flex-1 bg-transparent text-sm text-gray-100 placeholder-gray-600 resize-none outline-none min-h-[40px] max-h-[120px] px-2 py-1.5 leading-snug"
            placeholder="Ask about your portfolio, goals, tax-saving options… (Enter to send)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            onClick={() => { if (input.trim()) send({ action: "CUSTOM_CHAT", message: input.trim() }); }}
            disabled={loading || !input.trim()}
            className="self-end btn-primary px-4 py-2 rounded-lg disabled:opacity-40"
          >
            Send
          </button>
        </div>
        <p className="text-[10px] text-gray-600 text-center mt-1.5">
          AI advice is for educational purposes only. Not SEBI-registered financial advice.
        </p>
      </div>
    </div>
  );
}
