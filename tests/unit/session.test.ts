import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ get: vi.fn(), findUnique: vi.fn() }));
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(f: T) => f }));
vi.mock("next/headers", () => ({ cookies: () => ({ get: m.get, set: vi.fn(), delete: vi.fn() }) }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`REDIRECT:${to}`); } }));
vi.mock("@/lib/db", () => ({ db: { session: { findUnique: m.findUnique, create: vi.fn(), deleteMany: vi.fn() } } }));

import { getCurrentUser, requireAdmin, requireUser, safeNext } from "@/lib/session";

const future = () => new Date(Date.now() + 3_600_000);
const withSession = (user: Record<string, unknown>, expiresAt = future()) => {
  m.get.mockReturnValue({ value: "raw-token" });
  m.findUnique.mockResolvedValue({ expiresAt, user: { id: "u1", email: "a@b.co", name: "A", phone: null, role: "CUSTOMER", active: true, ...user } });
};
beforeEach(() => { m.get.mockReset(); m.findUnique.mockReset(); });

describe("getCurrentUser", () => {
  it("returns null without a cookie and never queries the database", async () => {
    m.get.mockReturnValue(undefined);
    expect(await getCurrentUser()).toBeNull();
    expect(m.findUnique).not.toHaveBeenCalled();
  });
  it("looks sessions up by a hash, never the raw token", async () => {
    withSession({});
    await getCurrentUser();
    const hash = m.findUnique.mock.calls[0][0].where.tokenHash;
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("raw-token");
  });
  it("returns the user for a valid session", async () => { withSession({}); expect(await getCurrentUser()).toMatchObject({ id: "u1" }); });
  it("rejects expired sessions and deactivated users", async () => {
    withSession({}, new Date(Date.now() - 1000)); expect(await getCurrentUser()).toBeNull();
    withSession({ active: false }); expect(await getCurrentUser()).toBeNull();
  });
  it("doesn't ask the database for the password hash", async () => {
    withSession({}); await getCurrentUser();
    expect(m.findUnique.mock.calls[0][0].include.user.select.passwordHash).toBeUndefined();
  });
});

describe("authorization gates", () => {
  it("sends anonymous visitors to login, remembering where they were going", async () => {
    m.get.mockReturnValue(undefined);
    await expect(requireUser("/cart")).rejects.toThrow("REDIRECT:/login?next=%2Fcart");
  });
  it("sends anonymous visitors to the admin login", async () => {
    m.get.mockReturnValue(undefined);
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/admin/login");
  });
  it("refuses signed-in customers on admin gates", async () => {
    withSession({ role: "CUSTOMER" });
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/admin/login");
  });
  it("refuses a deactivated admin", async () => {
    withSession({ role: "ADMIN", active: false });
    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/admin/login");
  });
  it("lets an active admin through", async () => {
    withSession({ role: "ADMIN" });
    await expect(requireAdmin()).resolves.toMatchObject({ role: "ADMIN" });
  });
});

describe("safeNext (open-redirect protection)", () => {
  it.each(["/cart", "/products/linen-overshirt?x=1", "/account/orders"])("keeps %s", (p) => expect(safeNext(p)).toBe(p));
  it.each(["//evil.com", "https://evil.com", "/\\evil.com", "javascript:alert(1)", "/ok\nHeader: x", "", undefined, null, 42])("replaces %j", (p) => expect(safeNext(p)).toBe("/account"));
});
