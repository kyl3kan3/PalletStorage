"use client";

// Pill-style reason picker for short-close, cancel, and similar
// "explain why" prompts. Presets become the canonical reason text;
// "Other" reveals a free-text textarea so power users aren't blocked
// when the closest preset doesn't fit.
//
// Captured value is just the chosen reason string (preset label OR
// the typed "Other" text). The audit log already structures actions
// by name; reasons go through unchanged.

import { useState } from "react";
import { theme as defaultTheme, FONTS, type Theme } from "~/lib/theme";

const OTHER = "Other";

export interface ReasonPickerProps {
  t?: Theme;
  presets: string[];
  /** Current reason text. "" means nothing picked yet. */
  value: string;
  onChange: (value: string) => void;
  /** Optional placeholder for the "Other" textarea. */
  otherPlaceholder?: string;
  /** Disable all interaction. */
  disabled?: boolean;
}

export function ReasonPicker({
  t = defaultTheme,
  presets,
  value,
  onChange,
  otherPlaceholder = "Tell us what happened…",
  disabled,
}: ReasonPickerProps) {
  const presetSet = new Set(presets);
  const matchedPreset = presetSet.has(value) ? value : value ? OTHER : "";
  const [otherDraft, setOtherDraft] = useState(matchedPreset === OTHER ? value : "");

  function pickPreset(preset: string) {
    if (preset === OTHER) {
      onChange(otherDraft);
    } else {
      onChange(preset);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {[...presets, OTHER].map((preset) => {
          const active = matchedPreset === preset;
          return (
            <button
              key={preset}
              type="button"
              disabled={disabled}
              onClick={() => pickPreset(preset)}
              style={{
                padding: "8px 14px",
                minHeight: 36,
                borderRadius: 999,
                background: active ? t.primarySoft : t.surfaceAlt,
                color: active ? t.primaryDeep : t.muted,
                border: `1.5px solid ${active ? t.primaryDeep : t.border}`,
                fontFamily: FONTS.sans,
                fontSize: 13,
                fontWeight: 600,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.5 : 1,
              }}
            >
              {preset}
            </button>
          );
        })}
      </div>

      {matchedPreset === OTHER && (
        <textarea
          disabled={disabled}
          value={otherDraft}
          placeholder={otherPlaceholder}
          rows={3}
          onChange={(e) => {
            setOtherDraft(e.target.value);
            onChange(e.target.value);
          }}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            background: t.surfaceAlt,
            border: `1.5px solid ${t.border}`,
            outline: "none",
            fontFamily: FONTS.sans,
            fontSize: 13.5,
            color: t.ink,
            resize: "vertical",
            minHeight: 70,
          }}
        />
      )}
    </div>
  );
}

export const INBOUND_CLOSE_REASONS = [
  "Damaged in transit",
  "Missing from shipment",
  "Supplier short-shipped",
  "Quantity variance",
];

export const INBOUND_CANCEL_REASONS = [
  "Truck did not arrive",
  "Cancelled by supplier",
  "Duplicate order",
  "Wrong order entered",
];

export const OUTBOUND_CANCEL_REASONS = [
  "Customer cancelled",
  "Out of stock",
  "Wrong order entered",
  "Returned to vendor",
];
