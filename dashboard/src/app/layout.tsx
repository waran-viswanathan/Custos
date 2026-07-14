import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Custos — Issuer Dashboard',
  description: 'Operate autonomous-wallet verification, issuer policy, revocation, and settlement evidence',
};

const nav = [
  { href: '/', label: 'Overview' },
  { href: '/agents', label: 'Agents' },
  { href: '/policies', label: 'Policies' },
  { href: '/audit', label: 'Audit trail' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto max-w-6xl px-6 py-8">
          <header className="mb-8 flex items-baseline justify-between border-b border-zinc-200 pb-4">
            <div>
              <span className="text-xl font-semibold tracking-tight">Custos</span>
              <span className="ml-3 text-sm text-zinc-500">regulated-asset control console</span>
            </div>
            <nav className="flex gap-5 text-sm">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className="text-zinc-600 hover:text-zinc-900">
                  {n.label}
                </Link>
              ))}
            </nav>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
