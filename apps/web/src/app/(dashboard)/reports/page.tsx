"use client";

import { trpc } from "~/lib/trpc";
import { Card, PageHeader, Table, Td, Th } from "~/components/ui";

function fmtSeconds(s: number): string {
  if (!s || !Number.isFinite(s)) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function ReportsPage() {
  const summary = trpc.report.summary.useQuery();
  const soh = trpc.report.stockOnHand.useQuery({ limit: 20 });
  const dts = trpc.report.dockToStock.useQuery({ days: 30 });
  const movements = trpc.movement.recent.useQuery({ limit: 50 });

  return (
    <div>
      <PageHeader title="Reports" />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Stored pallets" value={summary.data?.storedPallets} />
        <Stat label="Open inbound" value={summary.data?.openInbound} />
        <Stat label="Picking" value={summary.data?.outboundPicking} />
        <Stat label="Moves (24h)" value={summary.data?.movements24h} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <h3 className="mb-3 font-medium">Dock-to-stock time (last 30 days)</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-slate-500">Avg</div>
              <div className="text-xl font-semibold">{fmtSeconds(dts.data?.avg_seconds ?? 0)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">p50</div>
              <div className="text-xl font-semibold">{fmtSeconds(dts.data?.p50_seconds ?? 0)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">p95</div>
              <div className="text-xl font-semibold">{fmtSeconds(dts.data?.p95_seconds ?? 0)}</div>
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-500">Based on {dts.data?.n ?? 0} pallets</div>
        </Card>

        <Card>
          <h3 className="mb-3 font-medium">Top SKUs on hand</h3>
          <Table>
            <thead>
              <tr>
                <Th>SKU</Th>
                <Th>Qty</Th>
                <Th>Pallets</Th>
              </tr>
            </thead>
            <tbody>
              {soh.data?.slice(0, 8).map((r) => (
                <tr key={r.productId}>
                  <Td>
                    <span className="font-medium">{r.sku}</span>{" "}
                    <span className="text-slate-400">{r.name}</span>
                  </Td>
                  <Td>{r.qty}</Td>
                  <Td>{r.palletCount}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>

      <Card>
        <h3 className="mb-3 font-medium">Recent movements</h3>
        <Table>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Pallet</Th>
              <Th>From</Th>
              <Th>To</Th>
              <Th>Reason</Th>
            </tr>
          </thead>
          <tbody>
            {movements.data?.map((m) => (
              <tr key={m.id}>
                <Td>{m.createdAt.toLocaleString()}</Td>
                <Td>{m.palletId.slice(0, 8)}</Td>
                <Td>{m.fromLocationId?.slice(0, 8) ?? ""}</Td>
                <Td>{m.toLocationId?.slice(0, 8) ?? ""}</Td>
                <Td>{m.reason}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-3xl font-semibold">{value ?? "—"}</div>
    </div>
  );
}
