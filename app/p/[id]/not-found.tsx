import Link from "next/link";

export default function PassportNotFound() {
  return (
    <main className="mx-auto w-full max-w-screen-2xl px-4 sm:px-8 lg:px-12 pt-16 text-center">
      <h1 className="font-display text-2xl font-bold">We couldn&apos;t find this passport</h1>
      <p className="mt-2 text-ink/80">Check the link, or start your own in a few taps.</p>
      <Link href="/" className="mt-6 inline-block rounded bg-ink px-5 py-3 font-semibold text-paper">
        Find filming places near you
      </Link>
    </main>
  );
}
