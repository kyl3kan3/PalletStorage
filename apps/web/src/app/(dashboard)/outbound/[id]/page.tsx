"use client";

import { use } from "react";
import { trpc } from "~/lib/trpc";
import { Button, Card, PageHeader } from "~/components/ui";

export default function OutboundDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const utils = trpc.useUtils();
  const genPicks = trpc.outbound.generatePicks.useMutation({
    onSuccess: () => utils.outbound.list.invalidate(),
  });
  const exportOutbound = trpc.quickbooks.exportOutbound.useMutation();
  const qbStatus = trpc.quickbooks.status.useQuery();

  return (
    <div>
      <PageHeader title={`Outbound ${id.slice(0, 8)}`} />

      <Card>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => genPicks.mutate({ outboundOrderId: id })} disabled={genPicks.isPending}>
            {genPicks.isPending ? "Generating..." : "Generate picks"}
          </Button>
          {genPicks.data && (
            <span className="text-sm text-green-700">Created {genPicks.data.created} pick(s)</span>
          )}

          <Button
            disabled={!qbStatus.data?.connected || exportOutbound.isPending}
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
  );
}
