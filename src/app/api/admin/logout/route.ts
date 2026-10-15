import { NextRequest, NextResponse } from "next/server";
import { clearAdminCookie, validateMutationRequest } from "@/lib/auth/admin";

export async function POST(request: NextRequest) {
  const invalid = validateMutationRequest(request);
  if (invalid) return invalid;
  return clearAdminCookie(NextResponse.json({ success: true }));
}
