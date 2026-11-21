"use client";

import { useActionState } from "react";
import { login } from "@/app/admin/locations/actions";

export function LoginForm() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="mt-6 flex max-w-sm flex-col gap-3">
      <label className="text-sm font-medium" htmlFor="password">Admin password</label>
      <input id="password" name="password" type="password" required autoComplete="current-password"
        className="rounded border border-neutral-300 px-3 py-2" />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button disabled={pending} className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50">
        {pending ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}
