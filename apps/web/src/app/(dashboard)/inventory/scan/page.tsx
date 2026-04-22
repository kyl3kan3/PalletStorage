"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, Search, SquircleIcon, Tag } from "~/components/kit";
import { Ic } from "~/components/icons";
import { BackLink } from "~/components/back-link";

export default function InventoryScanPage() {
  const t = theme;
  const [code, setCode] = useState("");
  const resolve = trpc.scan.resolve.useQuery({ code }, { enabled: code.length > 3 });

  const data = resolve.data;

  return (
    <div>
      <BackLink href="/inventory" label="Back to inventory" />
      <PageTitle
        eyebrow="Look up a pallet or bin"
        title="Inventory"
        subtitle="Scan or paste an LPN / location code to see where something is."
        right={
          <Link href="/inventory/counts" style={{ textDecoration: "none" }}>
            <Btn t={t} variant="secondary" size="md" icon={Ic.Clipboard}>
              Cycle counts
            </Btn>
          </Link>
        }
      />

      <Card t={t}>
        <div
          style={{
            fontSize: 11,
            color: t.muted,
            textTransform: "uppercase",
            letterSpacing: 0.4,
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          Scan or type a code
        </div>
        <Search
          t={t}
          value={code}
          placeholder="P-XXXXXXXXXX or L-XXXXXXXXXX"
          width={420}
          onChange={setCode}
        />
      </Card>

      <div style={{ marginTop: 16 }}>
        {!data && (
          <Card t={t} tint="alt">
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <SquircleIcon t={t} icon={Ic.Scan} tint="neutral" size={44} />
              <div style={{ fontSize: 14, color: t.muted }}>
                Start typing a code to look it up.
              </div>
            </div>
          </Card>
        )}

        {data?.kind === "pallet" && data.pallet && (
          <Card t={t}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
              <SquircleIcon t={t} icon={Ic.Package} tint="primary" size={52} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: FONTS.mono, fontSize: 18, fontWeight: 600, color: t.ink }}>
                  {data.pallet.lpn}
                </div>
                <div style={{ fontSize: 12.5, color: t.muted }}>Pallet</div>
              </div>
              <Tag t={t} tone={data.pallet.status === "stored" ? "mint" : "primary"}>
                {data.pallet.status}
              </Tag>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Fact
                label="Location"
                value={data.pallet.currentLocationId?.slice(0, 8) ?? "unassigned"}
              />
              <Fact
                label="Weight"
                value={data.pallet.weightKg ? `${data.pallet.weightKg} kg` : "—"}
              />
            </div>
          </Card>
        )}

        {data?.kind === "location" && data.location && (
          <Card t={t}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <SquircleIcon t={t} icon={Ic.Pin} tint="sky" size={52} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: FONTS.mono, fontSize: 18, fontWeight: 600, color: t.ink }}>
                  {data.location.path}
                </div>
                <div style={{ fontSize: 12.5, color: t.muted }}>
                  Location · {data.location.type}
                </div>
              </div>
            </div>
          </Card>
        )}

        {data?.kind === "unknown" && (
          <Card t={t} tint="coral">
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <SquircleIcon t={t} icon={Ic.X} tint="coral" size={44} />
              <div>
                <div style={{ fontWeight: 600, color: t.ink }}>Unknown code</div>
                <div style={{ fontSize: 12.5, color: t.muted }}>
                  Must start with <code>P-</code> (pallet) or <code>L-</code> (location).
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: theme.muted,
          textTransform: "uppercase",
          letterSpacing: 0.4,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: FONTS.mono, color: theme.ink, marginTop: 2, fontSize: 14 }}>
        {value}
      </div>
    </div>
  );
}
