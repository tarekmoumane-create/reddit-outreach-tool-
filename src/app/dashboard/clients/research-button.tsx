"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResearchButton({
  clientId,
  hasProfile,
}: {
  clientId: string;
  hasProfile: boolean;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/research`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? res.statusText);
      } else {
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={go}
        disabled={running}
        className={hasProfile ? "btn-secondary" : "btn-primary"}
      >
        {running ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
            </span>
            Researching
          </>
        ) : hasProfile ? (
          <>
            <span className="text-[14px] leading-none">↻</span>
            Re-run research
          </>
        ) : (
          <>
            <span className="text-[14px] leading-none">▶</span>
            Run research
          </>
        )}
      </button>
      {error ? (
        <span className="font-mono text-[12px] text-danger">{error}</span>
      ) : null}
    </div>
  );
}
