"use client";

import { deleteClientAction } from "./actions";

export function DeleteClientForm({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deleteClientAction}
      onSubmit={(e) => {
        if (
          !confirm(
            `Delete "${name}"? This removes all its opportunities and run history.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-1.5 text-[13px] font-medium text-danger transition hover:border-danger/50 hover:bg-danger/10"
      >
        Delete client
      </button>
    </form>
  );
}
