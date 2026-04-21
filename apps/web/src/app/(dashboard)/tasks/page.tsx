"use client";

import Link from "next/link";
import { trpc } from "~/lib/trpc";
import { theme, FONTS } from "~/lib/theme";
import { Btn, Card, PageTitle, SquircleIcon, Tag } from "~/components/kit";
import { Ic } from "~/components/icons";

/**
 * Task inbox — a single place an operator can see what's been assigned
 * to them. Managers also see a "Backlog" section with unassigned picks
 * and cycle counts they can hand out via a quick dropdown.
 */
export default function TasksPage() {
  const t = theme;
  const mine = trpc.task.listMine.useQuery();
  const backlog = trpc.task.backlog.useQuery(undefined, { retry: false });
  const members = trpc.organization.members.useQuery();
  const utils = trpc.useUtils();
  const assignPick = trpc.task.assignPick.useMutation({
    onSuccess: () => {
      utils.task.backlog.invalidate();
      utils.task.listMine.invalidate();
    },
  });
  const assignCount = trpc.task.assignCycleCount.useMutation({
    onSuccess: () => {
      utils.task.backlog.invalidate();
      utils.task.listMine.invalidate();
    },
  });

  // backlog only succeeds for managers+; if it 403s we're operator-only.
  const isManager = !backlog.error;

  return (
    <div>
      <PageTitle
        eyebrow="What's on your plate"
        title="Tasks"
        subtitle="Picks and cycle counts assigned to you. Managers can delegate from the backlog below."
      />

      <MineSection t={t} mine={mine.data} />

      {isManager && (
        <div style={{ marginTop: 28 }}>
          <BacklogSection
            t={t}
            backlog={backlog.data}
            members={members.data ?? []}
            onAssignPick={(pickId, userId) => assignPick.mutate({ pickId, userId })}
            onAssignCount={(cycleCountId, userId) =>
              assignCount.mutate({ cycleCountId, userId })
            }
          />
        </div>
      )}
    </div>
  );
}

function MineSection({
  t,
  mine,
}: {
  t: typeof theme;
  mine: { picks: MyPick[]; counts: MyCount[] } | undefined;
}) {
  const picks = mine?.picks ?? [];
  const counts = mine?.counts ?? [];
  const total = picks.length + counts.length;

  return (
    <div>
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
        Assigned to you {total > 0 && <span style={{ color: t.primaryDeep }}>· {total}</span>}
      </div>

      {total === 0 && (
        <Card t={t} tint="alt">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <SquircleIcon t={t} icon={Ic.Check} tint="mint" size={44} />
            <div style={{ fontSize: 14, color: t.muted }}>
              Inbox zero. Nothing assigned to you right now.
            </div>
          </div>
        </Card>
      )}

      {picks.length > 0 && (
        <Card t={t} padding={0}>
          <Header t={t} title="Picks">
            <Ic.Outbound size={16} color={t.muted} />
          </Header>
          <HeaderRow t={t}>
            <div style={{ width: 40 }}>Seq</div>
            <div style={{ flex: 1 }}>Order / location</div>
            <div style={{ width: 60, textAlign: "right" }}>Qty</div>
            <div style={{ width: 24 }} />
          </HeaderRow>
          {picks.map((p) => (
            <Link
              key={p.id}
              href={`/outbound/${p.orderId}`}
              style={{
                display: "flex",
                gap: 12,
                padding: "12px 20px",
                alignItems: "center",
                borderTop: `1.5px dashed ${t.border}`,
                textDecoration: "none",
                color: t.body,
              }}
            >
              <span style={{ width: 40, fontFamily: FONTS.mono, fontSize: 12, color: t.muted }}>
                #{p.sequence}
              </span>
              <span style={{ flex: 1 }}>
                <div style={{ color: t.ink, fontWeight: 600, fontFamily: FONTS.mono, fontSize: 13 }}>
                  {p.orderReference}
                </div>
                <div style={{ fontSize: 12, color: t.muted }}>
                  {p.locationPath ?? "unassigned"}
                  {p.orderCustomer ? ` · ${p.orderCustomer}` : ""}
                </div>
              </span>
              <span
                style={{
                  width: 60,
                  textAlign: "right",
                  fontFamily: FONTS.mono,
                  fontWeight: 600,
                  color: t.ink,
                }}
              >
                {p.qty}
              </span>
              <Ic.Arrow size={14} color={t.muted} />
            </Link>
          ))}
        </Card>
      )}

      {counts.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <Card t={t} padding={0}>
            <Header t={t} title="Cycle counts">
              <Ic.Clipboard size={16} color={t.muted} />
            </Header>
            <HeaderRow t={t}>
              <div style={{ flex: 1 }}>Location</div>
              <div style={{ width: 120 }}>Status</div>
              <div style={{ width: 120 }}>Due</div>
              <div style={{ width: 24 }} />
            </HeaderRow>
            {counts.map((c) => (
              <Link
                key={c.id}
                href={`/inventory/counts/${c.id}`}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "12px 20px",
                  alignItems: "center",
                  borderTop: `1.5px dashed ${t.border}`,
                  textDecoration: "none",
                  color: t.body,
                }}
              >
                <span style={{ flex: 1 }}>{c.locationPath ?? c.id.slice(0, 8)}</span>
                <span style={{ width: 120 }}>
                  <Tag t={t} tone={c.status === "counting" ? "primary" : "sky"}>
                    {c.status}
                  </Tag>
                </span>
                <span
                  style={{
                    width: 120,
                    fontFamily: FONTS.mono,
                    fontSize: 12,
                    color: t.muted,
                  }}
                >
                  {c.dueAt?.toLocaleDateString() ?? "—"}
                </span>
                <Ic.Arrow size={14} color={t.muted} />
              </Link>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}

function BacklogSection({
  t,
  backlog,
  members,
  onAssignPick,
  onAssignCount,
}: {
  t: typeof theme;
  backlog: { picks: BacklogPick[]; counts: BacklogCount[] } | undefined;
  members: Array<{ userId: string; name: string | null; email: string; role: string }>;
  onAssignPick: (pickId: string, userId: string) => void;
  onAssignCount: (cycleCountId: string, userId: string) => void;
}) {
  const picks = backlog?.picks ?? [];
  const counts = backlog?.counts ?? [];

  return (
    <div>
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
        Backlog · delegate
      </div>

      {picks.length + counts.length === 0 && (
        <Card t={t} tint="alt">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <SquircleIcon t={t} icon={Ic.Spark} tint="mint" size={44} />
            <div style={{ fontSize: 14, color: t.muted }}>
              Nothing waiting to be assigned — good job.
            </div>
          </div>
        </Card>
      )}

      {picks.length > 0 && (
        <Card t={t} padding={0}>
          <Header t={t} title="Unassigned picks" />
          {picks.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                gap: 12,
                padding: "12px 20px",
                alignItems: "center",
                borderTop: `1.5px dashed ${t.border}`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: t.ink, fontWeight: 600, fontFamily: FONTS.mono, fontSize: 13 }}>
                  {p.orderReference}
                </div>
                <div style={{ fontSize: 12, color: t.muted }}>
                  {p.locationPath ?? "no location"} · qty {p.qty}
                </div>
              </div>
              <AssigneeSelect
                members={members}
                onChange={(userId) => onAssignPick(p.id, userId)}
              />
              <Link
                href={`/outbound/${p.orderId}`}
                style={{ color: t.primaryDeep, fontWeight: 600, textDecoration: "none", fontSize: 13 }}
              >
                Open →
              </Link>
            </div>
          ))}
        </Card>
      )}

      {counts.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <Card t={t} padding={0}>
            <Header t={t} title="Unassigned cycle counts" />
            {counts.map((c) => (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "12px 20px",
                  alignItems: "center",
                  borderTop: `1.5px dashed ${t.border}`,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ color: t.ink, fontWeight: 600 }}>
                    {c.locationPath ?? c.id.slice(0, 8)}
                  </div>
                  <div style={{ fontSize: 12, color: t.muted }}>
                    Status {c.status}
                    {c.dueAt ? ` · due ${c.dueAt.toLocaleDateString()}` : ""}
                  </div>
                </div>
                <AssigneeSelect
                  members={members}
                  onChange={(userId) => onAssignCount(c.id, userId)}
                />
                <Link
                  href={`/inventory/counts/${c.id}`}
                  style={{ color: t.primaryDeep, fontWeight: 600, textDecoration: "none", fontSize: 13 }}
                >
                  Open →
                </Link>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}

function Header({
  t,
  title,
  children,
}: {
  t: typeof theme;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "14px 20px 6px",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {children}
      <div style={{ fontWeight: 600, color: t.ink }}>{title}</div>
    </div>
  );
}

function HeaderRow({ t, children }: { t: typeof theme; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: "6px 20px 10px",
        fontSize: 11,
        color: t.muted,
        letterSpacing: 0.4,
        textTransform: "uppercase",
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );
}

function AssigneeSelect({
  members,
  onChange,
}: {
  members: Array<{ userId: string; name: string | null; email: string }>;
  onChange: (userId: string) => void;
}) {
  const t = theme;
  return (
    <select
      defaultValue=""
      onChange={(e) => {
        const v = e.target.value;
        if (!v) return;
        onChange(v);
        e.currentTarget.value = "";
      }}
      style={{
        padding: "7px 10px",
        borderRadius: 10,
        background: t.surfaceAlt,
        border: `1.5px solid ${t.border}`,
        outline: "none",
        fontFamily: FONTS.sans,
        fontSize: 12.5,
        color: t.ink,
        cursor: "pointer",
      }}
    >
      <option value="">Assign to…</option>
      {members.map((m) => (
        <option key={m.userId} value={m.userId}>
          {m.name ?? m.email}
        </option>
      ))}
    </select>
  );
}

interface MyPick {
  id: string;
  qty: number;
  sequence: number;
  completedAt: Date | null;
  locationPath: string | null;
  orderReference: string;
  orderCustomer: string | null;
  orderId: string;
}
interface MyCount {
  id: string;
  status: string;
  dueAt: Date | null;
  locationPath: string | null;
}
interface BacklogPick {
  id: string;
  qty: number;
  sequence: number;
  locationPath: string | null;
  orderReference: string;
  orderId: string;
}
interface BacklogCount {
  id: string;
  status: string;
  dueAt: Date | null;
  locationPath: string | null;
}
