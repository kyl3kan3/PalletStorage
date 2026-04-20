import { describe, expect, it } from "vitest";
import {
  assertInboundTransition,
  assertOutboundTransition,
} from "./router/_stateMachine";

describe("state machine", () => {
  it("allows valid inbound transitions", () => {
    expect(() => assertInboundTransition("open", "receiving")).not.toThrow();
    expect(() => assertInboundTransition("receiving", "closed")).not.toThrow();
    expect(() => assertInboundTransition("open", "cancelled")).not.toThrow();
  });

  it("rejects invalid inbound transitions", () => {
    expect(() => assertInboundTransition("closed", "open")).toThrow(/cannot move/);
    expect(() => assertInboundTransition("cancelled", "receiving")).toThrow(/cannot move/);
    expect(() => assertInboundTransition("draft", "closed")).toThrow(/cannot move/);
  });

  it("allows valid outbound transitions", () => {
    expect(() => assertOutboundTransition("open", "picking")).not.toThrow();
    expect(() => assertOutboundTransition("picking", "packed")).not.toThrow();
    expect(() => assertOutboundTransition("packed", "shipped")).not.toThrow();
    expect(() => assertOutboundTransition("open", "cancelled")).not.toThrow();
  });

  it("rejects invalid outbound transitions", () => {
    // Packed orders can't be cancelled — stock is already committed.
    expect(() => assertOutboundTransition("packed", "cancelled")).toThrow(/cannot move/);
    expect(() => assertOutboundTransition("shipped", "packed")).toThrow(/cannot move/);
    expect(() => assertOutboundTransition("cancelled", "open")).toThrow(/cannot move/);
  });
});
