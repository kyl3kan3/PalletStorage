"use client";

import { use, useState } from "react";
import { trpc } from "~/lib/trpc";
import { Button, Card, Input, PageHeader, Table, Td, Th } from "~/components/ui";

/**
 * Variance review page. Shows every line in the count with its expected
 * qty from the snapshot and a writable counted-qty input. Submitting
 * flips status → reviewing; approving (manager only) writes the
 * variance movements and adjusts palletItem.qty.
 */
export default function CycleCountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const utils = trpc.useUtils();
  const detail = trpc.cycleCount.byId.useQuery({ id });
  const submit = trpc.cycleCount.submitCount.useMutation({
    onSuccess: () => utils.cycleCount.byId.invalidate({ id }),
  });
  const approve = trpc.cycleCount.approve.useMutation({
    onSuccess: () => {
      utils.cycleCount.byId.invalidate({ id });
      utils.cycleCount.listOpen.invalidate();
    },
  });

  // Local counted-qty state keyed by palletItemId, flushed on submit.
  const [counted, setCounted] = useState<Record<string, string>>({});

  const cc = detail.data?.count;
  const lines = detail.data?.lines ?? [];
  const status = cc?.status ?? "…";
  const isCountingPhase = status === "open" || status === "counting";
  const isReviewing = status === "reviewing";

  return (
    <div>
      <PageHeader title={`Cycle count ${id.slice(0, 8)}`}>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs uppercase tracking-wide text-slate-600">
          {status}
        </span>
      </PageHeader>

      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Pallet Item</Th>
              <Th>Expected</Th>
              <Th>Counted</Th>
              <Th>Variance</Th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const localCount =
                counted[l.palletItemId] ??
                (l.countedQty != null ? String(l.countedQty) : "");
              const parsed = localCount === "" ? null : Number.parseInt(localCount, 10);
              const variance = parsed != null && !Number.isNaN(parsed) ? parsed - l.expectedQty : null;
              return (
                <tr key={l.id}>
                  <Td>{l.palletItemId.slice(0, 8)}</Td>
                  <Td>{l.expectedQty}</Td>
                  <Td>
                    {isCountingPhase ? (
                      <Input
                        type="number"
                        min={0}
                        value={localCount}
                        onChange={(e) =>
                          setCounted((p) => ({ ...p, [l.palletItemId]: e.target.value }))
                        }
                        className="w-24"
                      />
                    ) : (
                      (l.countedQty ?? "—")
                    )}
                  </Td>
                  <Td>
                    <span
                      className={
                        variance != null && variance !== 0 ? "text-amber-700 font-medium" : ""
                      }
                    >
                      {variance ?? ""}
                    </span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      {isCountingPhase && (
        <div className="mt-4">
          <Card>
            <Button
              disabled={submit.isPending || lines.length === 0}
              onClick={() => {
                const payload = lines
                  .map((l) => {
                    const raw = counted[l.palletItemId];
                    if (raw == null || raw === "") return null;
                    const n = Number.parseInt(raw, 10);
                    if (Number.isNaN(n) || n < 0) return null;
                    return { palletItemId: l.palletItemId, countedQty: n };
                  })
                  .filter((x): x is { palletItemId: string; countedQty: number } => x != null);
                if (payload.length === 0) return;
                submit.mutate({ id, lines: payload });
              }}
            >
              {submit.isPending ? "Submitting..." : "Submit counts"}
            </Button>
            {submit.error && <p className="mt-2 text-sm text-red-700">{submit.error.message}</p>}
          </Card>
        </div>
      )}

      {isReviewing && (
        <div className="mt-4">
          <Card>
            <div className="mb-2 font-medium">Manager approval</div>
            <Button disabled={approve.isPending} onClick={() => approve.mutate({ id })}>
              {approve.isPending ? "Approving..." : "Approve & post variances"}
            </Button>
            {approve.data && (
              <span className="ml-3 text-sm text-green-700">
                Posted {approve.data.variances} variance(s)
              </span>
            )}
            {approve.error && <p className="mt-2 text-sm text-red-700">{approve.error.message}</p>}
          </Card>
        </div>
      )}
    </div>
  );
}
