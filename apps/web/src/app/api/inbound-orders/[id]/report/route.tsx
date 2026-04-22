import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  renderToBuffer,
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer";
import { db, schema } from "@wms/db";
import { and, desc, eq } from "drizzle-orm";

/**
 * GET /api/inbound-orders/:id/report(.pdf) — audit-style report for a
 * single inbound order. Distinct from the receipt at /receipt (which
 * is signature-ready for drivers): this is a richer summary for
 * office / records use.
 *
 * Includes: status + dates + supplier + customer + receiving location
 * header block; per-line expected / received / variance table with
 * SKU + name; movement history (receive/putaway/adjust events that
 * reference this order); close / cancel reason when applicable.
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

  // Movements that reference this order.
  const movements = await db
    .select({
      id: schema.movements.id,
      palletId: schema.movements.palletId,
      reason: schema.movements.reason,
      fromLocationId: schema.movements.fromLocationId,
      toLocationId: schema.movements.toLocationId,
      notes: schema.movements.notes,
      createdAt: schema.movements.createdAt,
    })
    .from(schema.movements)
    .where(
      and(
        eq(schema.movements.organizationId, org.id),
        eq(schema.movements.refType, "inbound_order"),
        eq(schema.movements.refId, order.id),
      ),
    )
    .orderBy(desc(schema.movements.createdAt))
    .limit(200);

  let supplierName = order.supplier ?? "";
  let supplierAddr: string[] = [];
  if (order.supplierId) {
    const [s] = await db
      .select()
      .from(schema.suppliers)
      .where(eq(schema.suppliers.id, order.supplierId))
      .limit(1);
    if (s) {
      supplierName = s.name;
      supplierAddr = [
        s.addressLine1,
        s.addressLine2,
        [s.city, s.region].filter(Boolean).join(", "),
        [s.postalCode, s.country].filter(Boolean).join(" "),
      ].filter(Boolean) as string[];
    }
  }

  let customerName: string | null = null;
  if (order.customerId) {
    const [c] = await db
      .select({ name: schema.customers.name })
      .from(schema.customers)
      .where(eq(schema.customers.id, order.customerId))
      .limit(1);
    customerName = c?.name ?? null;
  }

  let receivingLocPath: string | null = null;
  if (order.receivingLocationId) {
    const [l] = await db
      .select({ path: schema.locations.path })
      .from(schema.locations)
      .where(eq(schema.locations.id, order.receivingLocationId))
      .limit(1);
    receivingLocPath = l?.path ?? null;
  }

  const totalExpected = lines.reduce((s, l) => s + l.qtyExpected, 0);
  const totalReceived = lines.reduce((s, l) => s + l.qtyReceived, 0);
  const variance = totalReceived - totalExpected;

  const pdf = await renderToBuffer(
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header} fixed>
          <View style={{ flex: 1 }}>
            <Text style={styles.orgName}>{org.legalName ?? org.name}</Text>
            <Text style={styles.reportTitle}>Inbound Order Report</Text>
          </View>
          <View style={styles.meta}>
            <Text style={styles.metaLabel}>Reference</Text>
            <Text style={styles.metaValue}>{order.reference}</Text>
            <Text style={styles.metaLabel}>Status</Text>
            <Text style={styles.metaValue}>{order.status}</Text>
          </View>
        </View>

        <View style={styles.row3}>
          <Meta label="Created">{order.createdAt.toLocaleDateString()}</Meta>
          <Meta label="Expected">
            {order.expectedAt?.toLocaleDateString() ?? "—"}
          </Meta>
          <Meta label="Closed">
            {order.closedAt?.toLocaleDateString() ?? "—"}
          </Meta>
        </View>

        <View style={styles.row3}>
          <Meta label="Supplier">
            <Text>{supplierName || "—"}</Text>
            {supplierAddr.map((l, i) => (
              <Text key={i} style={styles.addr}>
                {l}
              </Text>
            ))}
          </Meta>
          <Meta label="Customer (3PL client)">
            <Text>{customerName ?? "—"}</Text>
          </Meta>
          <Meta label="Receiving location">
            <Text>{receivingLocPath ?? "—"}</Text>
          </Meta>
        </View>

        {order.closeReason && (
          <View style={styles.reason}>
            <Text style={styles.reasonLabel}>Close reason</Text>
            <Text>{order.closeReason}</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Lines</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.cell, styles.colSku]}>SKU</Text>
            <Text style={[styles.cell, styles.colName]}>Description</Text>
            <Text style={[styles.cell, styles.colNum]}>Expected</Text>
            <Text style={[styles.cell, styles.colNum]}>Received</Text>
            <Text style={[styles.cell, styles.colNum]}>Variance</Text>
          </View>
          {lines.map((l) => {
            const v = l.qtyReceived - l.qtyExpected;
            return (
              <View key={l.id} style={styles.tableRow}>
                <Text style={[styles.cell, styles.colSku]}>{l.sku ?? "—"}</Text>
                <Text style={[styles.cell, styles.colName]}>{l.name}</Text>
                <Text style={[styles.cell, styles.colNum]}>{l.qtyExpected}</Text>
                <Text style={[styles.cell, styles.colNum]}>{l.qtyReceived}</Text>
                <Text style={[styles.cell, styles.colNum]}>
                  {v === 0 ? "0" : v > 0 ? `+${v}` : String(v)}
                </Text>
              </View>
            );
          })}
          <View style={[styles.tableRow, styles.totalRow]}>
            <Text style={[styles.cell, styles.colSku]} />
            <Text style={[styles.cell, styles.colName, { fontWeight: "bold" }]}>
              Totals
            </Text>
            <Text style={[styles.cell, styles.colNum, { fontWeight: "bold" }]}>
              {totalExpected}
            </Text>
            <Text style={[styles.cell, styles.colNum, { fontWeight: "bold" }]}>
              {totalReceived}
            </Text>
            <Text style={[styles.cell, styles.colNum, { fontWeight: "bold" }]}>
              {variance === 0 ? "0" : variance > 0 ? `+${variance}` : String(variance)}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Activity</Text>
        {movements.length === 0 ? (
          <Text style={styles.empty}>No movements recorded against this order.</Text>
        ) : (
          <View style={styles.movements}>
            {movements.map((m) => (
              <View key={m.id} style={styles.movementRow}>
                <Text style={styles.mvWhen}>{m.createdAt.toLocaleString()}</Text>
                <Text style={styles.mvReason}>{m.reason}</Text>
                <Text style={styles.mvBody}>
                  {m.palletId ? `pallet ${m.palletId.slice(0, 8)}` : ""}
                  {m.notes ? ` · ${m.notes}` : ""}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>,
  );

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="inbound-${order.reference}.pdf"`,
    },
  });
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.metaBlock}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  header: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#1F1A17",
    paddingBottom: 8,
    marginBottom: 14,
  },
  orgName: { fontSize: 12, color: "#5A4F46" },
  reportTitle: { fontSize: 20, fontWeight: "bold", color: "#1F1A17", marginTop: 2 },
  meta: { minWidth: 160 },
  metaBlock: { flex: 1, paddingRight: 8 },
  metaLabel: {
    fontSize: 8,
    color: "#8B7F73",
    textTransform: "uppercase",
    marginTop: 4,
  },
  metaValue: { fontSize: 11, color: "#1F1A17" },
  addr: { fontSize: 9, color: "#5A4F46" },
  row3: { flexDirection: "row", marginBottom: 10 },
  reason: {
    marginTop: 6,
    marginBottom: 10,
    backgroundColor: "#FFDFDA",
    padding: 8,
    borderRadius: 4,
  },
  reasonLabel: {
    fontSize: 8,
    color: "#8B7F73",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1F1A17",
    marginTop: 12,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  table: { borderWidth: 1, borderColor: "#1F1A17" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F3ECDD",
    borderBottomWidth: 1,
    borderColor: "#1F1A17",
    paddingVertical: 5,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderColor: "#C9BFB3",
    paddingVertical: 5,
  },
  totalRow: { backgroundColor: "#FFEACC" },
  cell: { paddingHorizontal: 6, fontSize: 9 },
  colSku: { width: "14%" },
  colName: { width: "46%" },
  colNum: { width: "13%", textAlign: "right" },
  empty: { fontSize: 10, color: "#8B7F73", fontStyle: "italic" },
  movements: { marginTop: 4 },
  movementRow: {
    flexDirection: "row",
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderColor: "#F3ECDD",
  },
  mvWhen: { fontSize: 9, color: "#8B7F73", width: "25%", fontFamily: "Courier" },
  mvReason: { fontSize: 9, color: "#1F1A17", width: "15%", fontWeight: "bold" },
  mvBody: { fontSize: 9, color: "#2E2824", flex: 1, fontFamily: "Courier" },
  pageNumber: {
    position: "absolute",
    bottom: 18,
    right: 32,
    fontSize: 9,
    color: "#8B7F73",
    fontFamily: "Courier",
  },
});
