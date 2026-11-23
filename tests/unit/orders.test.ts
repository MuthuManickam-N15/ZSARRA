import { describe, expect, it } from "vitest";
import { ORDER_TRANSITIONS as T } from "@/lib/orders";

describe("order status transitions", () => {
  it("treats delivered and cancelled as final", () => {
    expect(T.DELIVERED).toEqual([]);
    expect(T.CANCELLED).toEqual([]);
  });
  it("only allows the normal forward path", () => {
    expect(T.PENDING).toEqual(["CONFIRMED", "CANCELLED"]);
    expect(T.CONFIRMED).toEqual(["PROCESSING", "CANCELLED"]);
    expect(T.PROCESSING).toEqual(["SHIPPED", "CANCELLED"]);
    expect(T.SHIPPED).toEqual(["DELIVERED"]);
  });
  it("can't skip steps, go backwards, or cancel after shipping", () => {
    expect(T.PENDING).not.toContain("SHIPPED");
    expect(T.CONFIRMED).not.toContain("DELIVERED");
    expect(T.SHIPPED).not.toContain("CANCELLED");
    for (const to of Object.values(T).flat()) expect(to).not.toBe("PENDING");
  });
});
