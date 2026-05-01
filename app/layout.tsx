import "./globals.css";
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "FinanceAI — Your AI Financial Companion",
  description: "Unified personal finance, portfolio tracking, and AI-driven advisory",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen bg-bg text-gray-100">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
