import { NextResponse, type NextRequest } from "next/server";
import { Webhook } from "svix";
import { ensureProvisioned } from "@wms/api";
import { db, schema } from "@wms/db";
import { eq } from "drizzle-orm";

/**
 * Clerk → WMS webhook. Verifies the Svix signature (sent by Clerk) and
 * handles user/org lifecycle events. Complements the request-time
 * provisioning in the tRPC handler by keeping our mirror in sync when
 * users/orgs are updated or deleted out-of-band.
 *
 * Configure in Clerk dashboard → Webhooks with endpoint:
 *   https://<host>/api/webhooks/clerk
 * Enable events: user.created, user.updated, user.deleted,
 *                organization.created, organization.updated, organization.deleted,
 *                organizationMembership.created, organizationMembership.updated,
 *                organizationMembership.deleted
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) return NextResponse.json({ error: "webhook not configured" }, { status: 500 });

  const id = req.headers.get("svix-id");
  const timestamp = req.headers.get("svix-timestamp");
  const signature = req.headers.get("svix-signature");
  if (!id || !timestamp || !signature) return NextResponse.json({ error: "missing svix headers" }, { status: 400 });

  const payload = await req.text();
  let event: ClerkEvent;
  try {
    event = new Webhook(secret).verify(payload, {
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": signature,
    }) as ClerkEvent;
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  switch (event.type) {
    case "user.created":
    case "user.updated":
      await ensureProvisioned(db, {
        userId: event.data.id,
        email: event.data.email_addresses?.[0]?.email_address ?? null,
        name: [event.data.first_name, event.data.last_name].filter(Boolean).join(" ") || null,
        orgId: null,
        orgName: null,
        role: null,
      });
      break;

    case "user.deleted":
      await db.delete(schema.users).where(eq(schema.users.clerkUserId, event.data.id));
      break;

    case "organization.created":
    case "organization.updated":
      await db
        .insert(schema.organizations)
        .values({ clerkOrgId: event.data.id, name: event.data.name })
        .onConflictDoUpdate({
          target: schema.organizations.clerkOrgId,
          set: { name: event.data.name },
        });
      break;

    case "organization.deleted":
      await db.delete(schema.organizations).where(eq(schema.organizations.clerkOrgId, event.data.id));
      break;

    case "organizationMembership.created":
    case "organizationMembership.updated":
      await ensureProvisioned(db, {
        userId: event.data.public_user_data.user_id,
        email: event.data.public_user_data.identifier ?? null,
        name:
          [event.data.public_user_data.first_name, event.data.public_user_data.last_name]
            .filter(Boolean)
            .join(" ") || null,
        orgId: event.data.organization.id,
        orgName: event.data.organization.name,
        role: mapRole(event.data.role),
      });
      break;

    case "organizationMembership.deleted": {
      const [org] = await db
        .select({ id: schema.organizations.id })
        .from(schema.organizations)
        .where(eq(schema.organizations.clerkOrgId, event.data.organization.id))
        .limit(1);
      const [user] = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.clerkUserId, event.data.public_user_data.user_id))
        .limit(1);
      if (org && user) {
        await db
          .delete(schema.memberships)
          .where(eq(schema.memberships.organizationId, org.id));
      }
      break;
    }
  }

  return NextResponse.json({ ok: true });
}

function mapRole(role: string | undefined | null): "admin" | "manager" | "operator" {
  if (role === "org:admin" || role === "admin") return "admin";
  if (role === "org:manager" || role === "manager") return "manager";
  return "operator";
}

type ClerkEvent =
  | { type: "user.created" | "user.updated"; data: { id: string; email_addresses?: Array<{ email_address: string }>; first_name?: string | null; last_name?: string | null } }
  | { type: "user.deleted"; data: { id: string } }
  | { type: "organization.created" | "organization.updated"; data: { id: string; name: string } }
  | { type: "organization.deleted"; data: { id: string } }
  | {
      type: "organizationMembership.created" | "organizationMembership.updated";
      data: {
        role: string;
        organization: { id: string; name: string };
        public_user_data: {
          user_id: string;
          identifier?: string;
          first_name?: string | null;
          last_name?: string | null;
        };
      };
    }
  | {
      type: "organizationMembership.deleted";
      data: {
        organization: { id: string };
        public_user_data: { user_id: string };
      };
    };
