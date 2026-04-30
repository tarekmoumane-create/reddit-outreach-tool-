import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { NavLink } from "./nav-link";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? "operator";

  return (
    <div className="relative flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3.5 sm:px-8">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <span className="logo-mark" aria-hidden />
              <span className="text-[15px] font-semibold tracking-tight text-text">
                Reddit Outreach
              </span>
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              <NavLink href="/dashboard/clients">Clients</NavLink>
              <NavLink href="/dashboard/opportunities">Opportunities</NavLink>
              <NavLink href="/dashboard/seed-posts">Seed posts</NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-[12px] text-text-dim md:inline">
              {email}
            </span>
            <form action="/auth/sign-out" method="post">
              <button type="submit" className="btn-secondary">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 px-6 pb-24 pt-10 sm:px-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
