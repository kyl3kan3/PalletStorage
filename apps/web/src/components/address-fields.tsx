"use client";

import type { ReactNode } from "react";
import { theme, FONTS } from "~/lib/theme";
import { TextField } from "./kit";

/**
 * Reusable two-column field grid used by customer / supplier / company
 * profile forms. Keeps labels, spacing, and mobile collapse identical
 * across pages.
 */
export function FormGrid({ children }: { children: ReactNode }) {
  return (
    <div
      data-collapse-grid
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
    >
      {children}
    </div>
  );
}

export function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: theme.muted,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          fontWeight: 600,
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

export function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          fontSize: 11,
          color: theme.muted,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          fontWeight: 600,
          fontFamily: FONTS.sans,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

/** Shortcut: labelled TextField. */
export function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <FormField label={label}>
      <TextField
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        placeholder={placeholder}
      />
    </FormField>
  );
}
