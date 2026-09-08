import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth";
import { z } from "zod";

export async function PATCH(request: Request, { params }: { params: Promise<{ Id: string }> }) {
  try {
    const { supabase, user } = await requireRole(["admin"]);
    const { Id } = await params;
    const body = z.object({ isVisible: z.boolean() }).parse(await request.json());
    const { data, error } = await supabase
      .from("candidates")
      .update({ is_visible: body.isVisible, visibility_updated_at: new Date().toISOString(), visibility_updated_by: user.id })
      .eq("id", Id)
      .select("id,is_visible")
      .single();
    if (error) throw error;
    return NextResponse.json({ candidate: data });
  } catch (error) {
    return toErrorResponse(error, "ไม่สามารถเปลี่ยนสถานะการแสดงผลได้");
  }
}