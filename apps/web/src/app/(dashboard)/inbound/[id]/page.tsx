"use client";

import { use, useState } from "react";
import { trpc } from "~/lib/trpc";
import { Button, Card, Input, PageHeader, Table, Td, Th } from "~/components/ui";

export default function InboundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const utils = trpc.useUtils();
  const detail = trpc.inbound.byId.useQuery({ id });
  const closeOrder = trpc.inbound.close.useMutation({
    onSuccess: () => utils.inbound.byId.invalidate({ id }),
  });
  const cancelOrder = trpc.inbound.cancel.useMutation({
    onSuccess: () => utils.inbound.byId.invalidate({ id }),
  });
  const exportInbound = trpc.quickbooks.exportInbound.useMutation();
  const qbStatus = trpc.quickbooks.status.useQuery();

  const [closeReason, setCloseReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  const order = detail.data?.order;
  const lines = detail.data?.lines ?? [];
  const hasShort = lines.some((l) => l.qtyReceived < l.qtyExpected);
  const status = order?.status ?? "…";
  const isTerminal = status === "closed" || status === "cancelled";

  return (
    <div>
      <PageHeader title={`Inbound ${id.slice(0, 8)}`}>
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
              <Th>Expected</Th>
              <Th>Received</Th>
              <Th>Variance</Th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const v = l.qtyReceived - l.qtyExpected;
              return (
                <tr key={l.id}>
                  <Td>{i + 1}</Td>
                  <Td>{l.qtyExpected}</Td>
                  <Td>{l.qtyReceived}</Td>
                  <Td>
                    <span className={v < 0 ? "text-amber-700" : ""}>{v}</span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      {!isTerminal && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Card>
            <div className="mb-2 font-medium">Close order</div>
            {hasShort && (
              <p className="mb-2 text-sm text-amber-700">
                Some lines are under-received — a reason is required to short-close.
              </p>
            )}
            <div className="flex gap-2">
              <Input
                placeholder={hasShort ? "Short-close reason (required)" : "Reason (optional)"}
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
              />
              <Button
                disabled={closeOrder.isPending || (hasShort && !closeReason.trim())}
                onClick={() =>
                  closeOrder.mutate({
                    id,
                    closeReason: closeReason.trim() || undefined,
                  })
                }
              >
                {closeOrder.isPending ? "Closing..." : "Close"}
              </Button>
            </div>
            {closeOrder.error && (
              <p className="mt-2 text-sm text-red-700">{closeOrder.error.message}</p>
            )}
          </Card>

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

      {isTerminal && order?.closeReason && (
        <Card>
          <div className="text-sm text-slate-500">Reason</div>
          <div>{order.closeReason}</div>
        </Card>
      )}

      <div className="mt-4">
        <Card>
          <div className="flex gap-2">
            <Button
              disabled={!qbStatus.data?.connected || exportInbound.isPending || status !== "closed"}
              onClick={() => exportInbound.mutate({ inboundOrderId: id })}
            >
              {exportInbound.isPending ? "Exporting..." : "Export to QuickBooks"}
            </Button>
            {exportInbound.data && (
              <span className="text-sm text-green-700">Exported as Bill {exportInbound.data.qboId}</span>
            )}
            {exportInbound.error && (
              <span className="text-sm text-red-700">{exportInbound.error.message}</span>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
