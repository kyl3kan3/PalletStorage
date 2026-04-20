"use client";

import { use, useState } from "react";
import { trpc } from "~/lib/trpc";
import { Button, Card, Input, PageHeader, Table, Td, Th } from "~/components/ui";

export default function OutboundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const utils = trpc.useUtils();
  const detail = trpc.outbound.byId.useQuery({ id });
  const genPicks = trpc.outbound.generatePicks.useMutation({
    onSuccess: () => utils.outbound.byId.invalidate({ id }),
  });
  const cancelOrder = trpc.outbound.cancel.useMutation({
    onSuccess: () => utils.outbound.byId.invalidate({ id }),
  });
  const pack = trpc.outbound.pack.useMutation({
    onSuccess: () => utils.outbound.byId.invalidate({ id }),
  });
  const ship = trpc.outbound.ship.useMutation({
    onSuccess: () => {
      utils.outbound.byId.invalidate({ id });
      utils.outbound.shipments.invalidate({ outboundOrderId: id });
    },
  });
  const shipmentsQ = trpc.outbound.shipments.useQuery({ outboundOrderId: id });
  const exportOutbound = trpc.quickbooks.exportOutbound.useMutation();
  const qbStatus = trpc.quickbooks.status.useQuery();

  const [cancelReason, setCancelReason] = useState("");
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");

  const order = detail.data?.order;
  const lines = detail.data?.lines ?? [];
  const status = order?.status ?? "…";
  const isTerminal = status === "shipped" || status === "cancelled";
  const canCancel = status === "draft" || status === "open" || status === "picking";

  return (
    <div>
      <PageHeader title={`Outbound ${id.slice(0, 8)}`}>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs uppercase tracking-wide text-slate-600">
          {status}
        </span>
      </PageHeader>

      <Card>
        <div className="mb-4">
          <div className="text-sm text-slate-500">Reference</div>
          <div className="font-medium">{order?.reference ?? "…"}</div>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>Line</Th>
              <Th>Ordered</Th>
              <Th>Picked</Th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.id}>
                <Td>{i + 1}</Td>
                <Td>{l.qtyOrdered}</Td>
                <Td>{l.qtyPicked}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {!isTerminal && (
        <div className="mt-4">
          <Card>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => genPicks.mutate({ outboundOrderId: id })}
                disabled={genPicks.isPending || (status !== "open" && status !== "draft")}
              >
                {genPicks.isPending ? "Generating..." : "Generate picks"}
              </Button>
              {genPicks.data && (
                <span className="text-sm text-green-700">Created {genPicks.data.created} pick(s)</span>
              )}

              <Button
                onClick={() => pack.mutate({ id })}
                disabled={pack.isPending || status !== "picking"}
              >
                {pack.isPending ? "Packing..." : "Mark packed"}
              </Button>
              {pack.error && <span className="text-sm text-red-700">{pack.error.message}</span>}
            </div>
          </Card>
        </div>
      )}

      {status === "packed" && (
        <div className="mt-4">
          <Card>
            <div className="mb-2 font-medium">Ship</div>
            <div className="flex flex-wrap gap-2">
              <Input placeholder="Carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} />
              <Input
                placeholder="Tracking number"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
              />
              <Button
                disabled={ship.isPending}
                onClick={() =>
                  ship.mutate({
                    id,
                    carrier: carrier.trim() || undefined,
                    trackingNumber: tracking.trim() || undefined,
                  })
                }
              >
                {ship.isPending ? "Shipping..." : "Confirm ship"}
              </Button>
            </div>
            {ship.error && <p className="mt-2 text-sm text-red-700">{ship.error.message}</p>}
          </Card>
        </div>
      )}

      {shipmentsQ.data && shipmentsQ.data.length > 0 && (
        <div className="mt-4">
          <Card>
            <div className="mb-2 font-medium">Shipments</div>
            <Table>
              <thead>
                <tr>
                  <Th>BOL</Th>
                  <Th>Carrier</Th>
                  <Th>Tracking</Th>
                  <Th>Shipped</Th>
                  <Th>BOL PDF</Th>
                </tr>
              </thead>
              <tbody>
                {shipmentsQ.data.map((s) => (
                  <tr key={s.id}>
                    <Td>{s.bolNumber}</Td>
                    <Td>{s.carrier ?? ""}</Td>
                    <Td>{s.trackingNumber ?? ""}</Td>
                    <Td>{s.shippedAt.toLocaleDateString()}</Td>
                    <Td>
                      <a
                        href={`/api/shipments/${s.id}/bol.pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        Download
                      </a>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>
      )}

      {canCancel && (
        <div className="mt-4">
          <Card>
            <div className="mb-2 font-medium">Cancel order</div>
            <div className="flex gap-2">
              <Input
                placeholder="Cancel reason (required)"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
              <Button
                disabled={cancelOrder.isPending || !cancelReason.trim()}
                onClick={() => cancelOrder.mutate({ id, reason: cancelReason.trim() })}
              >
                {cancelOrder.isPending ? "Cancelling..." : "Cancel"}
              </Button>
            </div>
            {cancelOrder.error && (
              <p className="mt-2 text-sm text-red-700">{cancelOrder.error.message}</p>
            )}
          </Card>
        </div>
      )}

      {status === "cancelled" && order?.cancelReason && (
        <div className="mt-4">
          <Card>
            <div className="text-sm text-slate-500">Cancel reason</div>
            <div>{order.cancelReason}</div>
          </Card>
        </div>
      )}

      <div className="mt-4">
        <Card>
          <div className="flex gap-2">
            <Button
              disabled={!qbStatus.data?.connected || exportOutbound.isPending || status !== "shipped"}
              onClick={() => exportOutbound.mutate({ outboundOrderId: id })}
            >
              {exportOutbound.isPending ? "Exporting..." : "Export to QuickBooks"}
            </Button>
            {exportOutbound.data && (
              <span className="text-sm text-green-700">Exported as Invoice {exportOutbound.data.qboId}</span>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
