"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <label className="flex flex-col gap-1.5">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-text-dim">
          Email
        </span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
          className="input"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-text-dim">
          Password
        </span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="input"
        />
      </label>

      {state.error ? (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="btn-primary mt-2 justify-center"
      >
        {pending ? "Signing in" : "Sign in"}
      </button>
    </form>
  );
}
