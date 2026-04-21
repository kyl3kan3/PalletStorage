"use client";

import { OrganizationProfile } from "@clerk/nextjs";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Card, PageTitle, Tag, type TagTone } from "~/components/kit";
import { BackLink } from "~/components/back-link";

/**
 * Team page. Clerk's <OrganizationProfile /> handles invites and role
 * changes natively — we embed it here instead of rebuilding the form.
 * Below it, we mirror the members our DB actually knows about so it's
 * easy to spot anyone who hasn't been auto-provisioned yet (a Clerk
 * invite that hasn't been accepted won't appear in the lower list).
 */
export default function TeamPage() {
  const t = theme;
  const members = trpc.organization.members.useQuery();

  return (
    <div>
      <BackLink href="/settings" label="Back to settings" />
      <PageTitle
        eyebrow="People"
        title="Team & permissions"
        subtitle="Invite people, change roles. Invites and role edits are handled by Clerk below; the WMS mirror appears further down."
      />

      <div style={{ marginBottom: 24 }}>
        <Card t={t} padding={0}>
          {/* Clerk's own UI — renders invite form, pending invites, and
              role editor. Hash routing keeps Clerk's internal sub-pages
              (members / invitations) on the same URL so navigating into
              them doesn't dump you out of the WMS layout. */}
          <OrganizationProfile
            routing="hash"
            appearance={{
              elements: { rootBox: "w-full", cardBox: "shadow-none border-0 w-full" },
            }}
          />
        </Card>
      </div>

      <div
        style={{
          fontSize: 11,
          color: t.muted,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          fontWeight: 600,
          marginBottom: 8,
        }}
      >
        WMS-provisioned members
      </div>

      <Card t={t} padding={0}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 1.8fr 140px 140px",
            gap: 16,
            padding: "14px 20px",
            fontSize: 11,
            color: t.muted,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          <div>Name</div>
          <div>Email</div>
          <div>Role</div>
          <div>Joined</div>
        </div>
        {(members.data?.length ?? 0) === 0 && (
          <div
            style={{
              padding: "22px",
              borderTop: `1.5px dashed ${t.border}`,
              color: t.muted,
              fontSize: 13,
              textAlign: "center",
            }}
          >
            Nobody yet. Invite someone above — they'll show up here once they sign in.
          </div>
        )}
        {members.data?.map((m) => (
          <div
            key={m.userId}
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1.8fr 140px 140px",
              gap: 16,
              padding: "14px 20px",
              alignItems: "center",
              borderTop: `1.5px dashed ${t.border}`,
              fontSize: 13.5,
              color: t.body,
            }}
          >
            <span style={{ color: t.ink, fontWeight: 600 }}>{m.name ?? "—"}</span>
            <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.muted }}>
              {m.email}
            </span>
            <span>
              <Tag t={t} tone={roleTone(m.role)}>
                {m.role}
              </Tag>
            </span>
            <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.muted }}>
              {m.joinedAt.toLocaleDateString()}
            </span>
          </div>
        ))}
      </Card>
    </div>
  );
}

function roleTone(role: string): TagTone {
  if (role === "admin") return "primary";
  if (role === "manager") return "sky";
  return "neutral";
}
