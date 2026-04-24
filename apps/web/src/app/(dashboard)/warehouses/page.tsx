"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, SquircleIcon, TextField } from "~/components/kit";
import { Ic } from "~/components/icons";

export default function WarehousesPage() {
  const t = theme;
  const utils = trpc.useUtils();
  const list = trpc.warehouse.list.useQuery();
  const create = trpc.warehouse.create.useMutation({
    onSuccess: () => utils.warehouse.list.invalidate(),
  });

  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  return (
    <div>
      <PageTitle
        eyebrow="Sites"
        title="Warehouses"
        subtitle="The physical buildings your stock lives in."
      />

      <Card t={t}>
        <form
          style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({ code, name, timezone: "UTC" });
            setCode("");
            setName("");
          }}
        >
          <Field label="Code">
            <TextField
              t={t}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="WH1"
              required
            />
          </Field>
          <Field label="Name">
            <TextField
              t={t}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Main DC"
              required
            />
          </Field>
          <Btn
            t={t}
            variant="accent"
            size="md"
            icon={Ic.Plus}
            type="submit"
            disabled={create.isPending}
          >
            {create.isPending ? "Creating…" : "Create warehouse"}
          </Btn>
        </form>
      </Card>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 14,
          marginTop: 20,
        }}
      >
        {(list.data?.length ?? 0) === 0 && (
          <Card t={t} tint="alt">
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <SquircleIcon t={t} icon={Ic.Warehouse} tint="neutral" size={44} />
              <div style={{ fontSize: 14, color: t.muted }}>
                No warehouses yet. Create your first above.
              </div>
            </div>
          </Card>
        )}
        {list.data?.map((w) => (
          <Link
            key={w.id}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            href={`/warehouses/${w.id}` as any}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <Card t={t} padding={18}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <SquircleIcon t={t} icon={Ic.Warehouse} tint="primary" size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: t.muted }}>
                    {w.code}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: t.ink }}>{w.name}</div>
                  <div style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>{w.timezone}</div>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontSize: 11,
          color: theme.muted,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}
