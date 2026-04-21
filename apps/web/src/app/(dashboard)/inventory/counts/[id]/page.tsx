"use client";

import { use, useState } from "react";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, Tag, TextField } from "~/components/kit";
import { Ic } from "~/components/icons";
import { cycleCountStatusTone } from "~/lib/statusTone";

/**
 * Variance review page. Shows every line in the count with its expected
 * qty from the snapshot and a writable counted-qty input. Submitting
 * flips status → reviewing; approving (manager only) writes the
 * variance movements and adjusts palletItem.qty.
 */
export default function CycleCountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = theme;
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

  const [counted, setCounted] = useState<Record<string, string>>({});

  const cc = detail.data?.count;
  const lines = detail.data?.lines ?? [];
  const status = cc?.status ?? "…";
  const isCountingPhase = status === "open" || status === "counting";
  const isReviewing = status === "reviewing";

  return (
    <div>
      <PageTitle
        eyebrow={cc ? `Opened ${cc.createdAt.toLocaleDateString()}` : "Cycle count"}
        title={`Count ${id.slice(0, 8)}`}
        right={
          <Tag t={t} tone={cycleCountStatusTone(status)}>
            {status}
          </Tag>
        }
      />

      <Card t={t} padding={0}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "200px 100px 160px 140px",
            gap: 16,
            padding: "14px 20px",
            fontSize: 11,
            color: t.muted,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          <div>Pallet item</div>
          <div>Expected</div>
          <div>Counted</div>
          <div>Variance</div>
        </div>

        {lines.length === 0 && (
          <div
            style={{
              padding: "28px 20px",
              color: t.muted,
              fontSize: 13,
              borderTop: `1.5px dashed ${t.border}`,
              textAlign: "center",
            }}
          >
            No items in this count.
          </div>
        )}

        {lines.map((l) => {
          const local = counted[l.palletItemId] ?? (l.countedQty != null ? String(l.countedQty) : "");
          const parsed = local === "" ? null : Number.parseInt(local, 10);
          const variance = parsed != null && !Number.isNaN(parsed) ? parsed - l.expectedQty : null;
          return (
            <div
              key={l.id}
              style={{
                display: "grid",
                gridTemplateColumns: "200px 100px 160px 140px",
                gap: 16,
                padding: "12px 20px",
                alignItems: "center",
                borderTop: `1.5px dashed ${t.border}`,
                fontSize: 13.5,
              }}
            >
              <span style={{ fontFamily: FONTS.mono, color: t.ink }}>
                {l.palletItemId.slice(0, 8)}
              </span>
              <span style={{ fontFamily: FONTS.mono, color: t.ink, fontWeight: 600 }}>
                {l.expectedQty}
              </span>
              <span>
                {isCountingPhase ? (
                  <TextField
                    t={t}
                    type="number"
                    min={0}
                    value={local}
                    onChange={(e) =>
                      setCounted((p) => ({ ...p, [l.palletItemId]: e.target.value }))
                    }
                    style={{ width: 100 }}
                  />
                ) : (
                  <span style={{ fontFamily: FONTS.mono, color: t.ink, fontWeight: 600 }}>
                    {l.countedQty ?? "—"}
                  </span>
                )}
              </span>
              <span>
                {variance == null ? (
                  <span style={{ color: t.muted, fontSize: 13 }}>—</span>
                ) : variance === 0 ? (
                  <Tag t={t} tone="mint">
                    on target
                  </Tag>
                ) : variance > 0 ? (
                  <Tag t={t} tone="sky">
                    over +{variance}
                  </Tag>
                ) : (
                  <Tag t={t} tone="coral">
                    short {variance}
                  </Tag>
                )}
              </span>
            </div>
          );
        })}
      </Card>

      {isCountingPhase && (
        <div style={{ marginTop: 16 }}>
          <Card t={t}>
            <Btn
              t={t}
              variant="accent"
              size="md"
              icon={Ic.Check}
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
                  .filter(
                    (x): x is { palletItemId: string; countedQty: number } => x != null,
                  );
                if (payload.length === 0) return;
                submit.mutate({ id, lines: payload });
              }}
            >
              {submit.isPending ? "Submitting…" : "Submit counts"}
            </Btn>
            {submit.error && (
              <div style={{ marginTop: 8, fontSize: 12, color: t.coral }}>
                {submit.error.message}
              </div>
            )}
          </Card>
        </div>
      )}

      {isReviewing && (
        <div style={{ marginTop: 16 }}>
          <Card t={t} tint="primary">
            <div style={{ fontWeight: 600, color: t.ink, marginBottom: 8 }}>
              Manager approval
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <Btn
                t={t}
                variant="primary"
                size="md"
                icon={Ic.Check}
                disabled={approve.isPending}
                onClick={() => approve.mutate({ id })}
              >
                {approve.isPending ? "Approving…" : "Approve & post variances"}
              </Btn>
              {approve.data && (
                <Tag t={t} tone="mint">
                  Posted {approve.data.variances} variance(s)
                </Tag>
              )}
            </div>
            {approve.error && (
              <div style={{ marginTop: 8, fontSize: 12, color: t.coral }}>
                {approve.error.message}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
