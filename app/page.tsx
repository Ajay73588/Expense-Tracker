import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const { userId } = await auth();
  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-bg text-gray-100 flex flex-col">
      {/* Navbar */}
      <nav className="flex items-center justify-between p-6 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-brand-500 flex items-center justify-center font-bold text-white">
            FA
          </div>
          <span className="text-xl font-bold tracking-tight">FinanceAI</span>
        </div>
        <div className="flex gap-4">
          <Link href="/sign-in" className="text-sm font-medium text-gray-300 hover:text-white transition-colors py-2">
            Log in
          </Link>
          <Link href="/sign-up" className="text-sm font-medium bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg transition-colors">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 text-brand-400 text-sm font-medium mb-8 border border-brand-500/20">
          <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
          Powered by MiniMax-M2.1
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 max-w-4xl text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">
          Your Intelligent Financial Companion
        </h1>
        
        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mb-10 leading-relaxed">
          Unify your net worth, track expenses, and get real-time AI advisory 
          tailored to your unique portfolio. Built for the modern investor.
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/sign-up" className="bg-brand-500 hover:bg-brand-600 text-white text-lg font-medium px-8 py-4 rounded-xl transition-all hover:scale-105 shadow-[0_0_40px_-10px_rgba(59,130,246,0.5)]">
            Start Building Wealth
          </Link>
          <Link 
            href="https://github.com/stuart-financeai" 
            target="_blank"
            className="bg-bg-hover hover:bg-bg-border text-white text-lg font-medium px-8 py-4 rounded-xl transition-all border border-bg-border flex items-center justify-center gap-2"
          >
            View Documentation
          </Link>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-32 max-w-6xl mx-auto text-left">
          <div className="p-6 rounded-2xl bg-bg-hover/50 border border-bg-border">
            <div className="w-12 h-12 rounded-xl bg-brand-500/20 flex items-center justify-center mb-4 border border-brand-500/30">
              <span className="text-2xl">🤖</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">AI Advisory</h3>
            <p className="text-gray-400">Get personalized insights, portfolio rebalancing advice, and investment suggestions powered by advanced AI.</p>
          </div>
          
          <div className="p-6 rounded-2xl bg-bg-hover/50 border border-bg-border">
            <div className="w-12 h-12 rounded-xl bg-positive/20 flex items-center justify-center mb-4 border border-positive/30">
              <span className="text-2xl">📈</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">Net Worth Tracking</h3>
            <p className="text-gray-400">Aggregate your stocks, mutual funds, crypto, and real estate in one beautiful, real-time dashboard.</p>
          </div>

          <div className="p-6 rounded-2xl bg-bg-hover/50 border border-bg-border">
            <div className="w-12 h-12 rounded-xl bg-warning/20 flex items-center justify-center mb-4 border border-warning/30">
              <span className="text-2xl">🎯</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">Goal Planning</h3>
            <p className="text-gray-400">Set financial goals and let our engine calculate exactly how much you need to save monthly to hit them.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
