import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Minimal in-memory database ──────────────────────────────────────────────
type Row = Record<string, any>;
let accountDb: Row[] = [];
let txDb: Row[] = [];
let assetDb: Row[] = [];
let seq = 0;

const makeId = () => `id${++seq}`;

// Account delegate
const account = {
  findMany: async ({ where, orderBy }: Row) => {
    let rows = accountDb.filter(r => {
      if (where?.userId && r.userId !== where.userId) return false;
      if (where?.closedAt === null && r.closedAt !== null && r.closedAt !== undefined) return false;
      return true;
    });
    if (orderBy) {
      // Basic ordering: isDefault desc, then name asc
      rows = rows.sort((a, b) => {
        if (b.isDefault !== a.isDefault) return b.isDefault ? 1 : -1;
        return a.name.localeCompare(b.name);
      });
    }
    return rows;
  },
  findFirst: async ({ where }: Row) =>
    accountDb.find(r => Object.entries(where).every(([k, v]) => r[k] === v)) ?? null,
  create: async ({ data }: Row) => {
    const row = { id: makeId(), closedAt: null, ...data };
    accountDb.push(row);
    return row;
  },
  upsert: async ({ where, create, update }: Row) => {
    let row = accountDb.find(r => Object.entries(where).every(([k, v]) => {
      // Handle composite unique key object e.g., userId_name: { userId, name }
      if (typeof v === "object" && v !== null) {
        return Object.entries(v).every(([subK, subV]) => r[subK] === subV);
      }
      return r[k] === v;
    }));
    if (row) {
      Object.assign(row, update);
    } else {
      row = { id: makeId(), closedAt: null, ...create };
      // Handle the composite key destructuring
      if (where.userId_name) {
         Object.assign(row as Row, where.userId_name);
      }
      accountDb.push(row as Row);
    }
    return row;
  },
  update: async ({ where, data }: Row) => {
    const r = accountDb.find(x => x.id === where.id)!;
    Object.assign(r, data);
    return r;
  },
  updateMany: async ({ where, data }: Row) => {
    const hits = accountDb.filter(r => Object.entries(where).every(([k, v]) => r[k] === v));
    hits.forEach(r => Object.assign(r, data));
    return { count: hits.length };
  },
  delete: async ({ where }: Row) => {
    const idx = accountDb.findIndex(r => r.id === where.id);
    if (idx === -1) throw new Error("not found");
    accountDb.splice(idx, 1);
    return { id: where.id };
  },
  count: async ({ where }: Row) =>
    accountDb.filter(r => Object.entries(where).every(([k, v]) => r[k] === v)).length,
};

// Transaction delegate
const transaction = {
  findMany: async ({ where, distinct, select }: Row) => {
    let rows = txDb.filter(r => {
      if (where?.userId && r.userId !== where.userId) return false;
      if (where?.accountId === null && r.accountId !== null) return false;
      if (where?.account?.not === null && (r.account === null || r.account === undefined)) return false;
      return true;
    });
    if (distinct && distinct.includes("account")) {
      const seen = new Set();
      rows = rows.filter(r => {
        if (seen.has(r.account)) return false;
        seen.add(r.account);
        return true;
      });
    }
    if (select && select.account) {
      rows = rows.map(r => ({ account: r.account }));
    }
    return rows;
  },
  updateMany: async ({ where, data }: Row) => {
    const hits = txDb.filter(r => r.userId === where.userId && r.accountId === where.accountId && r.account === where.account);
    hits.forEach(r => Object.assign(r, data));
    return { count: hits.length };
  },
  count: async ({ where }: Row) =>
    txDb.filter(r => Object.entries(where).every(([k, v]) => r[k] === v)).length,
};

// Asset delegate
const asset = {
  findMany: async ({ where, distinct, select }: Row) => {
    let rows = assetDb.filter(r => {
      if (where?.userId && r.userId !== where.userId) return false;
      if (where?.accountId === null && r.accountId !== null) return false;
      if (where?.account?.not === null && (r.account === null || r.account === undefined)) return false;
      return true;
    });
    if (distinct && distinct.includes("account")) {
      const seen = new Set();
      rows = rows.filter(r => {
        if (seen.has(r.account)) return false;
        seen.add(r.account);
        return true;
      });
    }
    if (select && select.account) {
      rows = rows.map(r => ({ account: r.account }));
    }
    return rows;
  },
  updateMany: async ({ where, data }: Row) => {
    const hits = assetDb.filter(r => r.userId === where.userId && r.accountId === where.accountId && r.account === where.account);
    hits.forEach(r => Object.assign(r, data));
    return { count: hits.length };
  },
  count: async ({ where }: Row) =>
    assetDb.filter(r => Object.entries(where).every(([k, v]) => r[k] === v)).length,
};

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    account,
    transaction,
    asset,
    $transaction: async (fn: (tx: any) => Promise<any>) => fn({ account, transaction, asset }),
  },
}));

import { AccountService } from "../src/services/account.service";

beforeEach(() => {
  accountDb = [];
  txDb = [];
  assetDb = [];
  seq = 0;
});

describe("AccountService — CRUD", () => {
  it("creates an account with correct defaults", async () => {
    const acc = await AccountService.create("u1", { name: "  HDFC Savings  " });
    expect(acc.name).toBe("HDFC Savings"); // trimmed
    expect(acc.type).toBe("OTHER");
    expect(acc.currency).toBe("INR");
    expect(acc.isDefault).toBe(false);
    expect(acc.userId).toBe("u1");
  });

  it("list returns only open accounts, ordered default-first then name", async () => {
    await AccountService.create("u1", { name: "Zerodha", isDefault: false });
    await AccountService.create("u1", { name: "HDFC", isDefault: true });
    await AccountService.create("u1", { name: "Groww", isDefault: false });
    const list = await AccountService.list("u1");
    expect(list[0].name).toBe("HDFC"); // isDefault=true comes first
    expect(list.map((a: any) => a.name)).toEqual(["HDFC", "Groww", "Zerodha"]);
  });

  it("get returns the account for the correct user", async () => {
    const acc = await AccountService.create("u1", { name: "Test" });
    const found = await AccountService.get("u1", acc.id);
    expect(found.id).toBe(acc.id);
  });

  it("get throws NOT_FOUND for wrong user", async () => {
    const acc = await AccountService.create("u1", { name: "Test" });
    await expect(AccountService.get("u2", acc.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("update changes name without affecting other fields", async () => {
    const acc = await AccountService.create("u1", { name: "Old Name", type: "BANK" });
    const updated = await AccountService.update("u1", acc.id, { name: "New Name" });
    expect(updated.name).toBe("New Name");
    expect(updated.type).toBe("BANK");
  });

  it("setting isDefault=true demotes the previous default", async () => {
    const a = await AccountService.create("u1", { name: "A", isDefault: true });
    const b = await AccountService.create("u1", { name: "B", isDefault: false });
    await AccountService.update("u1", b.id, { isDefault: true });
    const list = await AccountService.list("u1");
    expect(list.find((x: any) => x.id === a.id)!.isDefault).toBe(false);
    expect(list.find((x: any) => x.id === b.id)!.isDefault).toBe(true);
  });
});

describe("AccountService — soft-close", () => {
  it("sets closedAt on close()", async () => {
    const acc = await AccountService.create("u1", { name: "Old" });
    const closed = await AccountService.close("u1", acc.id);
    expect(closed.closedAt).toBeTruthy();
    expect(closed.isDefault).toBe(false);
  });

  it("list() excludes closed accounts", async () => {
    const acc = await AccountService.create("u1", { name: "Closed" });
    await AccountService.close("u1", acc.id);
    const list = await AccountService.list("u1");
    expect(list.some((a: any) => a.id === acc.id)).toBe(false);
  });

  it("close() throws ALREADY_CLOSED on double-close", async () => {
    const acc = await AccountService.create("u1", { name: "X" });
    await AccountService.close("u1", acc.id);
    await expect(AccountService.close("u1", acc.id)).rejects.toMatchObject({ code: "ALREADY_CLOSED" });
  });

  it("close() throws NOT_FOUND for wrong user", async () => {
    const acc = await AccountService.create("u1", { name: "X" });
    await expect(AccountService.close("u2", acc.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("AccountService — delete safety", () => {
  it("hard-deletes an account with no linked records", async () => {
    const acc = await AccountService.create("u1", { name: "Empty" });
    const result = await AccountService.delete("u1", acc.id);
    expect(result.deleted).toBe(true);
    expect(accountDb).toHaveLength(0);
  });

  it("refuses to delete when linked transactions exist", async () => {
    const acc = await AccountService.create("u1", { name: "HasTx" });
    txDb.push({ id: "t1", accountId: acc.id });
    await expect(AccountService.delete("u1", acc.id)).rejects.toMatchObject({ code: "ACCOUNT_HAS_RECORDS" });
  });

  it("refuses to delete when linked assets exist", async () => {
    const acc = await AccountService.create("u1", { name: "HasAsset" });
    assetDb.push({ id: "a1", accountId: acc.id });
    await expect(AccountService.delete("u1", acc.id)).rejects.toMatchObject({ code: "ACCOUNT_HAS_RECORDS" });
  });

  it("delete throws NOT_FOUND for wrong user", async () => {
    const acc = await AccountService.create("u1", { name: "X" });
    await expect(AccountService.delete("u2", acc.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("AccountService — isolation (LEDGER-009)", () => {
  it("user A's accounts are not visible to user B", async () => {
    await AccountService.create("userA", { name: "A's Bank" });
    const listB = await AccountService.list("userB");
    expect(listB).toHaveLength(0);
  });

  it("identical account names across different users do not conflict", async () => {
    const a1 = await AccountService.create("userA", { name: "Savings" });
    const a2 = await AccountService.create("userB", { name: "Savings" });
    expect(a1.id).not.toBe(a2.id);
    expect(await AccountService.list("userA")).toHaveLength(1);
    expect(await AccountService.list("userB")).toHaveLength(1);
  });

  it("closing one user's account does not affect another user's account list", async () => {
    const a = await AccountService.create("userA", { name: "Checking" });
    await AccountService.create("userB", { name: "Checking" });
    await AccountService.close("userA", a.id);
    expect(await AccountService.list("userA")).toHaveLength(0);
    expect(await AccountService.list("userB")).toHaveLength(1);
  });
});

describe("AccountService — migrateFlatAccounts (LEDGER-003)", () => {
  it("creates accounts for unique flat string accounts in transactions and assets", async () => {
    txDb.push({ id: "t1", userId: "u1", accountId: null, account: "Old Bank" });
    txDb.push({ id: "t2", userId: "u1", accountId: null, account: "Old Bank" });
    assetDb.push({ id: "a1", userId: "u1", accountId: null, account: "Broker 1" });

    const result = await AccountService.migrateFlatAccounts("u1");
    expect(result.namesCreated).toBe(2);
    expect(result.migratedRecords).toBe(3);

    const accounts = await AccountService.list("u1");
    expect(accounts).toHaveLength(2);
    expect(accounts.map((a: any) => a.name).sort()).toEqual(["Broker 1", "Old Bank"]);

    // Verify relations were updated
    expect(txDb[0].accountId).toBe(accounts.find((a: any) => a.name === "Old Bank")!.id);
    expect(assetDb[0].accountId).toBe(accounts.find((a: any) => a.name === "Broker 1")!.id);
  });

  it("handles null account fields safely", async () => {
    txDb.push({ id: "t1", userId: "u1", accountId: null, account: null });
    const result = await AccountService.migrateFlatAccounts("u1");
    expect(result.namesCreated).toBe(0);
    expect(result.migratedRecords).toBe(0);
  });
});

