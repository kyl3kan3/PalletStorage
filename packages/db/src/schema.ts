import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  integer,
  numeric,
  boolean,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ──────────────────────────────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────────────────────────────
export const memberRole = pgEnum("member_role", ["admin", "manager", "operator"]);
export const locationType = pgEnum("location_type", ["floor", "rack", "staging", "dock"]);
export const palletStatus = pgEnum("pallet_status", [
  "in_transit",
  "received",
  "stored",
  "picked",
  "shipped",
  "damaged",
]);
export const inboundStatus = pgEnum("inbound_status", ["draft", "open", "receiving", "closed", "cancelled"]);
export const outboundStatus = pgEnum("outbound_status", [
  "draft",
  "open",
  "picking",
  "packed",
  "shipped",
  "cancelled",
]);
export const movementReason = pgEnum("movement_reason", [
  "receive",
  "putaway",
  "move",
  "pick",
  "ship",
  "adjust",
  "cycle_count",
]);
export const labelKind = pgEnum("label_kind", ["pallet", "location"]);

// ──────────────────────────────────────────────────────────────────────
// Tenancy
// ──────────────────────────────────────────────────────────────────────
export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkOrgId: text("clerk_org_id").unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkUserId: text("clerk_user_id").unique().notNull(),
  email: text("email").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const memberships = pgTable(
  "memberships",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull().default("operator"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.organizationId, t.userId] }),
  }),
);

// ──────────────────────────────────────────────────────────────────────
// Warehouses & Locations
// ──────────────────────────────────────────────────────────────────────
export const warehouses = pgTable(
  "warehouses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    timezone: text("timezone").notNull().default("UTC"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgCodeUq: uniqueIndex("warehouses_org_code_uq").on(t.organizationId, t.code),
    orgIdx: index("warehouses_org_idx").on(t.organizationId),
  }),
);

/**
 * Locations form a tree (warehouse → zone → aisle → rack → bay → level).
 * `path` is a materialized path like "A.01.03.02.1" for fast prefix queries.
 */
export const locations = pgTable(
  "locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    code: text("code").notNull(),
    path: text("path").notNull(),
    type: locationType("type").notNull().default("rack"),
    // physical limits
    lengthMm: integer("length_mm"),
    widthMm: integer("width_mm"),
    heightMm: integer("height_mm"),
    maxWeightKg: numeric("max_weight_kg", { precision: 10, scale: 2 }),
    // velocity class for ABC putaway (A = fast)
    velocityClass: text("velocity_class"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    whPathUq: uniqueIndex("locations_wh_path_uq").on(t.warehouseId, t.path),
    orgIdx: index("locations_org_idx").on(t.organizationId),
    parentIdx: index("locations_parent_idx").on(t.parentId),
  }),
);

// ──────────────────────────────────────────────────────────────────────
// Products & Pallets
// ──────────────────────────────────────────────────────────────────────
export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    barcode: text("barcode"),
    lengthMm: integer("length_mm"),
    widthMm: integer("width_mm"),
    heightMm: integer("height_mm"),
    weightKg: numeric("weight_kg", { precision: 10, scale: 3 }),
    velocityClass: text("velocity_class"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgSkuUq: uniqueIndex("products_org_sku_uq").on(t.organizationId, t.sku),
    barcodeIdx: index("products_barcode_idx").on(t.barcode),
  }),
);

export const pallets = pgTable(
  "pallets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "cascade" }),
    lpn: text("lpn").notNull(), // license plate number
    status: palletStatus("status").notNull().default("in_transit"),
    currentLocationId: uuid("current_location_id").references(() => locations.id, { onDelete: "set null" }),
    weightKg: numeric("weight_kg", { precision: 10, scale: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgLpnUq: uniqueIndex("pallets_org_lpn_uq").on(t.organizationId, t.lpn),
    orgIdx: index("pallets_org_idx").on(t.organizationId),
    locationIdx: index("pallets_location_idx").on(t.currentLocationId),
  }),
);

export const palletItems = pgTable(
  "pallet_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    palletId: uuid("pallet_id")
      .notNull()
      .references(() => pallets.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    qty: integer("qty").notNull(),
    lot: text("lot"),
    expiry: timestamp("expiry", { withTimezone: true }),
  },
  (t) => ({
    palletIdx: index("pallet_items_pallet_idx").on(t.palletId),
    productIdx: index("pallet_items_product_idx").on(t.productId),
  }),
);

// ──────────────────────────────────────────────────────────────────────
// Inbound (ASN / receiving)
// ──────────────────────────────────────────────────────────────────────
export const inboundOrders = pgTable(
  "inbound_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    reference: text("reference").notNull(), // PO/ASN number
    supplier: text("supplier"),
    status: inboundStatus("status").notNull().default("draft"),
    expectedAt: timestamp("expected_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgRefUq: uniqueIndex("inbound_org_ref_uq").on(t.organizationId, t.reference),
  }),
);

export const inboundLines = pgTable("inbound_lines", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  inboundOrderId: uuid("inbound_order_id")
    .notNull()
    .references(() => inboundOrders.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  qtyExpected: integer("qty_expected").notNull(),
  qtyReceived: integer("qty_received").notNull().default(0),
});

// ──────────────────────────────────────────────────────────────────────
// Outbound (orders / picks)
// ──────────────────────────────────────────────────────────────────────
export const outboundOrders = pgTable(
  "outbound_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    reference: text("reference").notNull(),
    customer: text("customer"),
    status: outboundStatus("status").notNull().default("draft"),
    shipBy: timestamp("ship_by", { withTimezone: true }),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgRefUq: uniqueIndex("outbound_org_ref_uq").on(t.organizationId, t.reference),
  }),
);

export const outboundLines = pgTable("outbound_lines", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  outboundOrderId: uuid("outbound_order_id")
    .notNull()
    .references(() => outboundOrders.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  qtyOrdered: integer("qty_ordered").notNull(),
  qtyPicked: integer("qty_picked").notNull().default(0),
});

export const picks = pgTable(
  "picks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    outboundLineId: uuid("outbound_line_id")
      .notNull()
      .references(() => outboundLines.id, { onDelete: "cascade" }),
    palletId: uuid("pallet_id").references(() => pallets.id, { onDelete: "set null" }),
    fromLocationId: uuid("from_location_id").references(() => locations.id),
    qty: integer("qty").notNull(),
    assignedUserId: uuid("assigned_user_id").references(() => users.id),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    sequence: integer("sequence").notNull().default(0),
  },
  (t) => ({
    outboundIdx: index("picks_outbound_idx").on(t.outboundLineId),
    assignedIdx: index("picks_assigned_idx").on(t.assignedUserId),
  }),
);

// ──────────────────────────────────────────────────────────────────────
// Movements (audit ledger — source of truth)
// ──────────────────────────────────────────────────────────────────────
export const movements = pgTable(
  "movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    palletId: uuid("pallet_id")
      .notNull()
      .references(() => pallets.id, { onDelete: "cascade" }),
    fromLocationId: uuid("from_location_id").references(() => locations.id),
    toLocationId: uuid("to_location_id").references(() => locations.id),
    reason: movementReason("reason").notNull(),
    userId: uuid("user_id").references(() => users.id),
    refType: text("ref_type"), // e.g. "inbound_order", "outbound_order"
    refId: uuid("ref_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    palletIdx: index("movements_pallet_idx").on(t.palletId),
    orgCreatedIdx: index("movements_org_created_idx").on(t.organizationId, t.createdAt),
  }),
);

// ──────────────────────────────────────────────────────────────────────
// Label codes — short scannable codes resolving to pallet or location
// ──────────────────────────────────────────────────────────────────────
export const labelCodes = pgTable(
  "label_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    kind: labelKind("kind").notNull(),
    palletId: uuid("pallet_id").references(() => pallets.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").references(() => locations.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    codeUq: uniqueIndex("label_codes_code_uq").on(t.code),
    orgIdx: index("label_codes_org_idx").on(t.organizationId),
  }),
);

// ──────────────────────────────────────────────────────────────────────
// QuickBooks integration
// ──────────────────────────────────────────────────────────────────────
export const quickbooksConnections = pgTable("quickbooks_connections", {
  organizationId: uuid("organization_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  realmId: text("realm_id").notNull(), // QBO company id
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }).notNull(),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }).notNull(),
  // Map WMS product.id → QuickBooks Item.Id (so we don't re-create items on every export)
  productItemMap: jsonb("product_item_map").$type<Record<string, string>>().notNull().default({}),
  connectedAt: timestamp("connected_at", { withTimezone: true }).defaultNow().notNull(),
});

export const quickbooksExports = pgTable(
  "quickbooks_exports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // Which WMS entity was exported
    sourceType: text("source_type").notNull(), // "inbound_order" | "outbound_order" | "adjustment"
    sourceId: uuid("source_id").notNull(),
    // What it became in QuickBooks
    qboEntityType: text("qbo_entity_type").notNull(), // "Bill" | "Invoice" | "InventoryAdjustment"
    qboEntityId: text("qbo_entity_id").notNull(),
    status: text("status").notNull().default("success"), // "success" | "failed"
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgSourceIdx: index("qb_exports_org_source_idx").on(t.organizationId, t.sourceType, t.sourceId),
  }),
);

// ──────────────────────────────────────────────────────────────────────
// Relations
// ──────────────────────────────────────────────────────────────────────
export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(memberships),
  warehouses: many(warehouses),
}));

export const warehousesRelations = relations(warehouses, ({ one, many }) => ({
  organization: one(organizations, { fields: [warehouses.organizationId], references: [organizations.id] }),
  locations: many(locations),
  pallets: many(pallets),
}));

export const locationsRelations = relations(locations, ({ one, many }) => ({
  warehouse: one(warehouses, { fields: [locations.warehouseId], references: [warehouses.id] }),
  parent: one(locations, { fields: [locations.parentId], references: [locations.id], relationName: "parent" }),
  children: many(locations, { relationName: "parent" }),
  pallets: many(pallets),
}));

export const palletsRelations = relations(pallets, ({ one, many }) => ({
  warehouse: one(warehouses, { fields: [pallets.warehouseId], references: [warehouses.id] }),
  location: one(locations, { fields: [pallets.currentLocationId], references: [locations.id] }),
  items: many(palletItems),
  movements: many(movements),
}));

export const palletItemsRelations = relations(palletItems, ({ one }) => ({
  pallet: one(pallets, { fields: [palletItems.palletId], references: [pallets.id] }),
  product: one(products, { fields: [palletItems.productId], references: [products.id] }),
}));

// Helper for tenant-scoped queries
export const orgFilter = (col: { name: string }, orgId: string) =>
  sql`${sql.identifier(col.name)} = ${orgId}`;
