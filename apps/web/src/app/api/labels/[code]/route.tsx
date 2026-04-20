import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { renderToBuffer, Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import bwipjs from "bwip-js/node";
import { db, schema } from "@wms/db";
import { toCode128, toQrPayload } from "@wms/core";
import { and, eq } from "drizzle-orm";

/**
 * GET /api/labels/:code.pdf — returns a 4x6 inch label PDF (Code128 + QR)
 * for the scanned label code. Code128 image is rendered as PNG data URL
 * using bwip-js, then embedded into the PDF.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { code: raw } = await ctx.params;
  const code = raw.replace(/\.pdf$/, "");

  const [org] = await db
    .select({ id: schema.organizations.id, name: schema.organizations.name })
    .from(schema.organizations)
    .where(eq(schema.organizations.clerkOrgId, orgId))
    .limit(1);
  if (!org) return NextResponse.json({ error: "org not provisioned" }, { status: 400 });

  const [label] = await db
    .select()
    .from(schema.labelCodes)
    .where(and(eq(schema.labelCodes.code, code), eq(schema.labelCodes.organizationId, org.id)))
    .limit(1);
  if (!label) return NextResponse.json({ error: "label not found" }, { status: 404 });

  const barcodePng = await bwipjs.toBuffer({
    bcid: "code128",
    text: toCode128(code),
    scale: 3,
    height: 14,
    includetext: false,
    paddingwidth: 4,
    paddingheight: 4,
  });
  const barcodeDataUrl = `data:image/png;base64,${Buffer.from(barcodePng).toString("base64")}`;

  const qrPng = await bwipjs.toBuffer({
    bcid: "qrcode",
    text: toQrPayload(label.kind, code),
    scale: 4,
    paddingwidth: 4,
    paddingheight: 4,
  });
  const qrDataUrl = `data:image/png;base64,${Buffer.from(qrPng).toString("base64")}`;

  const pdf = await renderToBuffer(
    <Document>
      <Page size={{ width: 288, height: 432 }} style={styles.page}>
        <Text style={styles.org}>{org.name}</Text>
        <Text style={styles.kind}>{label.kind.toUpperCase()}</Text>
        <Image src={barcodeDataUrl} style={styles.barcode} />
        <Text style={styles.code}>{code}</Text>
        <View style={styles.qrRow}>
          <Image src={qrDataUrl} style={styles.qr} />
        </View>
      </Page>
    </Document>,
  );

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${code}.pdf"`,
    },
  });
}

const styles = StyleSheet.create({
  page: { padding: 16, alignItems: "center", justifyContent: "space-between" },
  org: { fontSize: 12, color: "#444" },
  kind: { fontSize: 16, fontWeight: "bold", marginVertical: 6 },
  barcode: { width: 256, height: 70, objectFit: "contain" },
  code: { fontSize: 16, fontFamily: "Courier", marginTop: 4 },
  qrRow: { marginTop: 8 },
  qr: { width: 120, height: 120 },
});
