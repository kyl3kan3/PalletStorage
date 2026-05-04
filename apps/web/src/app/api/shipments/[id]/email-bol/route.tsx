import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, schema } from "@wms/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { renderBolPdf } from "~/lib/render-bol";

/**
 * POST /api/shipments/:id/email-bol — generates the shipment's BOL
 * PDF and emails it via Resend. Body lets the caller override / add
 * recipients; default falls back to the linked customer's email.
 *
 * Required env: RESEND_API_KEY, RESEND_FROM_ADDRESS (a verified
 * sender on your Resend account).
 */
export const runtime = "nodejs";

const bodyShape = z.object({
  to: z.array(z.string().email()).max(10).optional(),
  cc: z.array(z.string().email()).max(10).optional(),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().max(4000).optional(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { userId, orgId: clerkOrgId } = await auth();
  if (!userId || !clerkOrgId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let raw: unknown = {};
  try {
    if (req.headers.get("content-length")) raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = bodyShape.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "invalid body" },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_ADDRESS;
  if (!apiKey || !from) {
    return NextResponse.json(
      {
        error:
          "Email is not configured. Set RESEND_API_KEY and RESEND_FROM_ADDRESS in the environment.",
      },
      { status: 412 },
    );
  }

  const { id } = await ctx.params;

  const [org] = await db
    .select({
      id: schema.organizations.id,
      name: schema.organizations.name,
      billingEmail: schema.organizations.billingEmail,
    })
    .from(schema.organizations)
    .where(eq(schema.organizations.clerkOrgId, clerkOrgId))
    .limit(1);
  if (!org)
    return NextResponse.json({ error: "org not provisioned" }, { status: 400 });

  const result = await renderBolPdf(id, org.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const recipients =
    body.to && body.to.length > 0
      ? body.to
      : result.consigneeEmail
        ? [result.consigneeEmail]
        : [];
  if (recipients.length === 0) {
    return NextResponse.json(
      {
        error:
          "No recipient — pass `to` in the body, or set the customer's email on /customers/[id].",
      },
      { status: 400 },
    );
  }

  const subject =
    body.subject ?? `BOL ${result.bolNumber} — ${result.orgName}`;
  const greeting = result.consigneeName ? `Hi ${result.consigneeName},` : "Hi,";
  const message =
    body.message ??
    `${greeting}\n\nAttached is the Bill of Lading (#${result.bolNumber}) for your recent shipment from ${result.orgName}.\n\nThanks,\n${result.orgName}`;

  const cc = body.cc ?? (org.billingEmail ? [org.billingEmail] : []);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: recipients,
      cc: cc.length > 0 ? cc : undefined,
      subject,
      text: message,
      attachments: [
        {
          filename: `${result.bolNumber}.pdf`,
          content: Buffer.from(result.pdf).toString("base64"),
        },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `Resend returned ${res.status}: ${text.slice(0, 400)}` },
      { status: 502 },
    );
  }
  const payload = (await res.json()) as { id?: string };
  return NextResponse.json({
    sent: true,
    messageId: payload.id ?? null,
    to: recipients,
    cc,
  });
}
