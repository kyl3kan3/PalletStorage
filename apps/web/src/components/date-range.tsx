"use client";

import { theme, FONTS } from "~/lib/theme";

export interface DateRange {
  from?: Date;
  to?: Date;
}

/**
 * Lightweight from/to date picker pair with a few preset buttons. Feeds
 * tRPC queries that accept { from?: Date; to?: Date }.
 */
export function DateRangeControl({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (next: DateRange) => void;
}) {
  const t = theme;
  const presets: Array<{ label: string; days: number | null }> = [
    { label: "Today", days: 1 },
    { label: "7d", days: 7 },
    { label: "30d", days: 30 },
    { label: "90d", days: 90 },
    { label: "All", days: null },
  ];
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {presets.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() =>
            onChange(
              p.days == null
                ? {}
                : {
                    from: new Date(Date.now() - p.days * 24 * 3600 * 1000),
                    to: new Date(),
                  },
            )
          }
          style={{
            padding: "6px 10px",
            borderRadius: 10,
            background: t.surfaceAlt,
            border: `1.5px solid ${t.border}`,
            fontFamily: FONTS.sans,
            fontSize: 12,
            fontWeight: 600,
            color: t.muted,
            cursor: "pointer",
          }}
        >
          {p.label}
        </button>
      ))}
      <span style={{ color: t.mutedSoft, fontSize: 12 }}>·</span>
      <DateInput
        label="From"
        value={value.from}
        onChange={(d) => onChange({ ...value, from: d })}
      />
      <DateInput
        label="To"
        value={value.to}
        onChange={(d) => onChange({ ...value, to: d })}
      />
    </div>
  );
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
}) {
  const t = theme;
  const iso = value ? value.toISOString().slice(0, 10) : "";
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 11, color: t.muted, textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </span>
      <input
        type="date"
        value={iso}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) {
            onChange(undefined);
            return;
          }
          onChange(new Date(`${v}T00:00:00`));
        }}
        style={{
          padding: "6px 10px",
          borderRadius: 10,
          background: t.surface,
          border: `1.5px solid ${t.border}`,
          fontFamily: FONTS.mono,
          fontSize: 12,
          color: t.ink,
        }}
      />
    </label>
  );
}
