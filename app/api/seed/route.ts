import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Quick seed endpoint — POST /api/seed
// Used when running without CLI access (e.g., deployed demo).
// Protected: only runs if DB has no demo user.
export async function POST() {
  const existing = await prisma.user.findUnique({ where: { email: "demo@financeai.app" } });
  if (existing) {
    return NextResponse.json({ ok: true, message: "Demo data already exists." });
  }
  // Redirect to proper seed instructions
  return NextResponse.json(
    { ok: false, message: "Run `npm run setup` from the project root to seed." },
    { status: 400 }
  );
}

export async function GET() {
  const user = await prisma.user.findUnique({ where: { email: "demo@financeai.app" } });
  return NextResponse.json({ ok: true, seeded: !!user });
}
