"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-200">Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700 dark:text-neutral-200">Password</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </label>

      {state.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
