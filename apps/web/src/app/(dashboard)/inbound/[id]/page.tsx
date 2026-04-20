"use client";

import { use } from "react";
import { trpc } from "~/lib/trpc";
import { Button, Card, PageHeader } from "~/components/ui";

export default function InboundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const exportInbound = trpc.quickbooks.exportInbound.useMutation();
  const qbStatus = trpc.quickbooks.status.useQuery();

  return (
    <div>
      <PageHeader title={`Inbound ${id.slice(0, 8)}`} />
      <Card>
        <p className="mb-4 text-sm text-slate-500">
          Receiving happens on the mobile app. Use the Expo app to scan pallets, assign them to this
          order, and putaway.
        </p>
        <div className="flex gap-2">
          <Button
            disabled={!qbStatus.data?.connected || exportInbound.isPending}
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
  );
}
