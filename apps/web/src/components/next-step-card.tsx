"use client";

import type { ReactNode } from "react";
import { theme, FONTS } from "~/lib/theme";
import { Card } from "./kit";
import type { NextStep } from "~/lib/friendly";

/**
 * Primary "What's next?" card rendered at the top of order detail
 * pages. Communicates one recommended action per status and hosts
 * the action button(s) that execute it.
 */
export function NextStepCard({
  step,
  children,
}: {
  step: NextStep;
  children: ReactNode;
}) {
  const t = theme;
  const tint =
    step.tone === "primary"
      ? "primary"
      : step.tone === "sky"
        ? "sky"
        : step.tone === "mint"
          ? "mint"
          : step.tone === "coral"
            ? "coral"
            : "alt";
  return (
    <Card t={t} tint={tint} padding={20}>
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
        Next step
      </div>
      <div
        style={{
          fontFamily: FONTS.display,
          fontSize: 22,
          fontWeight: 600,
          color: t.ink,
          letterSpacing: -0.4,
          lineHeight: 1.15,
        }}
      >
        {step.label}
      </div>
      <div
        style={{
          fontSize: 13.5,
          color: t.body,
          marginTop: 6,
          lineHeight: 1.5,
          maxWidth: 640,
        }}
      >
        {step.blurb}
      </div>
      <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
        {children}
      </div>
    </Card>
  );
}
