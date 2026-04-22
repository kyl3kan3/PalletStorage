"use client";

import Link from "next/link";
import type { Route } from "next";
import { trpc } from "~/lib/trpc";
import { theme, FONTS, Cubby } from "~/lib/theme";
import { Card } from "./kit";
import { Ic } from "./icons";

/**
 * First-run onboarding checklist. Renders on Home only when the
 * signed-in user's org is missing any of the "core" setup steps:
 * warehouse, product, and at least one inbound or outbound order.
 * Disappears once coreDone is true so long-time users aren't nagged.
 */
export function OnboardingChecklist() {
  const t = theme;
  const q = trpc.organization.onboarding.useQuery(undefined, { staleTime: 30_000 });
  const data = q.data;
  if (!data || data.coreDone) return null;

  const steps: Array<{
    done: boolean;
    title: string;
    desc: string;
    href: Route;
    action: string;
  }> = [
    {
      done: data.warehouse,
      title: "Set up your first warehouse",
      desc: "The physical site your pallets live in. Name it, pick a timezone, and add at least one rack location inside.",
      href: "/warehouses",
      action: "Go to Warehouses",
    },
    {
      done: data.product,
      title: "Add a product (or import from CSV)",
      desc: "Every inbound/outbound line points at a product. You can add one by hand or drop in a CSV with SKU + name columns.",
      href: "/products",
      action: "Go to Products",
    },
    {
      done: data.customer || data.supplier,
      title: "Add a customer or supplier",
      desc: "Optional but recommended — linking suppliers and customers makes receipts and shipping labels look proper.",
      href: "/catalog",
      action: "Go to Catalog",
    },
    {
      done: data.inbound || data.outbound,
      title: "Create your first order",
      desc: "Either receive a shipment (inbound) or ship one out (outbound). The rest of the app comes alive after that.",
      href: "/inbound/new",
      action: "Receive a shipment",
    },
  ];

  const remaining = steps.filter((s) => !s.done).length;

  return (
    <Card t={t} tint="primary" padding={20} style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flexShrink: 0 }}>
          <Cubby size={64} t={t} mood="wow" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              color: t.primaryDeep,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            Getting started · {remaining} step{remaining === 1 ? "" : "s"} left
          </div>
          <div
            style={{
              fontFamily: FONTS.display,
              fontSize: 22,
              fontWeight: 600,
              color: t.ink,
              letterSpacing: -0.4,
              marginBottom: 4,
            }}
          >
            Welcome — let&apos;s get your warehouse wired up.
          </div>
          <div style={{ fontSize: 13, color: t.body, lineHeight: 1.5, marginBottom: 12 }}>
            Work through these in order and you&apos;ll have a working inbound
            receipt within a few minutes.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {steps.map((s, i) => (
              <Step
                key={i}
                done={s.done}
                index={i + 1}
                title={s.title}
                desc={s.desc}
                href={s.href}
                action={s.action}
              />
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function Step({
  done,
  index,
  title,
  desc,
  href,
  action,
}: {
  done: boolean;
  index: number;
  title: string;
  desc: string;
  href: Route;
  action: string;
}) {
  const t = theme;
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: "10px 12px",
        borderRadius: 10,
        background: done ? t.mintSoft : t.surface,
        border: `1.5px solid ${t.border}`,
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 999,
          background: done ? t.mint : t.primarySoft,
          color: done ? "#1F6B45" : t.primaryDeep,
          display: "grid",
          placeItems: "center",
          fontSize: 12,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {done ? <Ic.Check size={14} /> : index}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            color: t.ink,
            fontSize: 13.5,
            textDecoration: done ? "line-through" : undefined,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 12, color: t.muted, marginTop: 2, lineHeight: 1.45 }}>
          {desc}
        </div>
      </div>
      {!done && (
        <Link
          href={href}
          style={{
            whiteSpace: "nowrap",
            padding: "6px 12px",
            borderRadius: 10,
            background: t.ink,
            color: t.primary,
            fontFamily: FONTS.sans,
            fontSize: 12,
            fontWeight: 600,
            textDecoration: "none",
            alignSelf: "center",
          }}
        >
          {action} →
        </Link>
      )}
    </div>
  );
}
