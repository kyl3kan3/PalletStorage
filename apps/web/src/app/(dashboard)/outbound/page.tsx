"use client";

import Link from "next/link";
import { trpc } from "~/lib/trpc";
import { buttonClass, PageHeader, Table, Td, Th } from "~/components/ui";

export default function OutboundListPage() {
  const list = trpc.outbound.list.useQuery({});

  return (
    <div>
      <PageHeader title="Outbound">
        <Link href="/outbound/new" className={buttonClass}>
          New order
        </Link>
      </PageHeader>

      <Table>
        <thead>
          <tr>
            <Th>Reference</Th>
            <Th>Customer</Th>
            <Th>Status</Th>
            <Th>Ship by</Th>
          </tr>
        </thead>
        <tbody>
          {list.data?.map((o) => (
            <tr key={o.id}>
              <Td>
                <Link href={`/outbound/${o.id}`} className="font-medium text-blue-600 hover:underline">
                  {o.reference}
                </Link>
              </Td>
              <Td>{o.customer ?? ""}</Td>
              <Td>{o.status}</Td>
              <Td>{o.shipBy?.toLocaleDateString() ?? ""}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
