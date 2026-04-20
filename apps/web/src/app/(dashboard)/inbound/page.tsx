"use client";

import Link from "next/link";
import { trpc } from "~/lib/trpc";
import { buttonClass, PageHeader, Table, Td, Th } from "~/components/ui";

export default function InboundListPage() {
  const list = trpc.inbound.list.useQuery({});

  return (
    <div>
      <PageHeader title="Inbound">
        <Link href="/inbound/new" className={buttonClass}>
          New inbound
        </Link>
      </PageHeader>

      <Table>
        <thead>
          <tr>
            <Th>Reference</Th>
            <Th>Supplier</Th>
            <Th>Status</Th>
            <Th>Expected</Th>
          </tr>
        </thead>
        <tbody>
          {list.data?.map((o) => (
            <tr key={o.id}>
              <Td>
                <Link href={`/inbound/${o.id}`} className="font-medium text-blue-600 hover:underline">
                  {o.reference}
                </Link>
              </Td>
              <Td>{o.supplier ?? ""}</Td>
              <Td>{o.status}</Td>
              <Td>{o.expectedAt?.toLocaleDateString() ?? ""}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
