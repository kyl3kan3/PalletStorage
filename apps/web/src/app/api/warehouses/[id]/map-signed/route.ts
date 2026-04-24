import { auth } from "@clerk/nextjs/server";
import { createHmac } from "node:crypto";
import { db, schema } from "@wms/db";
import { and, eq } from "drizzle-orm";

/**
 * GET /api/warehouses/<id>/map-signed?exp=<ms>&sig=<hex>
 *
 * Time-limited, unauthenticated route that serves a warehouse's
 * floor-map PDF. Used so third-party services (currently Firecrawl's
 * PDF parser) can fetch the file without a Clerk session. The sig is
 * an HMAC-SHA256 of `${id}.${exp}` keyed by CLERK_SECRET_KEY (the
 * same shared secret that protects all server-side auth), so only
 * our server can mint valid URLs.
 *
 * Paired with signMapUrl() in ~/lib/signed-map-url.ts on the server.
 */
export const runtime = "nodejs";

function verify(id: string, exp: string, sig: string): boolean {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(`${id}.${exp}`).digest("hex");
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return diff === 0;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const url = new URL(req.url);
  const exp = url.searchParams.get("exp");
  const sig = url.searchParams.get("sig");
  const { id: warehouseId } = await params;

  // If signed params are missing, fall back to Clerk-session auth so
  // same-origin browser fetches still work (pdfjs renders via fetch()
  // and sends cookies).
  if (!exp || !sig) {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return new Response("unauthorized", { status: 401 });
    }
    const [org] = await db
      .select({ id: schema.organizations.id })
      .from(schema.organizations)
      .where(eq(schema.organizations.clerkOrgId, orgId))
      .limit(1);
    if (!org) return new Response("org not provisioned", { status: 403 });
    return serveMap(warehouseId, org.id);
  }

  // Signed URL path. Exp is ms since epoch; reject if expired or sig
  // doesn't match. We don't check org here because the signature
  // effectively gates access — only server code has the HMAC key.
  const expMs = Number(exp);
  if (!Number.isFinite(expMs) || Date.now() > expMs) {
    return new Response("link expired", { status: 410 });
  }
  if (!verify(warehouseId, exp, sig)) {
    return new Response("bad signature", { status: 403 });
  }

  // Look up the warehouse directly — signature already authorized us.
  const [wh] = await db
    .select({
      orgId: schema.warehouses.organizationId,
      data: schema.warehouses.mapPdfData,
      filename: schema.warehouses.mapPdfFilename,
    })
    .from(schema.warehouses)
    .where(eq(schema.warehouses.id, warehouseId))
    .limit(1);
  if (!wh?.data) return new Response("map not found", { status: 404 });

  const buf = Buffer.from(wh.data);
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${wh.filename ?? "floor-map.pdf"}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}

async function serveMap(warehouseId: string, orgId: string) {
  const [wh] = await db
    .select({
      data: schema.warehouses.mapPdfData,
      filename: schema.warehouses.mapPdfFilename,
    })
    .from(schema.warehouses)
    .where(
      and(
        eq(schema.warehouses.id, warehouseId),
        eq(schema.warehouses.organizationId, orgId),
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
      "Cache-Control": "private, max-age=60",
    },
  });
}
