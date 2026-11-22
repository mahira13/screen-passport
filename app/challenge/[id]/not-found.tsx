import Link from "next/link";

export default function ChallengeNotFound() {
  return (
    <main className="mx-auto w-full max-w-screen-md px-4 pb-20 pt-20 text-center">
      <h1 className="font-serif text-4xl sm:text-5xl">We couldn&apos;t find this challenge</h1>
      <p className="mt-2 text-ink/80">Check the link, or start your own from any collection.</p>
      <Link href="/collections" className="label mt-8 inline-flex min-h-11 items-center bg-accent px-5 text-paper">Browse collections</Link>
    </main>
  );
}
