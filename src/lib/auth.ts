import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/domain";

/** Error carrying an HTTP status code, so API routes can respond correctly
 * instead of collapsing every failure into a generic 400. */
export class AppError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function requireRole(roles: AppRole[]) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AppError("UNAUTHORIZED", 401);
  const { data: profile } = await supabase.from("profiles").select("role,full_name").eq("id", user.id).single();
  if (!profile) throw new AppError("UNAUTHORIZED", 401);
  if (!roles.includes(profile.role as AppRole)) throw new AppError("FORBIDDEN", 403);
  return { supabase, user, profile: { role: profile.role as AppRole, fullName: profile.full_name as string | null } };
}

/**
 * Turns any error thrown in an API route into the right JSON response.
 * - AppError (from requireRole, or thrown manually) keeps its own status/message.
 * - Anything else falls back to a generic 400 with the caller-provided message,
 *   so unexpected errors don't leak internals but auth errors still surface as
 *   401/403 (fixing the bug where the client only redirects to /login on 401
 *   but every failure, including "not logged in", was coming back as 400).
 */
export function toErrorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof AppError) {
    const message = error.message === "UNAUTHORIZED" ? "กรุณาเข้าสู่ระบบ" : error.message === "FORBIDDEN" ? "ไม่มีสิทธิ์เข้าถึงข้อมูลนี้" : error.message;
    return NextResponse.json({ message }, { status: error.status });
  }
  if (process.env.NODE_ENV !== "production") {
    console.error(fallbackMessage, error);
  }
  return NextResponse.json({ message: fallbackMessage }, { status: 400 });
}