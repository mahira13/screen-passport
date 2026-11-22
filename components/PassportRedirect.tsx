"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { passportHref } from "@/lib/nav";
import { usePassport } from "@/lib/use-passport";

/** Opens the passport saved in this browser; without one, explains how to start it. */
export function PassportRedirect() {
  const { id } = usePassport();
  const router = useRouter();
  useEffect(() => {
    if (id) router.replace(passportHref(id));
  }, [id, router]);
  if (id) return <p className="label mx-auto max-w-screen-2xl px-4 py-24 text-ink/60 sm:px-8 lg:px-12">Opening your passport…</p>;

  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-accent/10 blur-[120px]" />
      <div className="relative mx-auto w-full max-w-screen-2xl px-4 pb-24 pt-12 sm:px-8 sm:pt-20 lg:px-12">
        <p className="label text-accent">My Passport</p>
        <h1 className="mt-4 max-w-3xl font-serif text-5xl leading-[0.95] tracking-tight sm:text-7xl">
          Your passport is <span className="italic text-accent">still blank.</span>
        </h1>
        <p className="mt-6 max-w-lg text-lg text-ink/75">
          Tap &ldquo;Watched it&rdquo; on a title and your Screen Passport starts filling with stamps. No account needed;
          it stays on this device and gets its own link to share.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/discover#index" className="label inline-flex min-h-11 items-center bg-accent px-5 text-paper transition-colors hover:bg-ink">
            Find titles near me
          </Link>
          <Link href="/collections" className="label inline-flex min-h-11 items-center border border-ink/30 px-5 transition-colors hover:border-accent hover:text-accent">
            Browse collections
          </Link>
        </div>
      </div>
    </section>
  );
}
