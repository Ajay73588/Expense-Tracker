import "./globals.css";
import type { Metadata } from "next";
import { Sidebar } from "@/components/ui/Sidebar";

export const metadata: Metadata = {
  title: "FinanceAI — Your AI Financial Companion",
  description: "Unified personal finance, portfolio tracking, and AI-driven advisory",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 ml-0 lg:ml-64 min-h-screen">
            <div className="p-6 max-w-7xl mx-auto">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
