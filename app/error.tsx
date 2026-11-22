"use client";

import Link from "next/link";
import { useEffect } from "react";

// Any page that fails to render: say so plainly and offer a way forward.
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <main className="mx-auto w-full max-w-screen-2xl px-4 pb-20 pt-20 text-center sm:px-8 lg:px-12">
      <h1 className="font-serif text-4xl sm:text-5xl">This page didn&apos;t load</h1>
      <p className="mt-2 text-ink/80">It may be a connection problem on either side. Your passport is safe on this phone.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="label min-h-11 bg-accent px-5 py-3.5 text-paper">Try again</button>
        <Link href="/discover" className="label min-h-11 border border-accent px-5 py-3.5 text-accent">Find filming places</Link>
      </div>
    </main>
  );
}
