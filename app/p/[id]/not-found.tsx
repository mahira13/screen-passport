import Link from "next/link";

export default function PassportNotFound() {
  return (
    <main className="mx-auto w-full max-w-screen-2xl px-4 sm:px-8 lg:px-12 pb-20 pt-20 text-center">
      <h1 className="font-serif text-4xl sm:text-5xl">We couldn&apos;t find this passport</h1>
      <p className="mt-2 text-ink/80">Check the link, or start your own in a few taps.</p>
      <Link href="/" className="label mt-8 inline-block bg-accent px-5 py-3.5 text-paper">
        Find filming places near you
      </Link>
    </main>
  );
}
