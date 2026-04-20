"use client";

import { useState } from "react";
import { trpc } from "~/lib/trpc";
import { Card, Input, PageHeader } from "~/components/ui";

export default function InventoryPage() {
  const [code, setCode] = useState("");
  const resolve = trpc.scan.resolve.useQuery({ code }, { enabled: code.length > 3 });

  return (
    <div>
      <PageHeader title="Inventory" />
      <Card>
        <label className="mb-2 block text-sm">
          Scan or paste a code (LPN / location)
        </label>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="P-XXXXXXXXXX or L-XXXXXXXXXX"
          className="w-96"
        />
        <div className="mt-4 rounded-md border border-slate-200 p-4 text-sm">
          {!resolve.data && <span className="text-slate-400">Enter a code...</span>}
          {resolve.data?.kind === "pallet" && resolve.data.pallet && (
            <div>
              <div>
                <b>Pallet:</b> {resolve.data.pallet.lpn}
              </div>
              <div>Status: {resolve.data.pallet.status}</div>
              <div>Location: {resolve.data.pallet.currentLocationId ?? "(unassigned)"}</div>
            </div>
          )}
          {resolve.data?.kind === "location" && resolve.data.location && (
            <div>
              <b>Location:</b> {resolve.data.location.path} ({resolve.data.location.type})
            </div>
          )}
          {resolve.data?.kind === "unknown" && <span>Unknown code</span>}
        </div>
      </Card>
    </div>
  );
}
