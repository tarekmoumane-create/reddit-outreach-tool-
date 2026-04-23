import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Proxy protects this route; this is defence in depth.
  const email = user?.email ?? "Operator";

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/dashboard" className="font-semibold text-neutral-900 dark:text-neutral-100">
            Reddit Outreach
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-neutral-600 dark:text-neutral-400">{email}</span>
            <form action="/auth/sign-out" method="post">
              <button
                type="submit"
                className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
