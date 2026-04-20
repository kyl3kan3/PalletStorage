"use client";

import Link from "next/link";
import { trpc } from "~/lib/trpc";
import { PageHeader, Table, Td, Th } from "~/components/ui";

export default function CycleCountsPage() {
  const list = trpc.cycleCount.listOpen.useQuery();

  return (
    <div>
      <PageHeader title="Cycle counts" />
      <Table>
        <thead>
          <tr>
            <Th>Count</Th>
            <Th>Status</Th>
            <Th>Due</Th>
            <Th>Submitted</Th>
          </tr>
        </thead>
        <tbody>
          {list.data?.map((c) => (
            <tr key={c.id}>
              <Td>
                <Link
                  href={`/inventory/counts/${c.id}`}
                  className="font-medium text-blue-600 hover:underline"
                >
                  {c.id.slice(0, 8)}
                </Link>
              </Td>
              <Td>{c.status}</Td>
              <Td>{c.dueAt?.toLocaleDateString() ?? ""}</Td>
              <Td>{c.submittedAt?.toLocaleDateString() ?? ""}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
