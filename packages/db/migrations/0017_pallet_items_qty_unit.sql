-- Receiving "2 cases" of SKU X is otherwise indistinguishable from
-- "2 eaches" once it lands on a pallet — the line's qty_unit was
-- captured at order-create time but lost at receive. Carry it onto
-- the pallet_items row so billing + outbound picks compute against
-- the correct unit. Default 'each' preserves the meaning of pre-
-- existing rows (which were all written without unit context).

ALTER TABLE "pallet_items"
  ADD COLUMN IF NOT EXISTS "qty_unit" "qty_unit" NOT NULL DEFAULT 'each';

-- Backfill from the source inbound_line where we can identify it via
-- the receive movement. Movements with reason='receive' point to the
-- inbound_line via ref_id; that line carries the canonical qty_unit.
-- Rows we can't trace fall through with the default 'each'.
UPDATE "pallet_items" pi
SET "qty_unit" = il.qty_unit
FROM "movements" m
JOIN "inbound_lines" il ON il.id = m.ref_id
WHERE m.reason = 'receive'
  AND m.ref_type = 'inbound_line'
  AND m.pallet_id = pi.pallet_id
  AND pi.product_id = il.product_id
  AND pi.qty_unit = 'each';
