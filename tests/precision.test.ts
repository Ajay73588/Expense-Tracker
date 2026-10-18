import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { AssetService } from "../src/services/asset.service";
import { TransactionService } from "../src/services/transaction.service";

describe("DATA-008 Precision and Math Regression Checks", () => {
  it("0.1 + 0.2 arithmetic using Prisma.Decimal yields exactly 0.3 without float variance", () => {
    const a = new Prisma.Decimal("0.1");
    const b = new Prisma.Decimal("0.2");
    const sum = a.add(b);
    expect(sum.toNumber()).toBe(0.3); // In native float this would be 0.30000000000000004
    expect(sum.toString()).toBe("0.3");
  });

  it("handles quantities up to 6 decimal places safely", () => {
    // Schema allows 18,6
    const qty1 = new Prisma.Decimal("1.123456");
    const qty2 = new Prisma.Decimal("2.654321");
    const sum = qty1.add(qty2);
    expect(sum.toString()).toBe("3.777777");
    
    // Testing round-trip conversion logic normally used in services
    const toNum = sum.toNumber();
    expect(toNum).toBe(3.777777);
  });

  it("handles monetary math correctly with 4 decimal places", () => {
    // Schema allows 19,4 for money
    const amount1 = new Prisma.Decimal("100.1234");
    const amount2 = new Prisma.Decimal("50.5678");
    const sum = amount1.add(amount2);
    expect(sum.toString()).toBe("150.6912");
  });

  it("multiplication of quantity (6 scale) and price (4 scale) respects precision", () => {
    const qty = new Prisma.Decimal("10.123456");
    const price = new Prisma.Decimal("5.1234");
    const value = qty.mul(price);
    
    // Expected: 10.123456 * 5.1234 = 51.8665144704
    expect(value.toString()).toBe("51.8665144704");
    expect(value.toNumber()).toBeCloseTo(51.866514, 6);
  });
});
