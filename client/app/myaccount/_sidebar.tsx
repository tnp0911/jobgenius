"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ACCOUNT_TABS = [
  { label: "My Account", href: "/myaccount" },
  { label: "Resume History", href: "/myaccount/history" }
] as const;

function isTabActive(pathname: string, href: string) {
  if (href === "/myaccount") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AccountSidebar() {
  const pathname = usePathname();

  return (
    <aside className="account-sidebar">
      <p className="account-sidebar-kicker">Account</p>
      <nav className="account-sidebar-nav" aria-label="Account sections">
        {ACCOUNT_TABS.map(({ label, href }) => {
          const active = isTabActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`account-sidebar-link${active ? " is-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
