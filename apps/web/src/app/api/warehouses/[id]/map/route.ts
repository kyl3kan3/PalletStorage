import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@wms/db";
import { and, eq } from "drizzle-orm";

/**
 * GET /api/warehouses/<id>/map
 *
 * Serves the bytes of an uploaded floor-map PDF stored inline on the
 * warehouse row. Tenant-scoped via Clerk: only members of the org
 * that owns the warehouse can fetch its map.
 */
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return new Response("unauthorized", { status: 401 });
  }

  const { id: warehouseId } = await params;

  const [org] = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(eq(schema.organizations.clerkOrgId, orgId))
    .limit(1);
  if (!org) return new Response("org not provisioned", { status: 403 });

  const [wh] = await db
    .select({
      data: schema.warehouses.mapPdfData,
      filename: schema.warehouses.mapPdfFilename,
    })
    .from(schema.warehouses)
    .where(
      and(
        eq(schema.warehouses.id, warehouseId),
        eq(schema.warehouses.organizationId, org.id),
      ),
    )
    .limit(1);
  if (!wh?.data) return new Response("map not found", { status: 404 });

  const buf = Buffer.from(wh.data);
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${wh.filename ?? "floor-map.pdf"}"`,
      // Cache briefly on the browser side — refreshes come via the
      // versioned query param we append on upload.
      "Cache-Control": "private, max-age=60",
    },
  });
}
