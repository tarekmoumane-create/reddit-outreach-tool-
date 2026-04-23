import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") ? next : "/dashboard";

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            Operator sign in
          </h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Accounts are created by an admin in Supabase. No public signup.
          </p>
        </div>
        <LoginForm next={safeNext} />
      </div>
    </main>
  );
}
