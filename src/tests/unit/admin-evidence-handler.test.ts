import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/admin/evidence/route";
import { adminCookieName, issueAdminToken } from "@/lib/auth/admin";

const endpoint = "http://localhost:3000/api/admin/evidence";
const originalPassword = process.env.ADMIN_PASSWORD;
const originalSecret = process.env.ADMIN_SESSION_SECRET;

beforeEach(() => {
  process.env.ADMIN_PASSWORD = "test-admin-password-1234567890-abcdefghijklmnopqrstuvwxyz";
  process.env.ADMIN_SESSION_SECRET = "test-admin-secret-1234567890-abcdefghijklmnopqrstuvwxyz";
});
afterEach(() => {
  if (originalPassword === undefined) delete process.env.ADMIN_PASSWORD;
  else process.env.ADMIN_PASSWORD = originalPassword;
  if (originalSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
  else process.env.ADMIN_SESSION_SECRET = originalSecret;
});

function request(body: unknown, cookie?: string, origin = "http://localhost:3000") {
  return new NextRequest(endpoint, {
    method: "POST",
    headers: { origin, "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}
async function cookie() {
  return `${adminCookieName()}=${await issueAdminToken()}`;
}

describe("admin evidence direct-handler security", () => {
  it("rejects anonymous GET", async () => {
    expect((await GET(new NextRequest(endpoint))).status).toBe(401);
  });
  it("rejects anonymous POST", async () => {
    expect((await POST(request({ action: "update_status", chunkId: "c1", status: "approved" }))).status).toBe(401);
  });
  it("rejects cross-origin admin POST", async () => {
    expect((await POST(request({ action: "update_status", chunkId: "c1", status: "approved" }, await cookie(), "https://outside.invalid"))).status).toBe(403);
  });
  it("rejects null body", async () => {
    expect((await POST(request(null, await cookie()))).status).toBe(400);
  });
  it("rejects invalid approval state", async () => {
    expect((await POST(request({ action: "update_status", chunkId: "c1", status: "auto_approved" }, await cookie()))).status).toBe(400);
  });
  it("rejects unknown license", async () => {
    expect((await POST(request({ action: "add_source", sourceName: "Example", sourceUrl: "https://example.org", license: "UNVERIFIED" }, await cookie()))).status).toBe(400);
  });
  it("rejects unsafe URL", async () => {
    expect((await POST(request({ action: "add_source", sourceName: "Example", sourceUrl: "javascript:alert(1)", license: "CC_BY" }, await cookie()))).status).toBe(400);
  });
  it("rejects invalid age range", async () => {
    expect((await POST(request({ action: "add_chunk", sourceId: "example", chunkText: "Example evidence text long enough for validation.", sourceTitle: "Example source", ageRangeMin: 12, ageRangeMax: 3 }, await cookie()))).status).toBe(400);
  });
});
