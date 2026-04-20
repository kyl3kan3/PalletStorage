"use client";

import { trpc } from "~/lib/trpc";
import { Button, Card, PageHeader, Table, Td, Th } from "~/components/ui";

export default function IntegrationsPage() {
  const status = trpc.quickbooks.status.useQuery();
  const authorize = trpc.quickbooks.authorizeUrl.useQuery(undefined, { enabled: false });
  const disconnect = trpc.quickbooks.disconnect.useMutation({
    onSuccess: () => status.refetch(),
  });
  const history = trpc.quickbooks.history.useQuery({ limit: 50 });

  async function connect() {
    const res = await authorize.refetch();
    if (res.data?.url) window.location.href = res.data.url;
  }

  return (
    <div>
      <PageHeader title="Integrations" />

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-medium">QuickBooks Online</h3>
            <p className="text-sm text-slate-500">
              {status.data?.connected
                ? `Connected — realm ${status.data.realmId}`
                : "Not connected"}
            </p>
          </div>
          {status.data?.connected ? (
            <Button onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
              Disconnect
            </Button>
          ) : (
            <Button onClick={connect}>Connect</Button>
          )}
        </div>
      </Card>

      <div className="mt-6">
        <h3 className="mb-2 font-medium">Export history</h3>
        <Table>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Source</Th>
              <Th>QBO Entity</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {history.data?.map((h) => (
              <tr key={h.id}>
                <Td>{h.createdAt.toLocaleString()}</Td>
                <Td>
                  {h.sourceType} {h.sourceId.slice(0, 8)}
                </Td>
                <Td>
                  {h.qboEntityType} {h.qboEntityId}
                </Td>
                <Td>{h.status}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
