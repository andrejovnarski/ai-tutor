import { NextResponse } from "next/server";
import { requireParent } from "@/server/parentGate";
import { exportKid } from "@/server/rights";

export async function GET(_req: Request, { params }: { params: Promise<{ kidId: string }> }) {
  const { kidId } = await params;
  const { supabase } = await requireParent();
  const data = await exportKid(supabase, kidId);
  if (!data) return new NextResponse("not found", { status: 404 });
  const name = data.kid.nickname.replace(/[^A-Za-z0-9_-]/g, "_");
  return new NextResponse(JSON.stringify(data), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="${name}-data.json"`,
      "cache-control": "no-store",
    },
  });
}
