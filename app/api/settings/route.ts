import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, fail, handleError } from "@/lib/api";
import { z } from "zod";

export const dynamic = "force-dynamic";

const USE_FIREBASE = process.env.USE_FIREBASE === "true";

const settingsUpdateSchema = z.object({
  currency: z.enum(["INR", "USD", "EUR", "GBP"]).optional(),
  privacyMode: z.boolean().optional(),
  name: z.string().trim().min(1).max(100).optional(),
});

/**
 * GET /api/settings — Retrieves user settings and privacy configuration.
 */
export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUser();
    return ok({
      id: user.id,
      email: user.email,
      name: user.name ?? "User",
      currency: user.currency || "INR",
      privacyMode: Boolean(user.privacyMode),
      createdAt: user.createdAt || new Date(),
    });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * PATCH /api/settings — Updates user settings (currency, privacyMode, name).
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return fail("Invalid JSON body", "VALIDATION_ERROR", 400);
    }

    const parsed = settingsUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return fail("Invalid settings update data", "VALIDATION_ERROR", 400);
    }

    const dataToUpdate: Record<string, any> = {};
    if (parsed.data.currency !== undefined) {
      dataToUpdate.currency = parsed.data.currency;
    }
    if (parsed.data.privacyMode !== undefined) {
      dataToUpdate.privacyMode = parsed.data.privacyMode;
    }
    if (parsed.data.name !== undefined) {
      dataToUpdate.name = parsed.data.name;
    }

    if (USE_FIREBASE) {
      const { updateDoc } = await import("@/lib/firebase");
      await updateDoc("users", user.id, dataToUpdate);
      return ok({
        id: user.id,
        email: user.email,
        name: dataToUpdate.name ?? user.name ?? "User",
        currency: dataToUpdate.currency ?? user.currency ?? "INR",
        privacyMode: dataToUpdate.privacyMode !== undefined ? dataToUpdate.privacyMode : Boolean(user.privacyMode),
        updatedAt: new Date(),
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        name: true,
        currency: true,
        privacyMode: true,
        updatedAt: true,
      },
    });

    return ok(updatedUser);
  } catch (err) {
    return handleError(err);
  }
}
