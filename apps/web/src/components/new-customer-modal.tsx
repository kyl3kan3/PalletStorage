"use client";

import { useState } from "react";
import { trpc } from "~/lib/trpc";
import { theme } from "~/lib/theme";
import { Btn } from "./kit";
import { Ic } from "./icons";
import { Modal } from "./modal";
import { FormGrid, Input, HelpText } from "./address-fields";

/**
 * In-form customer creator. Opens as a modal when the user clicks
 * "+ New" next to a customer dropdown. On success invalidates the
 * customer search cache so the new customer shows up immediately and
 * fires the `onCreated` callback with its id so the caller can
 * auto-select it.
 *
 * Deliberately minimal — just name + billing address + contact email.
 * Full address / tax id / notes live on /customers/[id] for later.
 */
export function NewCustomerModal({
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
  const create = trpc.customer.create.useMutation({
    onSuccess: (row) => {
      utils.customer.list.invalidate();
      utils.customer.search.invalidate();
      if (row) onCreated(row.id);
      reset();
      onClose();
    },
  });

  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [billingLine1, setBillingLine1] = useState("");
  const [billingCity, setBillingCity] = useState("");
  const [billingRegion, setBillingRegion] = useState("");

  function reset() {
    setName("");
    setContactName("");
    setEmail("");
    setBillingLine1("");
    setBillingCity("");
    setBillingRegion("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate({
      name: name.trim(),
      contactName: contactName.trim() || undefined,
      email: email.trim() || undefined,
      billingLine1: billingLine1.trim() || undefined,
      billingCity: billingCity.trim() || undefined,
      billingRegion: billingRegion.trim() || undefined,
    });
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        onClose();
      }}
      title="New customer"
      subtitle="Quick add. You can fill in the rest (full address, tax ID, notes) later from the customer detail page."
    >
      <form
        onSubmit={submit}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <Input label="Company name" value={name} onChange={setName} placeholder="Bluebird Cafes" />
        <FormGrid>
          <Input
            label="Primary contact"
            value={contactName}
            onChange={setContactName}
            placeholder="Optional"
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="Optional"
          />
        </FormGrid>

        <div>
          <Input
            label="Billing street"
            value={billingLine1}
            onChange={setBillingLine1}
            placeholder="Optional"
          />
          <HelpText>Quick address — just enough for the receipt to look right.</HelpText>
        </div>
        <FormGrid>
          <Input label="City" value={billingCity} onChange={setBillingCity} placeholder="Optional" />
          <Input
            label="State / region"
            value={billingRegion}
            onChange={setBillingRegion}
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
