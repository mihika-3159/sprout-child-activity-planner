import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

const host = "http://localhost:3000";
const read = (path: string, cookie?: string) => new NextRequest(host + path, {
  headers: cookie ? { cookie } : {},
});

describe("Sprout admin route boundary", () => {
  it("blocks unauthenticated admin endpoints", async () => {
    process.env.ADMIN_PASSWORD = "test-password-1234567890-abcdefghijklmnopqrstuvwxyz";
    process.env.ADMIN_SESSION_SECRET = "test-secret-1234567890-abcdefghijklmnopqrstuvwxyz";
    for (const path of ["/api/admin/feedback", "/api/admin/evidence", "/api/admin/audits"]) {
      expect((await proxy(read(path))).status).toBe(401);
    }
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_SESSION_SECRET;
  });

  it("blocks public feedback enumeration", async () => {
    expect((await proxy(read("/api/feedback"))).status).toBe(405);
  });
});
