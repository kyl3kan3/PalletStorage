"use client";

import { useMemo, useState } from "react";
import { FShell, type FShellTab } from "~/components/floor-shell";
import { FCard, FBtn, FPill, KPI, Skeleton, EmptyState } from "~/components/kit";
import { floorTheme as t, FONTS } from "~/lib/theme";
import { Ic } from "~/components/icons";
import { trpc } from "~/lib/trpc";

/**
 * Floor-mode Cycle counts at /floor/counts.
 *
 * cycleCount.listOpen returns rows in 'open' / 'counting' / 'reviewing'
 * statuses. We bucket those into the tabs and show a row per count.
 * Overdue is computed client-side from dueAt.
 */

type CCStatus = "open" | "counting" | "reviewing" | "approved" | "cancelled";

export default function FloorCycleCounts() {
  const [tab, setTab] = useState("open");

  // Returns id, organizationId, warehouseId, locationId, status,
  // assignedUserId, dueAt, submittedAt, approvedAt, etc.
  const list = trpc.cycleCount.listOpen.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const buckets = useMemo(() => {
    const all = list.data ?? [];
    return {
      open: all.filter((c) => c.status === "open" || c.status === "counting"),
      reviewing: all.filter((c) => c.status === "reviewing"),
    };
  }, [list.data]);

  const visible = tab === "reviewing" ? buckets.reviewing : buckets.open;

  const tabs: FShellTab[] = [
    { key: "open", label: "Open", count: buckets.open.length },
    { key: "reviewing", label: "Reviewing", count: buckets.reviewing.length },
    { key: "approved", label: "Approved" },
  ];

  return (
    <FShell
      eyebrow="Audit"
      title="Cycle counts"
      subtitle={
        list.isLoading
          ? "Loading…"
          : `${buckets.open.length} open · ${buckets.reviewing.length} reviewing`
      }
      tabs={tabs}
      tabActive={tab}
      onTabChange={setTab}
      actions={
        <FBtn t={t} variant="primary" size="md" icon={Ic.Plus}>
          New count
        </FBtn>
      }
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 14,
          marginBottom: 16,
        }}
      >
        <KPI t={t} label="Open" value={buckets.open.length} />
        <KPI t={t} label="Reviewing" value={buckets.reviewing.length} />
        <KPI t={t} label="Total" value={(list.data ?? []).length} />
      </div>

      <FCard t={t} padding={0}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "150px 1fr 110px 110px 120px",
            gap: 14,
            padding: "12px 20px",
            fontFamily: FONTS.mono,
            fontSize: 10,
            fontWeight: 700,
            color: t.muted,
            letterSpacing: 0.6,
            textTransform: "uppercase",
          }}
        >
          <div>Count ID</div>
          <div>Location</div>
          <div>Status</div>
          <div>Due</div>
          <div>Submitted</div>
        </div>
        {list.isLoading && (
          <div style={{ padding: 20 }}>
            <Skeleton t={t} lines={4} rowHeight={44} />
          </div>
        )}
        {!list.isLoading && visible.length === 0 && (
          <EmptyState
            t={t}
            title={tab === "reviewing" ? "Nothing to review" : "Queue clear"}
            hint={
              tab === "reviewing"
                ? "Counts come here once an operator has submitted observations. Managers approve or send back."
                : "No open cycle counts. Hit New count to schedule one for a zone."
            }
          />
        )}
        {visible.map((c) => {
          const overdue =
            c.dueAt &&
            (c.status === "open" || c.status === "counting") &&
            new Date(c.dueAt) < new Date();
          return (
            <div
              key={c.id}
              style={{
                display: "grid",
                gridTemplateColumns: "150px 1fr 110px 110px 120px",
                gap: 14,
                padding: "12px 20px",
                alignItems: "center",
                borderTop: `1px dashed ${t.border}`,
                background: overdue ? t.coralSoft : undefined,
              }}
            >
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 12,
                  fontWeight: 700,
                  color: t.ink,
                  letterSpacing: 0.2,
                }}
              >
                CC-{c.id.slice(0, 8)}
              </span>
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 12,
                  color: t.body,
                  letterSpacing: 0.2,
                }}
              >
                {c.locationId.slice(0, 8)}
              </span>
              <span>
                <FPill t={t} tone={countTone(c.status as CCStatus, !!overdue)} size="sm">
                  {overdue ? "overdue" : c.status}
                </FPill>
              </span>
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 12,
                  fontWeight: 700,
                  color: overdue ? t.coral : t.body,
                }}
              >
                {c.dueAt ? new Date(c.dueAt).toLocaleDateString() : "—"}
              </span>
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 12,
                  color: t.body,
                }}
              >
                {c.submittedAt ? new Date(c.submittedAt).toLocaleDateString() : "—"}
              </span>
            </div>
          );
        })}
      </FCard>
    </FShell>
  );
}

function countTone(
  s: CCStatus,
  overdue: boolean,
): "primary" | "mint" | "sky" | "coral" {
  if (overdue) return "coral";
  if (s === "counting") return "primary";
  if (s === "reviewing") return "sky";
  if (s === "approved") return "mint";
  return "coral";
}
