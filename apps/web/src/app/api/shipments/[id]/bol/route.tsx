import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@wms/db";
import { eq } from "drizzle-orm";
import { renderBolPdf } from "~/lib/render-bol";

/**
 * GET /api/shipments/:id/bol(.pdf) — renders a Bill Of Lading. The
 * actual PDF construction lives in `~/lib/render-bol` so the email
 * route can reuse it.
 */
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { userId, orgId: clerkOrgId } = await auth();
  if (!userId || !clerkOrgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id: raw } = await ctx.params;
  const id = raw.replace(/\.pdf$/, "");

  const [org] = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(eq(schema.organizations.clerkOrgId, clerkOrgId))
    .limit(1);
  if (!org)
    return NextResponse.json({ error: "org not provisioned" }, { status: 400 });

  const result = await renderBolPdf(id, org.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return new NextResponse(new Uint8Array(result.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${result.bolNumber}.pdf"`,
    },
  });
}
