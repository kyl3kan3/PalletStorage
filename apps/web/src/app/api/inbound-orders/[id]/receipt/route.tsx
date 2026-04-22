import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  renderToBuffer,
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import bwipjs from "bwip-js/node";
import { db, schema } from "@wms/db";
import { toCode128 } from "@wms/core";
import { and, eq } from "drizzle-orm";

/**
 * GET /api/inbound-orders/:id/receipt(.pdf) — paper receipt for a
 * delivered inbound order. Prints on a Letter portrait page:
 * organization + supplier header, PO reference + dates, per-line
 * expected / received / variance (+ lot & expiry when captured),
 * signature blocks for the receiver and the delivery driver, and a
 * Code128 barcode of the PO reference at the bottom for filing.
 *
 * Accessible to any signed-in user in the owning org; status doesn't
 * need to be 'closed' — a receiver often hands a printed receipt to
 * the driver while receiving, with partial qtys recorded mid-flow.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId, orgId: clerkOrgId } = await auth();
  if (!userId || !clerkOrgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: raw } = await ctx.params;
  const id = raw.replace(/\.pdf$/, "");

  const [org] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.clerkOrgId, clerkOrgId))
    .limit(1);
  if (!org) return NextResponse.json({ error: "org not provisioned" }, { status: 400 });

  const [order] = await db
    .select()
    .from(schema.inboundOrders)
    .where(
      and(
        eq(schema.inboundOrders.id, id),
        eq(schema.inboundOrders.organizationId, org.id),
      ),
    )
    .limit(1);
  if (!order) return NextResponse.json({ error: "order not found" }, { status: 404 });

  // Lines joined with product + one (oldest) palletItem per (product, order)
  // to surface lot and expiry on the receipt. This is fuzzy — QBO/
  // traceability systems do this more rigorously; here we just show
  // the first lot we find so the driver has something to sign next to.
  const lines = await db
    .select({
      id: schema.inboundLines.id,
      productId: schema.inboundLines.productId,
      qtyExpected: schema.inboundLines.qtyExpected,
      qtyReceived: schema.inboundLines.qtyReceived,
      sku: schema.products.sku,
      name: schema.products.name,
    })
    .from(schema.inboundLines)
    .innerJoin(schema.products, eq(schema.products.id, schema.inboundLines.productId))
    .where(
      and(
        eq(schema.inboundLines.inboundOrderId, order.id),
        eq(schema.inboundLines.organizationId, org.id),
      ),
    );

  // Fetch a first-seen lot/expiry per product on received pallets tied
  // to this org — best-effort, nullable in the output.
  const productIds = lines.map((l) => l.productId);
  const lotLookups = new Map<string, { lot: string | null; expiry: Date | null }>();
  if (productIds.length > 0) {
    const rows = await db
      .select({
        productId: schema.palletItems.productId,
        lot: schema.palletItems.lot,
        expiry: schema.palletItems.expiry,
      })
      .from(schema.palletItems)
      .where(eq(schema.palletItems.organizationId, org.id))
      .limit(500);
    for (const r of rows) {
      if (!lotLookups.has(r.productId)) {
        lotLookups.set(r.productId, { lot: r.lot, expiry: r.expiry });
      }
    }
  }

  // Supplier — prefer the linked record if present, fall back to the
  // free-text label.
  let supplierName = order.supplier ?? "";
  let supplierAddress: string[] = [];
  if (order.supplierId) {
    const [s] = await db
      .select()
      .from(schema.suppliers)
      .where(eq(schema.suppliers.id, order.supplierId))
      .limit(1);
    if (s) {
      supplierName = s.name;
      supplierAddress = [
        s.addressLine1,
        s.addressLine2,
        [s.city, s.region].filter(Boolean).join(", "),
        [s.postalCode, s.country].filter(Boolean).join(" "),
      ].filter(Boolean) as string[];
    }
  }

  const orgAddress = [
    org.addressLine1,
    org.addressLine2,
    [org.city, org.region].filter(Boolean).join(", "),
    [org.postalCode, org.country].filter(Boolean).join(" "),
  ].filter(Boolean) as string[];

  const barcodePng = await bwipjs.toBuffer({
    bcid: "code128",
    text: toCode128(order.reference),
    scale: 3,
    height: 14,
    includetext: false,
    paddingwidth: 4,
    paddingheight: 4,
  });
  const barcodeDataUrl = `data:image/png;base64,${Buffer.from(barcodePng).toString("base64")}`;

  const pdf = await renderToBuffer(
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orgName}>{org.legalName ?? org.name}</Text>
            {orgAddress.map((l, i) => (
              <Text key={i} style={styles.addressLine}>
                {l}
              </Text>
            ))}
          </View>
          <Text style={styles.title}>RECEIVING RECEIPT</Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>PO / Reference</Text>
            <Text style={styles.metaValue}>{order.reference}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Expected</Text>
            <Text style={styles.metaValue}>
              {order.expectedAt?.toLocaleDateString() ?? "—"}
            </Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Received on</Text>
            <Text style={styles.metaValue}>
              {order.closedAt?.toLocaleDateString() ??
                order.receivedAt?.toLocaleDateString() ??
                new Date().toLocaleDateString()}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={[styles.metaCol, { flex: 2 }]}>
            <Text style={styles.metaLabel}>Supplier</Text>
            <Text style={styles.metaValue}>{supplierName || "—"}</Text>
            {supplierAddress.map((l, i) => (
              <Text key={i} style={styles.addressLine}>
                {l}
              </Text>
            ))}
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Status</Text>
            <Text style={styles.metaValue}>{order.status}</Text>
            {order.closeReason && (
              <Text style={styles.muted}>Reason: {order.closeReason}</Text>
            )}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.cell, styles.colSku]}>SKU</Text>
            <Text style={[styles.cell, styles.colName]}>Description</Text>
            <Text style={[styles.cell, styles.colLot]}>Lot / Expiry</Text>
            <Text style={[styles.cell, styles.colNum]}>Exp</Text>
            <Text style={[styles.cell, styles.colNum]}>Rcvd</Text>
            <Text style={[styles.cell, styles.colNum]}>Var</Text>
          </View>
          {lines.map((l) => {
            const lot = lotLookups.get(l.productId);
            const variance = l.qtyReceived - l.qtyExpected;
            return (
              <View key={l.id} style={styles.tableRow}>
                <Text style={[styles.cell, styles.colSku]}>{l.sku}</Text>
                <Text style={[styles.cell, styles.colName]}>{l.name}</Text>
                <Text style={[styles.cell, styles.colLot]}>
                  {lot?.lot ?? "—"}
                  {lot?.expiry ? ` · ${lot.expiry.toLocaleDateString()}` : ""}
                </Text>
                <Text style={[styles.cell, styles.colNum]}>{l.qtyExpected}</Text>
                <Text style={[styles.cell, styles.colNum]}>{l.qtyReceived}</Text>
                <Text style={[styles.cell, styles.colNum]}>
                  {variance === 0 ? "0" : variance > 0 ? `+${variance}` : String(variance)}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={styles.signRow}>
          <View style={styles.signBox}>
            <Text style={styles.signLabel}>Received by (print + sign)</Text>
          </View>
          <View style={styles.signBox}>
            <Text style={styles.signLabel}>Driver signature</Text>
          </View>
          <View style={styles.signBox}>
            <Text style={styles.signLabel}>Date</Text>
          </View>
        </View>

        <View style={styles.barcodeRow}>
          <Image src={barcodeDataUrl} style={styles.barcode} />
          <Text style={styles.refCode}>{order.reference}</Text>
        </View>
      </Page>
    </Document>,
  );

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="receipt-${order.reference}.pdf"`,
    },
  });
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderColor: "#1F1A17",
    paddingBottom: 8,
  },
  orgName: { fontSize: 14, fontWeight: "bold", color: "#1F1A17" },
  addressLine: { fontSize: 9, color: "#5A4F46", marginTop: 1 },
  title: { fontSize: 18, fontWeight: "bold", color: "#1F1A17" },
  metaRow: { flexDirection: "row", marginBottom: 10 },
  metaCol: { flex: 1, paddingRight: 8 },
  metaLabel: { fontSize: 8, color: "#8B7F73", textTransform: "uppercase", marginBottom: 2 },
  metaValue: { fontSize: 11, color: "#1F1A17" },
  muted: { fontSize: 9, color: "#8B7F73", marginTop: 2 },
  table: { marginTop: 14, borderWidth: 1, borderColor: "#1F1A17" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F3ECDD",
    borderBottomWidth: 1,
    borderColor: "#1F1A17",
    paddingVertical: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderColor: "#C9BFB3",
    paddingVertical: 5,
  },
  cell: { paddingHorizontal: 6, fontSize: 9 },
  colSku: { width: "15%" },
  colName: { width: "30%" },
  colLot: { width: "25%" },
  colNum: { width: "10%", textAlign: "right" },
  signRow: { flexDirection: "row", marginTop: 40 },
  signBox: {
    flex: 1,
    borderTopWidth: 1,
    borderColor: "#1F1A17",
    marginHorizontal: 6,
    paddingTop: 4,
  },
  signLabel: { fontSize: 8, color: "#5A4F46" },
  barcodeRow: { marginTop: 32, alignItems: "center" },
  barcode: { width: 260, height: 60, objectFit: "contain" },
  refCode: { fontFamily: "Courier", fontSize: 12, marginTop: 4 },
});
