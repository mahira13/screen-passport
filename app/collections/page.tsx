import type { Metadata } from "next";
import { CollectionChallenges } from "@/components/CollectionChallenges";
import { collectionsData } from "@/lib/page-data";

export const metadata: Metadata = { title: "Collections · Screen Passport" };

export default async function CollectionsPage() {
  const collections = await collectionsData();
  return (
    <main className="w-full">
      <CollectionChallenges collections={collections} />
      {collections.every((c) => c.works.length === 0) && (
        <p className="mx-auto w-full max-w-screen-2xl px-4 py-24 font-serif text-3xl italic text-ink/70 sm:px-8 lg:px-12">
          Collections are on their way. We&apos;re checking the sources for every place first.
        </p>
      )}
    </main>
  );
}
