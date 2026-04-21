"use client";

// Legacy UI surface kept so existing pages don't need to be rewritten
// all at once. Each component delegates to the new warm "stacks" design
// kit (kit.tsx). New code should import from `./kit` directly.

import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type TableHTMLAttributes,
  type ThHTMLAttributes,
  type TdHTMLAttributes,
  type ReactNode,
} from "react";
import { Btn, Card as KitCard, TextField, PageTitle } from "./kit";
import { theme, FONTS } from "~/lib/theme";

// Small Tailwind stand-in kept only for `buttonClass` string consumers
// (next/link styled like a button). Uses the new ink background.
export const buttonClass =
  "inline-flex items-center rounded-xl bg-[#1F1A17] px-4 py-2 text-sm font-semibold text-[#FFB23E] shadow-[0_2px_0_rgba(0,0,0,.2),0_4px_12px_rgba(0,0,0,.12)] hover:opacity-95 disabled:opacity-50";

export function Button({
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  // Delegate to the kit's Btn with the "primary" (ink) variant by default.
  return (
    <Btn variant="primary" size="md" {...rest}>
      {children}
    </Btn>
  );
}

export function Input({ style, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <TextField {...rest} style={style} />;
}

export function Table({ className = "", style, ...rest }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      {...rest}
      className={className}
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontSize: 13.5,
        fontFamily: FONTS.sans,
        color: theme.body,
        ...(style || {}),
      }}
    />
  );
}

export function Th({
  children,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode }) {
  return (
    <th
      {...rest}
      style={{
        borderBottom: `1.5px solid ${theme.border}`,
        padding: "10px 14px",
        textAlign: "left",
        fontWeight: 600,
        fontSize: 11,
        color: theme.muted,
        letterSpacing: 0.4,
        textTransform: "uppercase",
      }}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode }) {
  return (
    <td
      {...rest}
      style={{
        borderBottom: `1.5px dashed ${theme.border}`,
        padding: "12px 14px",
        color: theme.body,
      }}
    >
      {children}
    </td>
  );
}

export function PageHeader({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return <PageTitle title={title} right={children} />;
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <KitCard padding={22} radius={20}>
      {children}
    </KitCard>
  );
}
