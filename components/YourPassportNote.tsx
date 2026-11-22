"use client";

import Link from "next/link";
import { usePassport } from "@/lib/use-passport";

/** Shown only in the browser that created this passport. */
export function YourPassportNote({ passportId }: { passportId: string }) {
  const { id } = usePassport();
  if (id !== passportId) return null;
  return (
    <p className="mt-5 border-l-2 border-accent pl-3 text-sm text-ink/75">
      This is your passport. <Link href="/discover#index" className="font-semibold text-accent underline-offset-4 hover:underline">Add more titles</Link> from the index.
    </p>
  );
}
