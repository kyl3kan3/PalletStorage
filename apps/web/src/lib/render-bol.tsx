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
 * Render a Bill Of Lading PDF for a shipment, scoped to the org. Used
 * by both the GET route at /api/shipments/[id]/bol and the email-BOL
 * server route. Returns the rendered buffer + the BOL number for use
 * as filename / subject.
 */
export async function renderBolPdf(
  shipmentId: string,
  orgId: string,
): Promise<
  | {
      ok: true;
      pdf: Buffer;
      bolNumber: string;
      consigneeEmail: string | null;
      consigneeName: string;
      orgName: string;
    }
  | { ok: false; status: number; error: string }
> {
  const [org] = await db
    .select({ id: schema.organizations.id, name: schema.organizations.name })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, orgId))
    .limit(1);
  if (!org) return { ok: false, status: 400, error: "org not provisioned" };

  const [shipment] = await db
    .select()
    .from(schema.shipments)
    .where(
      and(
        eq(schema.shipments.id, shipmentId),
        eq(schema.shipments.organizationId, org.id),
      ),
    )
    .limit(1);
  if (!shipment) return { ok: false, status: 404, error: "shipment not found" };

  const [order] = await db
    .select()
    .from(schema.outboundOrders)
    .where(eq(schema.outboundOrders.id, shipment.outboundOrderId))
    .limit(1);
  if (!order) return { ok: false, status: 404, error: "order not found" };

  let consigneeName = order.customer ?? "—";
  let consigneeAddress: string[] = [];
  let consigneeEmail: string | null = null;
  if (order.customerId) {
    const [c] = await db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.id, order.customerId))
      .limit(1);
    if (c) {
      consigneeName = c.name;
      consigneeEmail = c.email;
      consigneeAddress = [
        c.shippingLine1,
        c.shippingLine2,
        [c.shippingCity, c.shippingRegion].filter(Boolean).join(", "),
        [c.shippingPostalCode, c.shippingCountry].filter(Boolean).join(" "),
      ].filter(Boolean) as string[];
    }
  }

  const lines = await db
    .select({
      sku: schema.products.sku,
      name: schema.products.name,
      qty: schema.outboundLines.qtyPicked,
    })
    .from(schema.outboundLines)
    .innerJoin(
      schema.products,
      eq(schema.products.id, schema.outboundLines.productId),
    )
    .where(eq(schema.outboundLines.outboundOrderId, order.id));

  const barcodePng = await bwipjs.toBuffer({
    bcid: "code128",
    text: toCode128(shipment.bolNumber),
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
          <Text style={styles.orgName}>{org.name}</Text>
          <Text style={styles.title}>BILL OF LADING</Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>BOL Number</Text>
            <Text style={styles.metaValue}>{shipment.bolNumber}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Order Reference</Text>
            <Text style={styles.metaValue}>{order.reference}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Ship Date</Text>
            <Text style={styles.metaValue}>
              {shipment.shippedAt.toLocaleDateString()}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Consignee</Text>
            <Text style={styles.metaValue}>{consigneeName}</Text>
            {consigneeAddress.map((l, i) => (
              <Text key={i} style={styles.addressLine}>
                {l}
              </Text>
            ))}
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Carrier</Text>
            <Text style={styles.metaValue}>{shipment.carrier ?? "—"}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Tracking</Text>
            <Text style={styles.metaValue}>
              {shipment.trackingNumber ?? "—"}
            </Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.cell, styles.colSku]}>SKU</Text>
            <Text style={[styles.cell, styles.colName]}>Description</Text>
            <Text style={[styles.cell, styles.colQty]}>Qty</Text>
          </View>
          {lines.map((l, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.cell, styles.colSku]}>{l.sku}</Text>
              <Text style={[styles.cell, styles.colName]}>{l.name}</Text>
              <Text style={[styles.cell, styles.colQty]}>{l.qty}</Text>
            </View>
          ))}
        </View>

        <View style={styles.signRow}>
          <View style={styles.signBox}>
            <Text style={styles.signLabel}>Shipper signature</Text>
          </View>
          <View style={styles.signBox}>
            <Text style={styles.signLabel}>Carrier signature</Text>
          </View>
          <View style={styles.signBox}>
            <Text style={styles.signLabel}>Consignee signature</Text>
          </View>
        </View>

        <View style={styles.barcodeRow}>
          <Image src={barcodeDataUrl} style={styles.barcode} />
          <Text style={styles.bolCode}>{shipment.bolNumber}</Text>
        </View>
      </Page>
    </Document>,
  );

  return {
    ok: true,
    pdf,
    bolNumber: shipment.bolNumber,
    consigneeEmail,
    consigneeName,
    orgName: org.name,
  };
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10 },
  header: {
    marginBottom: 16,
    borderBottomWidth: 1,
    borderColor: "#000",
    paddingBottom: 8,
  },
  orgName: { fontSize: 14, fontWeight: "bold" },
  title: { fontSize: 20, fontWeight: "bold", marginTop: 4 },
  metaRow: { flexDirection: "row", marginBottom: 12 },
  metaCol: { flex: 1, paddingRight: 8 },
  metaLabel: { fontSize: 8, color: "#555", textTransform: "uppercase" },
  metaValue: { fontSize: 11, marginTop: 2 },
  addressLine: { fontSize: 9, color: "#555", marginTop: 1 },
  table: { marginTop: 12, borderWidth: 1, borderColor: "#000" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#eee",
    borderBottomWidth: 1,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderColor: "#aaa",
  },
  cell: { padding: 6 },
  colSku: { width: "25%" },
  colName: { width: "55%" },
  colQty: { width: "20%", textAlign: "right" },
  signRow: { flexDirection: "row", marginTop: 40 },
  signBox: {
    flex: 1,
    borderTopWidth: 1,
    borderColor: "#000",
    marginHorizontal: 6,
    paddingTop: 4,
  },
  signLabel: { fontSize: 8, color: "#555" },
  barcodeRow: { marginTop: 32, alignItems: "center" },
  barcode: { width: 260, height: 60, objectFit: "contain" },
  bolCode: { fontFamily: "Courier", fontSize: 12, marginTop: 4 },
});
