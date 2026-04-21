"use client";

import Link from "next/link";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Card, PageTitle, SquircleIcon, Tag } from "~/components/kit";
import { Ic } from "~/components/icons";
import { cycleCountStatusTone } from "~/lib/statusTone";

export default function CycleCountsPage() {
  const t = theme;
  const list = trpc.cycleCount.listOpen.useQuery();

  return (
    <div>
      <PageTitle
        eyebrow="Stock takes"
        title="Cycle counts"
        subtitle="Open and in-progress counts across the floor."
      />

      <Card t={t} padding={0}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 140px 140px 140px 24px",
            gap: 16,
            padding: "14px 20px",
            fontSize: 11,
            color: t.muted,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          <div>Count</div>
          <div>Status</div>
          <div>Due</div>
          <div>Submitted</div>
          <div />
        </div>

        {(list.data?.length ?? 0) === 0 && (
          <div
            style={{
              padding: "28px 20px",
              color: t.muted,
              fontSize: 13,
              borderTop: `1.5px dashed ${t.border}`,
              textAlign: "center",
            }}
          >
            No open counts. Create one from the mobile app.
          </div>
        )}

        {list.data?.map((c) => (
          <Link
            key={c.id}
            href={`/inventory/counts/${c.id}`}
            style={{
              display: "grid",
              gridTemplateColumns: "1.1fr 140px 140px 140px 24px",
              gap: 16,
              padding: "14px 20px",
              alignItems: "center",
              borderTop: `1.5px dashed ${t.border}`,
              textDecoration: "none",
              color: t.body,
              fontSize: 13.5,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <SquircleIcon t={t} icon={Ic.Clipboard} tint="sky" size={36} />
              <span style={{ fontFamily: FONTS.mono, color: t.ink, fontWeight: 600 }}>
                {c.id.slice(0, 8)}
              </span>
            </div>
            <span>
              <Tag t={t} tone={cycleCountStatusTone(c.status)}>
                {c.status}
              </Tag>
            </span>
            <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.muted }}>
              {c.dueAt?.toLocaleDateString() ?? "—"}
            </span>
            <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.muted }}>
              {c.submittedAt?.toLocaleDateString() ?? "—"}
            </span>
            <Ic.Arrow size={14} color={t.muted} />
          </Link>
        ))}
      </Card>
    </div>
  );
}
