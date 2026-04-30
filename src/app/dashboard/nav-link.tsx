"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`relative rounded-md px-3 py-1.5 text-[13px] font-medium transition ${
        active ? "text-text" : "text-text-muted hover:text-text"
      }`}
    >
      {children}
      {active ? (
        <span className="absolute inset-x-3 -bottom-[15px] h-[2px] bg-accent" />
      ) : null}
    </Link>
  );
}
