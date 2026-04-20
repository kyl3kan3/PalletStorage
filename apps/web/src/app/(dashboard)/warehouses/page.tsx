"use client";

import { useState } from "react";
import { trpc } from "~/lib/trpc";
import { Button, Card, Input, PageHeader, Table, Td, Th } from "~/components/ui";

export default function WarehousesPage() {
  const utils = trpc.useUtils();
  const list = trpc.warehouse.list.useQuery();
  const create = trpc.warehouse.create.useMutation({
    onSuccess: () => utils.warehouse.list.invalidate(),
  });

  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  return (
    <div>
      <PageHeader title="Warehouses" />

      <Card>
        <form
          className="flex items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({ code, name, timezone: "UTC" });
            setCode("");
            setName("");
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Code</span>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="WH1" required />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Main DC" required />
          </label>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Creating..." : "Create"}
          </Button>
        </form>
      </Card>

      <div className="mt-6">
        <Table>
          <thead>
            <tr>
              <Th>Code</Th>
              <Th>Name</Th>
              <Th>Timezone</Th>
            </tr>
          </thead>
          <tbody>
            {list.data?.map((w) => (
              <tr key={w.id}>
                <Td>{w.code}</Td>
                <Td>{w.name}</Td>
                <Td>{w.timezone}</Td>
              </tr>
            ))}
            {list.data && list.data.length === 0 && (
              <tr>
                <Td>
                  <span className="text-slate-400">No warehouses yet</span>
                </Td>
                <Td>{""}</Td>
                <Td>{""}</Td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
