"use client";

import { useState } from "react";
import { trpc } from "~/lib/trpc";
import { theme } from "~/lib/theme";
import { Btn } from "./kit";
import { Ic } from "./icons";
import { Modal } from "./modal";
import { FormGrid, Input, HelpText } from "./address-fields";

/**
 * In-form product creator. Opens as a modal when the user clicks
 * "+ New" next to a product dropdown inside an order's item row.
 * On success invalidates the product search cache so the new product
 * shows up immediately and fires the `onCreated` callback with its id
 * so the caller can auto-select it on that row.
 *
 * Minimal fields — name is required, SKU/barcode optional. Full
 * catalog fields (weight, velocity, price) live on /products.
 */
export function NewProductModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const t = theme;
  const utils = trpc.useUtils();
  const create = trpc.product.create.useMutation({
    onSuccess: async (row) => {
      await utils.product.search.invalidate();
      if (row) onCreated(row.id);
      reset();
      onClose();
    },
  });

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");

  function reset() {
    setName("");
    setSku("");
    setBarcode("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate({
      name: name.trim(),
      sku: sku.trim() || undefined,
      barcode: barcode.trim() || undefined,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New product"
      subtitle="Quick add. You can fill in the rest (weight, velocity, price) later from the product page."
    >
      <form
        onSubmit={submit}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div>
          <Input
            label="Product name"
            value={name}
            onChange={setName}
            placeholder="e.g. Bluebird Cold Brew 12oz"
          />
          <HelpText>What this item is called on paperwork.</HelpText>
        </div>
        <FormGrid>
          <Input
            label="SKU"
            value={sku}
            onChange={setSku}
            placeholder="Optional"
          />
          <Input
            label="Barcode"
            value={barcode}
            onChange={setBarcode}
            placeholder="Optional"
          />
        </FormGrid>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Btn
            t={t}
            type="submit"
            variant="accent"
            size="md"
            icon={Ic.Check}
            disabled={!name.trim() || create.isPending}
          >
            {create.isPending ? "Creating…" : "Create & use"}
          </Btn>
          <Btn t={t} type="button" variant="ghost" size="md" onClick={onClose}>
            Cancel
          </Btn>
        </div>
        {create.error && (
          <div style={{ fontSize: 12, color: t.coral }}>{create.error.message}</div>
        )}
      </form>
    </Modal>
  );
}
