import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getSession, type SessionUser } from "@/lib/session";
import { validateMemberAccess, MemberAccessError } from "@/lib/discord-members";
import { logAudit } from "@/lib/audit";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export function unauthorized() {
  return NextResponse.json(
    { error: "يجب تسجيل الدخول عبر ديسكورد أولًا" },
    { status: 401 },
  );
}

export function forbidden() {
  return NextResponse.json(
    { error: "هذه العملية للمشرفين فقط" },
    { status: 403 },
  );
}

export async function requireAuth(): Promise<SessionUser | NextResponse> {
  const h = await headers();
  if (!h.get("authorization")) {
    const origin = h.get("origin"),
      host = h.get("x-forwarded-host") || h.get("host");
    if (h.get("sec-fetch-site") === "cross-site") return forbidden();
    if (origin) {
      try {
        if (new URL(origin).host !== host) return forbidden();
      } catch {
        return forbidden();
      }
    }
  }
  const user = await getSession();
  if (!user) return unauthorized();
  try {
    return await validateMemberAccess(user);
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : "تعذر التحقق من العضوية" },
      e instanceof MemberAccessError ? e.status : 503,
    );
  }
}

export async function requireAdmin(): Promise<SessionUser | NextResponse> {
  const user = await requireAuth();
  if (isResponse(user)) return user;
  if (!user.isAdmin) return forbidden();
  return user;
}

export function isResponse(v: unknown): v is NextResponse {
  return v instanceof NextResponse;
}

export { logAudit };
