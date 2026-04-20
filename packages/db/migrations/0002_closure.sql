-- Inbound closure metadata: who closed it, when, and (for short-close) why.
ALTER TABLE "inbound_orders" ADD COLUMN "closed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "inbound_orders" ADD COLUMN "closed_by_user_id" uuid REFERENCES "users"("id");
--> statement-breakpoint
ALTER TABLE "inbound_orders" ADD COLUMN "close_reason" text;
--> statement-breakpoint

-- Outbound lifecycle timestamps: packed/cancelled, plus cancel reason.
ALTER TABLE "outbound_orders" ADD COLUMN "packed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "outbound_orders" ADD COLUMN "cancelled_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "outbound_orders" ADD COLUMN "cancel_reason" text;
