import Link from "next/link";
import { SignedIn, UserButton, OrganizationSwitcher } from "@clerk/nextjs";

const nav = [
  { href: "/warehouses", label: "Warehouses" },
  { href: "/inventory", label: "Inventory" },
  { href: "/products", label: "Products" },
  { href: "/inbound", label: "Inbound" },
  { href: "/outbound", label: "Outbound" },
  { href: "/reports", label: "Reports" },
  { href: "/settings/integrations", label: "Settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r border-slate-200 bg-white p-4">
        <Link href="/" className="mb-6 block text-xl font-bold">
          WMS
        </Link>
        <nav className="flex flex-col gap-1 text-sm">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href as never}
              className="rounded px-2 py-1.5 hover:bg-slate-100"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <OrganizationSwitcher hidePersonal appearance={{ elements: { rootBox: "flex" } }} />
          <SignedIn>
            <UserButton />
          </SignedIn>
        </header>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
