import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@wms/db";
import { and, eq } from "drizzle-orm";

/**
 * POST /api/warehouses/<id>/upload-map
 *
 * Accepts a multipart form with a `file` field containing a PDF and
 * stores the bytes inline in warehouses.map_pdf_data. Also sets
 * map_pdf_url to a local serve URL so the PdfMapEditor renders it.
 *
 * Capped at 4MB to stay well under Vercel's serverless body limit.
 * For warehouses with larger floor plans, paste an external URL into
 * the URL field instead.
 */
export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: warehouseId } = await params;

  // Resolve internal org id from Clerk's org id.
  const [org] = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(eq(schema.organizations.clerkOrgId, orgId))
    .limit(1);
  if (!org) {
    return NextResponse.json({ error: "org not provisioned" }, { status: 403 });
  }

  // Verify the caller's warehouse belongs to their org before writing.
  const [wh] = await db
    .select({ id: schema.warehouses.id })
    .from(schema.warehouses)
    .where(
      and(
        eq(schema.warehouses.id, warehouseId),
        eq(schema.warehouses.organizationId, org.id),
      ),
    )
    .limit(1);
  if (!wh) {
    return NextResponse.json({ error: "warehouse not found" }, { status: 404 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }
  if (file.type && file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "file must be a PDF" },
      { status: 400 },
    );
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json(
      { error: `PDF is ${Math.round(bytes.byteLength / 1024 / 1024)}MB — max ${MAX_BYTES / 1024 / 1024}MB. Compress or use the URL option instead.` },
      { status: 413 },
    );
  }

  const localUrl = `/api/warehouses/${warehouseId}/map?v=${Date.now()}`;
  await db
    .update(schema.warehouses)
    .set({
      mapPdfData: bytes,
      mapPdfFilename: file.name,
      mapPdfUrl: localUrl,
    })
    .where(eq(schema.warehouses.id, warehouseId));

  return NextResponse.json({ url: localUrl, filename: file.name });
}
