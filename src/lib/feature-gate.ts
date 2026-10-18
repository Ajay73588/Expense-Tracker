import { AppError } from "./errors";
import { useFirebase } from "./firebase";

/** The portfolio-import / market-price / FX feature is Prisma + PostgreSQL only. */
export function assertPrismaMode(): void {
  if (useFirebase()) {
    throw new AppError(
      "Portfolio import, market prices and FX conversion are not supported when USE_FIREBASE=true. Set USE_FIREBASE=false and use PostgreSQL.",
      "UNSUPPORTED_IN_FIREBASE_MODE",
      501
    );
  }
}
