import { describe, expect, it } from "vitest";
import { buildAuditRow } from "./audit";

const ORG = "00000000-0000-0000-0000-0000000000aa";
const USR = "00000000-0000-0000-0000-0000000000bb";
const ENT = "00000000-0000-0000-0000-0000000000cc";

describe("buildAuditRow", () => {
  it("forwards organizationId, action, entityType, entityId, metadata", () => {
    const row = buildAuditRow(
      {
        organizationId: ORG,
        action: "inbound.close",
        entityType: "inbound_order",
        entityId: ENT,
        metadata: { shortClosed: true, lines: 3 },
      },
      USR,
    );
    expect(row).toEqual({
      organizationId: ORG,
      userId: USR,
      action: "inbound.close",
      entityType: "inbound_order",
      entityId: ENT,
      metadata: { shortClosed: true, lines: 3 },
    });
  });

  it("nulls out userId, entityId, metadata when absent", () => {
    const row = buildAuditRow(
      {
        organizationId: ORG,
        action: "customer.delete",
        entityType: "customer",
      },
      null,
    );
    expect(row).toEqual({
      organizationId: ORG,
      userId: null,
      action: "customer.delete",
      entityType: "customer",
      entityId: null,
      metadata: null,
    });
  });
});
