export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Clients
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Your active brands and their daily Reddit opportunities.
        </p>
      </div>

      <div className="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-10 text-center">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          No clients yet. Client management ships in Phase 2.
        </p>
      </div>
    </div>
  );
}
