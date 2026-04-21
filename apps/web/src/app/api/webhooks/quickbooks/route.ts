import { NextResponse, type NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db, schema } from "@wms/db";
import { eq } from "drizzle-orm";

/**
 * QuickBooks Online → WMS webhook. Intuit posts one request per realm
 * change; each request carries an `eventNotifications` array that fans
 * out to one-or-many entity changes per realm. We:
 *
 *   1. Verify the `intuit-signature` header against the raw body using
 *      HMAC-SHA256 with the Verifier Token from the Intuit dev dashboard.
 *   2. Resolve each realmId to one of our organizations via the
 *      `quickbooks_connections` row.
 *   3. Persist every entity change to `quickbooks_webhook_events`
 *      so the UI can surface recent activity and we have an audit trail.
 *
 * Configure in Intuit dev dashboard → Webhooks with endpoint:
 *   https://<host>/api/webhooks/quickbooks
 * and copy the generated Verifier Token into QBO_WEBHOOK_VERIFIER_TOKEN.
 *
 * Intuit retries failures up to a limit, so this handler must be
 * idempotent — re-inserting events on retry is fine (we don't dedupe
 * and it's an append-only audit log). A non-2xx response triggers retry.
 */
export async function POST(req: NextRequest) {
  const token = process.env.QBO_WEBHOOK_VERIFIER_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "webhook not configured" }, { status: 500 });
  }

  // Intuit sends the signature as a base64-encoded HMAC-SHA256 of the raw body.
  const sigHeader = req.headers.get("intuit-signature");
  if (!sigHeader) {
    return NextResponse.json({ error: "missing intuit-signature" }, { status: 401 });
  }

  // Read as text so we can HMAC the exact bytes Intuit signed.
  const rawBody = await req.text();
  const expected = createHmac("sha256", token).update(rawBody, "utf8").digest("base64");

  if (!safeEqual(expected, sigHeader)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // Parse after verification so unsigned garbage can't DoS the JSON parser.
  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const notifications = payload.eventNotifications ?? [];
  const rows: Array<typeof schema.quickbooksWebhookEvents.$inferInsert> = [];

  for (const note of notifications) {
    const realmId = note.realmId;
    if (!realmId) continue;

    // Map realmId → our internal org id. A webhook for an unknown realm
    // still gets logged (organizationId=null) so we notice misconfig.
    const [conn] = await db
      .select({ orgId: schema.quickbooksConnections.organizationId })
      .from(schema.quickbooksConnections)
      .where(eq(schema.quickbooksConnections.realmId, realmId))
      .limit(1);

    const entities = note.dataChangeEvent?.entities ?? [];
    for (const e of entities) {
      rows.push({
        organizationId: conn?.orgId ?? null,
        realmId,
        entityName: e.name ?? "Unknown",
        entityId: e.id ?? "",
        operation: e.operation ?? "Unknown",
        lastUpdated: e.lastUpdated ? new Date(e.lastUpdated) : null,
        rawPayload: note as unknown as Record<string, unknown>,
      });
    }
  }

  if (rows.length > 0) {
    await db.insert(schema.quickbooksWebhookEvents).values(rows);
  }

  // Ack quickly. Intuit retries on non-2xx, so don't block on heavy work.
  return NextResponse.json({ received: rows.length });
}

/** Constant-time string compare to resist signature-timing side channels. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// The payload shape per Intuit's docs as of late 2024. We parse
// defensively because Intuit has announced upcoming field additions:
// https://medium.com/intuitdev/upcoming-change-to-webhooks-payload-structure-2a87dab642d0
// Unknown fields flow through untouched into rawPayload for forward-compat.
interface WebhookPayload {
  eventNotifications?: Array<{
    realmId?: string;
    dataChangeEvent?: {
      entities?: Array<{
        name?: string;
        id?: string;
        operation?: string;
        lastUpdated?: string;
      }>;
    };
  }>;
}
