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
import { z } from "zod";
import { db, schema } from "@wms/db";
import { toCode128 } from "@wms/core";
import { computeBillingPeriod } from "@wms/api/billing/calculate";
import { and, eq } from "drizzle-orm";

/**
 * GET /api/customers/:id/bill?from=<iso>&to=<iso> — branded monthly
 * storage statement for a single customer. Reuses computeBillingPeriod
 * so the numbers match the on-screen report exactly.
 */
export const runtime = "nodejs";

const queryShape = z.object({
  from: z.string().datetime().or(z.string().date()),
  to: z.string().datetime().or(z.string().date()),
});

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { userId, orgId: clerkOrgId } = await auth();
  if (!userId || !clerkOrgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const parsed = queryShape.safeParse({
    from: url.searchParams.get("from") ?? "",
    to: url.searchParams.get("to") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "from + to query params required (ISO date)" },
      { status: 400 },
    );
  }
  const from = new Date(parsed.data.from);
  const to = new Date(parsed.data.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return NextResponse.json({ error: "invalid date" }, { status: 400 });
  }

  const [org] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.clerkOrgId, clerkOrgId))
    .limit(1);
  if (!org) {
    return NextResponse.json({ error: "org not provisioned" }, { status: 400 });
  }

  const [customer] = await db
    .select()
    .from(schema.customers)
    .where(
      and(
        eq(schema.customers.id, id),
        eq(schema.customers.organizationId, org.id),
      ),
    )
    .limit(1);
  if (!customer) {
    return NextResponse.json({ error: "customer not found" }, { status: 404 });
  }

  const rows = await computeBillingPeriod(db, org.id, id, from, to);
  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: "no billing data" }, { status: 404 });
  }

  // Code128 of customer-id + month for filing the printed statement.
  const period = `${from.getUTCFullYear()}-${String(from.getUTCMonth() + 1).padStart(2, "0")}`;
  const barcodeBuf = await bwipjs.toBuffer({
    bcid: "code128",
    text: toCode128(`${id.slice(0, 8)}-${period}`),
    scale: 2,
    height: 8,
    includetext: false,
  });
  const barcodeDataUri = `data:image/png;base64,${barcodeBuf.toString("base64")}`;

  const doc = (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.orgName}>
              {org.legalName ?? org.name}
            </Text>
            {org.addressLine1 && <Text style={styles.dim}>{org.addressLine1}</Text>}
            {org.addressLine2 && <Text style={styles.dim}>{org.addressLine2}</Text>}
            <Text style={styles.dim}>
              {[org.city, org.region].filter(Boolean).join(", ")}
              {org.postalCode ? ` ${org.postalCode}` : ""}
            </Text>
            {org.country && <Text style={styles.dim}>{org.country}</Text>}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.title}>Storage statement</Text>
            <Text style={styles.dim}>{period}</Text>
            <Text style={styles.dim}>
              {from.toLocaleDateString()} – {to.toLocaleDateString()}
            </Text>
          </View>
        </View>

        <View style={styles.billTo}>
          <Text style={styles.dim}>Bill to</Text>
          <Text style={styles.customerName}>{customer.name}</Text>
          {customer.billingLine1 && <Text style={styles.dim}>{customer.billingLine1}</Text>}
          {customer.billingLine2 && <Text style={styles.dim}>{customer.billingLine2}</Text>}
          <Text style={styles.dim}>
            {[customer.billingCity, customer.billingRegion].filter(Boolean).join(", ")}
            {customer.billingPostalCode ? ` ${customer.billingPostalCode}` : ""}
          </Text>
          {customer.billingCountry && <Text style={styles.dim}>{customer.billingCountry}</Text>}
        </View>

        <View style={styles.tableHeader}>
          <Text style={[styles.cell, styles.colItem]}>Item</Text>
          <Text style={[styles.cell, styles.colQty]}>Qty</Text>
          <Text style={[styles.cell, styles.colRate]}>Rate</Text>
          <Text style={[styles.cell, styles.colAmount]}>Amount</Text>
        </View>

        {row.storageRateCentsPerPalletMonth != null && (
          <View style={styles.row}>
            <Text style={[styles.cell, styles.colItem]}>
              Pallet storage — peak in period
            </Text>
            <Text style={[styles.cell, styles.colQty]}>{row.peakCount}</Text>
            <Text style={[styles.cell, styles.colRate]}>
              {fmt(row.storageRateCentsPerPalletMonth)} /pallet/mo
            </Text>
            <Text style={[styles.cell, styles.colAmount]}>
              {fmt(row.storageChargeCents)}
            </Text>
          </View>
        )}
        {row.receiveRateCentsPerPallet != null && (
          <View style={styles.row}>
            <Text style={[styles.cell, styles.colItem]}>
              Inbound handling
            </Text>
            <Text style={[styles.cell, styles.colQty]}>{row.receives}</Text>
            <Text style={[styles.cell, styles.colRate]}>
              {fmt(row.receiveRateCentsPerPallet)} /pallet
            </Text>
            <Text style={[styles.cell, styles.colAmount]}>
              {fmt(row.receiveChargeCents)}
            </Text>
          </View>
        )}
        {row.shipRateCentsPerPallet != null && (
          <View style={styles.row}>
            <Text style={[styles.cell, styles.colItem]}>
              Outbound handling
            </Text>
            <Text style={[styles.cell, styles.colQty]}>{row.ships}</Text>
            <Text style={[styles.cell, styles.colRate]}>
              {fmt(row.shipRateCentsPerPallet)} /pallet
            </Text>
            <Text style={[styles.cell, styles.colAmount]}>
              {fmt(row.shipChargeCents)}
            </Text>
          </View>
        )}

        <View style={styles.totalRow}>
          <Text style={[styles.cell, styles.colItem]}> </Text>
          <Text style={[styles.cell, styles.colQty]}> </Text>
          <Text style={[styles.cell, styles.colRate, styles.totalLabel]}>Total</Text>
          <Text style={[styles.cell, styles.colAmount, styles.totalAmount]}>
            {fmt(row.totalChargeCents)}
          </Text>
        </View>

        <View style={styles.footnote}>
          <Text style={styles.dim}>
            Opening pallets: {row.openingCount} · Current: {row.currentCount} · Peak: {row.peakCount}
          </Text>
          {!row.hasRates && (
            <Text style={[styles.dim, { color: "#a0392f" }]}>
              Note: this customer has incomplete rates — some line items may show $0.
            </Text>
          )}
        </View>

        <View style={styles.barcodeRow}>
          <Image src={barcodeDataUri} style={styles.barcode} />
          <Text style={styles.barcodeText}>
            {id.slice(0, 8)}-{period}
          </Text>
        </View>

        {(org.billingEmail || org.phone) && (
          <View style={styles.contactRow}>
            <Text style={styles.dim}>
              {[org.billingEmail, org.phone].filter(Boolean).join(" · ")}
            </Text>
          </View>
        )}
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(doc);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="bill-${customer.name.replace(/[^a-z0-9]/gi, "_")}-${period}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

function fmt(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, color: "#1F1A17", fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  headerLeft: { flexDirection: "column", gap: 2 },
  headerRight: { flexDirection: "column", alignItems: "flex-end", gap: 2 },
  orgName: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  title: { fontSize: 16, fontWeight: 700 },
  dim: { fontSize: 10, color: "#6c625a" },
  billTo: { marginBottom: 18, padding: 12, backgroundColor: "#faf6ee", borderRadius: 6 },
  customerName: { fontSize: 14, fontWeight: 700, marginVertical: 4 },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: "#1F1A17",
    fontWeight: 700,
    fontSize: 10,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#dcd3c4",
  },
  cell: { fontSize: 11 },
  colItem: { flex: 3 },
  colQty: { flex: 1, textAlign: "right" },
  colRate: { flex: 1.5, textAlign: "right" },
  colAmount: { flex: 1.2, textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    paddingVertical: 12,
    borderTopWidth: 1.5,
    borderTopColor: "#1F1A17",
    marginTop: 6,
  },
  totalLabel: { fontSize: 12, fontWeight: 700 },
  totalAmount: { fontSize: 13, fontWeight: 700 },
  footnote: { marginTop: 14, gap: 2 },
  barcodeRow: {
    marginTop: 28,
    flexDirection: "column",
    alignItems: "center",
  },
  barcode: { width: 220, height: 36 },
  barcodeText: { fontSize: 9, color: "#6c625a", marginTop: 2 },
  contactRow: { marginTop: 14, alignItems: "center" },
});
