"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, Tabs, Tag, type TabItem } from "~/components/kit";
import { Ic } from "~/components/icons";
import { useIsManager } from "~/lib/useRole";

/**
 * Dock schedule. Lists upcoming appointments grouped by day. The
 * primary action is "Schedule a truck" — both inbound deliveries and
 * outbound pickups land here so the operator has one screen to
 * answer "what trucks are coming today / this week".
 */
export default function SchedulePage() {
  const t = theme;
  const isManager = useIsManager();
  const [tab, setTab] = useState<"all" | "inbound" | "outbound">("all");
  const list = trpc.appointment.list.useQuery({});
  const utils = trpc.useUtils();

  const checkIn = trpc.appointment.checkIn.useMutation({
    onSuccess: () => utils.appointment.list.invalidate(),
  });
  const complete = trpc.appointment.complete.useMutation({
    onSuccess: () => utils.appointment.list.invalidate(),
  });
  const cancel = trpc.appointment.cancel.useMutation({
    onSuccess: () => utils.appointment.list.invalidate(),
  });

  const filtered = (list.data ?? []).filter(
    (a) => tab === "all" || a.type === tab,
  );

  const tabs: TabItem[] = useMemo(() => {
    const all = list.data ?? [];
    return [
      { key: "all", label: "All", count: all.length },
      {
        key: "inbound",
        label: "Inbound",
        count: all.filter((a) => a.type === "inbound").length,
      },
      {
        key: "outbound",
        label: "Outbound",
        count: all.filter((a) => a.type === "outbound").length,
      },
    ];
  }, [list.data]);

  // Group appointments by their scheduled date.
  const byDay = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const a of filtered) {
      const key = new Date(a.scheduledAt).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      const arr = map.get(key) ?? [];
      arr.push(a);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div>
      <PageTitle
        eyebrow="Dock board"
        title="Schedule"
        subtitle="Trucks scheduled to arrive at the warehouse — both deliveries coming in and pickups going out."
        right={
          isManager && (
            <Link href={"/schedule/new" as Route} style={{ textDecoration: "none" }}>
              <Btn t={t} variant="accent" size="md" icon={Ic.Plus}>
                Schedule a truck
              </Btn>
            </Link>
          )
        }
      />

      <div style={{ marginBottom: 16 }}>
        <Tabs t={t} items={tabs} active={tab} onChange={(k) => setTab(k as typeof tab)} />
      </div>

      {byDay.length === 0 && (
        <Card t={t}>
          <div style={{ fontSize: 13, color: t.muted }}>
            Nothing scheduled in the next two weeks. When a truck calls,{" "}
            {isManager ? (
              <Link
                href={"/schedule/new" as Route}
                style={{ color: t.primaryDeep, fontWeight: 600 }}
              >
                schedule it here
              </Link>
            ) : (
              "ask a manager to schedule it"
            )}
            .
          </div>
        </Card>
      )}

      {byDay.map(([day, rows]) => (
        <div key={day} style={{ marginBottom: 18 }}>
          <div
            style={{
              fontSize: 12,
              color: t.muted,
              textTransform: "uppercase",
              letterSpacing: 0.6,
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            {day}
          </div>
          <Card t={t} padding={0}>
            {rows.map((a, i) => {
              const time = new Date(a.scheduledAt).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              });
              const counterparty =
                a.type === "inbound"
                  ? a.supplierName ?? a.carrier ?? "—"
                  : a.customerName ?? a.carrier ?? "—";
              return (
                <div
                  key={a.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "80px 90px 1.4fr 1.2fr 110px 130px 220px",
                    gap: 12,
                    padding: "12px 16px",
                    borderTop: i === 0 ? "none" : `1.5px dashed ${t.border}`,
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: 13,
                      fontWeight: 600,
                      color: t.ink,
                    }}
                  >
                    {time}
                  </div>
                  <div>
                    <Tag
                      t={t}
                      tone={a.type === "inbound" ? "primary" : "mint"}
                    >
                      {a.type}
                    </Tag>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: t.ink, fontWeight: 600 }}>
                      {counterparty}
                    </div>
                    <div style={{ fontSize: 11.5, color: t.muted }}>
                      {a.driverName ?? "—"}
                      {a.driverPhone ? ` · ${a.driverPhone}` : ""}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontFamily: FONTS.mono,
                        fontSize: 12,
                        color: t.body,
                      }}
                    >
                      {a.reference ?? "—"}
                    </div>
                    <div style={{ fontSize: 11, color: t.muted }}>
                      {a.dockCode ? `Dock ${a.dockCode}` : "no door yet"}
                    </div>
                  </div>
                  <StatusTag t={t} status={a.status} />
                  <div style={{ fontSize: 11.5, color: t.muted }}>
                    {a.inboundOrderId ? (
                      <Link
                        href={`/inbound/${a.inboundOrderId}` as Route}
                        style={{ color: t.primaryDeep }}
                      >
                        open inbound
                      </Link>
                    ) : a.outboundOrderId ? (
                      <Link
                        href={`/outbound/${a.outboundOrderId}` as Route}
                        style={{ color: t.primaryDeep }}
                      >
                        open outbound
                      </Link>
                    ) : (
                      "no order linked"
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {isManager && a.status === "scheduled" && (
                      <Btn
                        t={t}
                        type="button"
                        variant="primary"
                        size="sm"
                        icon={Ic.Check}
                        disabled={checkIn.isPending}
                        onClick={() => checkIn.mutate({ id: a.id })}
                      >
                        Check in
                      </Btn>
                    )}
                    {isManager &&
                      (a.status === "at_dock" || a.status === "in_progress") && (
                        <Btn
                          t={t}
                          type="button"
                          variant="primary"
                          size="sm"
                          icon={Ic.Check}
                          disabled={complete.isPending}
                          onClick={() => complete.mutate({ id: a.id })}
                        >
                          Complete
                        </Btn>
                      )}
                    {isManager &&
                      a.status !== "completed" &&
                      a.status !== "cancelled" && (
                        <Btn
                          t={t}
                          type="button"
                          variant="secondary"
                          size="sm"
                          icon={Ic.X}
                          disabled={cancel.isPending}
                          onClick={() => cancel.mutate({ id: a.id })}
                        >
                          Cancel
                        </Btn>
                      )}
                    <Link
                      href={`/schedule/${a.id}` as Route}
                      style={{ textDecoration: "none" }}
                    >
                      <Btn
                        t={t}
                        type="button"
                        variant="secondary"
                        size="sm"
                        icon={Ic.Arrow}
                      >
                        Details
                      </Btn>
                    </Link>
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      ))}
    </div>
  );
}

function StatusTag({
  t,
  status,
}: {
  t: typeof theme;
  status: string;
}) {
  const tone =
    status === "scheduled"
      ? "neutral"
      : status === "at_dock"
        ? "primary"
        : status === "in_progress"
          ? "primary"
          : status === "completed"
            ? "mint"
            : "coral";
  const label =
    status === "at_dock"
      ? "at dock"
      : status === "in_progress"
        ? "in progress"
        : status;
  return (
    <Tag t={t} tone={tone as "neutral" | "primary" | "mint" | "coral"}>
      {label}
    </Tag>
  );
}
