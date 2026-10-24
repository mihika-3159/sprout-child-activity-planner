import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";

describe("admin mutation origin", () => {
  it("rejects a cross-site PATCH before checking cookies", async () => {
    const request = new NextRequest("http://localhost:3000/api/admin/feedback", {
      method: "PATCH",
      headers: { origin: "https://outside.invalid", "content-type": "application/json" },
      body: "{}",
    });
    const response = await requireAdmin(request, true);
    expect(response?.status).toBe(403);
  });
});
