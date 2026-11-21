"use client";

import Link from "next/link";
import { usePassport } from "@/lib/use-passport";

/** Shown only in the browser that created this passport. */
export function YourPassportNote({ passportId }: { passportId: string }) {
  const { id } = usePassport();
  if (id !== passportId) return null;
  return (
    <p className="mt-4 rounded-md bg-surface p-3 text-sm ring-1 ring-ink/10">
      This is your passport. <Link href="/" className="font-semibold underline">Add more titles</Link> on the map.
    </p>
  );
}
