"use client";

import Link from "next/link";
import type { Route } from "next";
import { useUser } from "@clerk/nextjs";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, Tag } from "~/components/kit";
import { Ic } from "~/components/icons";
import { useIsManager } from "~/lib/useRole";

/**
 * Home — "Today" board. Two side-by-side lanes (Inbound / Outbound)
 * that mirror the actual operator flow:
 *
 *   Inbound:   scheduled → at dock → receiving → put away
 *   Outbound:  scheduled → at dock → picking → loading → ship + bill
 *
 * Each step shows a count and links straight to the right page so the
 * user doesn't have to think "where do I do this?".
 */
export default function HomePage() {
  const t = theme;
  const { user } = useUser();
  const isManager = useIsManager();
  const counts = trpc.appointment.todayCounts.useQuery();
  const upcoming = trpc.appointment.list.useQuery({});

  const firstName = user?.firstName ?? null;
  const hour = new Date().getHours();
  const greeting =
    hour < 5
      ? "You're up early"
      : hour < 12
        ? "Good morning"
        : hour < 18
          ? "Good afternoon"
          : "Good evening";

  const today = new Date();
  const sameDay = (d: Date) =>
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();

  const todaysTrucks = (upcoming.data ?? []).filter((a) =>
    sameDay(new Date(a.scheduledAt)),
  );
  const c = counts.data;

  return (
    <div>
      <PageTitle
        eyebrow={today.toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
        title={firstName ? `${greeting}, ${firstName}` : greeting}
        subtitle="What's on the dock today."
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

      <div
        data-collapse-grid
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <Lane
          t={t}
          title="Inbound"
          subtitle="Trucks coming in. Receive paperwork, then put pallets away."
          tint="primary"
          steps={[
            {
              label: "Scheduled today",
              count: c?.inboundScheduledToday ?? 0,
              href: "/schedule",
              hint: "Trucks with an appointment today",
            },
            {
              label: "At the dock",
              count: c?.inboundAtDock ?? 0,
              href: "/schedule",
              hint: "Truck arrived — assign a door if you haven't yet",
            },
            {
              label: "Receiving",
              count: c?.inboundReceiving ?? 0,
              href: "/inbound",
              hint: "Inbound orders being unloaded",
            },
            {
              label: "Awaiting putaway",
              count: c?.palletsAwaitingPutaway ?? 0,
              href: "/inventory/stock?status=received",
              hint: "Pallets on the dock that need a rack location",
            },
          ]}
        />
        <Lane
          t={t}
          title="Outbound"
          subtitle="Trucks going out. Pick, load, give the driver paperwork, invoice."
          tint="mint"
          steps={[
            {
              label: "Scheduled today",
              count: c?.outboundScheduledToday ?? 0,
              href: "/schedule",
              hint: "Pickups with an appointment today",
            },
            {
              label: "At the dock",
              count: c?.outboundAtDock ?? 0,
              href: "/schedule",
              hint: "Truck arrived — assign a door, pull picks",
            },
            {
              label: "Picking",
              count: c?.outboundPicking ?? 0,
              href: "/outbound",
              hint: "Orders mid-pick from the rack",
            },
            {
              label: "Packed — ready to load",
              count: c?.outboundPacked ?? 0,
              href: "/outbound",
              hint: "Finish loading + give the driver the BOL",
            },
          ]}
        />
      </div>

      <Card t={t} padding={0}>
        <div
          style={{
            padding: "12px 18px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            borderBottom: `1.5px solid ${t.border}`,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: t.muted,
              textTransform: "uppercase",
              letterSpacing: 0.6,
              fontWeight: 600,
            }}
          >
            Today's trucks
          </div>
          <div style={{ flex: 1 }} />
          <Link
            href={"/schedule" as Route}
            style={{ color: t.primaryDeep, fontSize: 12.5, fontWeight: 600 }}
          >
            Open schedule →
          </Link>
        </div>
        {todaysTrucks.length === 0 && (
          <div style={{ padding: "16px 18px", fontSize: 13, color: t.muted }}>
            No trucks scheduled for today.{" "}
            {isManager && (
              <Link
                href={"/schedule/new" as Route}
                style={{ color: t.primaryDeep, fontWeight: 600 }}
              >
                Add one
              </Link>
            )}
          </div>
        )}
        {todaysTrucks.map((a, i) => {
          const time = new Date(a.scheduledAt).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          });
          const counterparty =
            a.type === "inbound"
              ? a.supplierName ?? a.carrier ?? "—"
              : a.customerName ?? a.carrier ?? "—";
          return (
            <Link
              key={a.id}
              href={`/schedule/${a.id}` as Route}
              style={{
                display: "grid",
                gridTemplateColumns: "70px 80px 1fr 90px 130px",
                gap: 10,
                padding: "10px 18px",
                borderTop: i === 0 ? "none" : `1.5px dashed ${t.border}`,
                fontSize: 13,
                color: t.body,
                textDecoration: "none",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontFamily: FONTS.mono,
                  color: t.ink,
                  fontWeight: 600,
                }}
              >
                {time}
              </span>
              <Tag t={t} tone={a.type === "inbound" ? "primary" : "mint"}>
                {a.type}
              </Tag>
              <span style={{ color: t.ink, fontWeight: 600 }}>
                {counterparty}
                {a.reference ? (
                  <span
                    style={{
                      marginLeft: 6,
                      fontFamily: FONTS.mono,
                      fontWeight: 400,
                      color: t.muted,
                      fontSize: 12,
                    }}
                  >
                    {a.reference}
                  </span>
                ) : null}
              </span>
              <span style={{ fontSize: 11.5, color: t.muted }}>
                {a.dockCode ? `Dock ${a.dockCode}` : "no door"}
              </span>
              <StatusTag t={t} status={a.status} />
            </Link>
          );
        })}
      </Card>
    </div>
  );
}

function Lane({
  t,
  title,
  subtitle,
  tint,
  steps,
}: {
  t: typeof theme;
  title: string;
  subtitle: string;
  tint: "primary" | "mint";
  steps: Array<{ label: string; count: number; href: string; hint: string }>;
}) {
  return (
    <Card t={t} tint={tint} padding={0}>
      <div style={{ padding: "14px 18px 4px" }}>
        <div
          style={{
            fontSize: 11,
            color: t.muted,
            textTransform: "uppercase",
            letterSpacing: 0.6,
            fontWeight: 700,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 12.5, color: t.body, marginTop: 2 }}>
          {subtitle}
        </div>
      </div>
      <div style={{ padding: "8px 8px 12px" }}>
        {steps.map((s) => (
          <Link
            key={s.label}
            href={s.href as Route}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 60px",
              gap: 10,
              alignItems: "center",
              padding: "10px 12px",
              borderRadius: 10,
              textDecoration: "none",
              color: t.ink,
            }}
          >
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: t.ink }}>
                {s.label}
              </div>
              <div style={{ fontSize: 11.5, color: t.muted, marginTop: 1 }}>
                {s.hint}
              </div>
            </div>
            <div
              style={{
                fontFamily: FONTS.mono,
                fontWeight: 700,
                fontSize: 22,
                color: s.count > 0 ? t.ink : t.muted,
                textAlign: "right",
              }}
            >
              {s.count}
            </div>
          </Link>
        ))}
      </div>
    </Card>
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
