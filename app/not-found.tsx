import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-screen-2xl px-4 pb-20 pt-20 text-center sm:px-8 lg:px-12">
      <h1 className="font-serif text-4xl sm:text-5xl">We couldn&apos;t find that page</h1>
      <p className="mt-2 text-ink/80">The link may be old, or the place is being checked again.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/discover" className="label min-h-11 bg-accent px-5 py-3.5 text-paper">Find filming places</Link>
        <Link href="/collections" className="label min-h-11 border border-accent px-5 py-3.5 text-accent">Browse collections</Link>
      </div>
    </main>
  );
}
