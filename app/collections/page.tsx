import type { Metadata } from "next";
import Link from "next/link";
import { CollectionChallenges } from "@/components/CollectionChallenges";
import { collectionsData } from "@/lib/page-data";

export const metadata: Metadata = { title: "Collections · Screen Passport" };

export default async function CollectionsPage() {
  const collections = await collectionsData();
  return (
    <main className="w-full">
      <CollectionChallenges collections={collections} />
      {collections.length === 0 && (
        <div className="mx-auto w-full max-w-screen-2xl px-4 py-24 sm:px-8 lg:px-12">
          <p className="font-serif text-3xl italic text-ink/70">
            Collections are on their way. We&apos;re checking the sources for every place first.
          </p>
          <Link href="/discover" className="label mt-6 inline-flex min-h-11 items-center bg-accent px-5 py-3 text-paper">
            Find filming places near you
          </Link>
        </div>
      )}
    </main>
  );
}
