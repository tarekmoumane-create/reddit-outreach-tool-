import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") ? next : "/dashboard";

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="entry w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="logo-mark" aria-hidden />
          <span className="text-[15px] font-semibold tracking-tight text-text">
            Reddit Outreach
          </span>
        </div>
        <div className="card px-6 py-6">
          <h1 className="text-[20px] font-semibold tracking-tight text-text">
            Sign in
          </h1>
          <p className="mt-1 text-[13px] text-text-muted">
            Operator access only. Accounts are created in Supabase.
          </p>
          <div className="mt-6">
            <LoginForm next={safeNext} />
          </div>
        </div>
      </div>
    </main>
  );
}
