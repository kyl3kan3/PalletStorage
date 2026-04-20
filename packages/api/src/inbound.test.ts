import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./testing/harness";

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  await h?.stop();
});

describe("inbound → putaway → outbound flow", () => {
  it("round-trips a pallet through the ledger", async () => {
    const api = await h.caller();

    const wh = await api.warehouse.create({ code: "WH1", name: "Main DC", timezone: "UTC" });
    expect(wh!.code).toBe("WH1");

    // Two rack locations — use the path format parseAisleBay() understands.
    const locA = await api.location.create({
      warehouseId: wh!.id,
      code: "A-01-01",
      path: `${wh!.code}.A.01.01.1`,
      type: "rack",
      maxWeightKg: 1000,
    });
    const staging = await api.location.create({
      warehouseId: wh!.id,
      code: "STAGE-OUT",
      path: `${wh!.code}.OUT.01.01.1`,
      type: "staging",
    });

    const product = await api.product.create({ sku: "WIDGET-1", name: "Widget" });

    // Inbound order with one line for 10 widgets
    const inbound = await api.inbound.create({
      warehouseId: wh!.id,
      reference: "PO-1",
      lines: [{ productId: product!.id, qtyExpected: 10 }],
    });
    expect(inbound!.status).toBe("open");

    const pallet = await api.pallet.create({ warehouseId: wh!.id });

    // Receive 10 onto the pallet via the first inbound line
    const lines = await h.db.query.inboundLines.findMany();
    await api.inbound.receiveLine({
      inboundLineId: lines[0]!.id,
      palletId: pallet!.id,
      qty: 10,
    });

    // Putaway to rack location
    await api.pallet.move({
      palletId: pallet!.id,
      toLocationId: locA!.id,
      reason: "putaway",
    });

    // Outbound for 4 widgets → generate picks → should produce 1 pick row
    const ob = await api.outbound.create({
      warehouseId: wh!.id,
      reference: "SO-1",
      lines: [{ productId: product!.id, qtyOrdered: 4 }],
    });
    const picksResult = await api.outbound.generatePicks({ outboundOrderId: ob!.id });
    expect(picksResult.created).toBe(1);

    // Complete the pick to staging
    const openPicks = await api.outbound.myPicks();
    expect(openPicks).toHaveLength(1);
    await api.outbound.completePick({
      pickId: openPicks[0]!.pick.id,
      stagingLocationId: staging!.id,
    });

    // Ledger should contain receive, putaway, pick — in that order
    const history = await api.movement.recent({ palletId: pallet!.id, limit: 50 });
    const reasons = history.map((m) => m.reason).reverse(); // recent() is DESC
    expect(reasons).toEqual(["receive", "putaway", "pick"]);

    // Pallet is now at staging and marked picked
    const after = await api.pallet.byLpn({ lpn: pallet!.lpn });
    expect(after!.pallet.currentLocationId).toBe(staging!.id);
    expect(after!.pallet.status).toBe("picked");
  });

  it("enforces tenant isolation — org B can't see org A's data", async () => {
    const aApi = await h.caller("org_A", "user_A");
    await aApi.warehouse.create({ code: "WH-A", name: "A", timezone: "UTC" });

    const bApi = await h.caller("org_B", "user_B");
    const bList = await bApi.warehouse.list();
    expect(bList.some((w) => w.code === "WH-A")).toBe(false);
  });
});
