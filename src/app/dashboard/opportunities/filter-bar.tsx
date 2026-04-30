"use client";

import { usePathname, useRouter } from "next/navigation";

export function FilterBar({
  clients,
  currentClientId,
}: {
  clients: Array<{ id: string; name: string }>;
  currentClientId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function go(id: string) {
    const qs = id ? `?client_id=${encodeURIComponent(id)}` : "";
    router.push(`${pathname}${qs}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Choice active={!currentClientId} onClick={() => go("")}>
        All
      </Choice>
      {clients.map((c) => (
        <Choice
          key={c.id}
          active={currentClientId === c.id}
          onClick={() => go(c.id)}
        >
          {c.name}
        </Choice>
      ))}
    </div>
  );
}

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1 text-[12px] font-medium transition ${
        active
          ? "border-accent-strong bg-accent-soft text-accent"
          : "border-border bg-surface text-text-muted hover:border-border-strong hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}
