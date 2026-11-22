import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { CollectionView } from "@/components/CollectionView";
import { collectionParams, loadCollection } from "@/lib/collection-loaders";
import { curatedFor } from "@/lib/collections-model";
import { getLiveData } from "@/lib/live-data";

export const generateStaticParams = () => collectionParams("title", "slug");

export async function generateMetadata(props: PageProps<"/collection/title/[slug]">): Promise<Metadata> {
  const c = await loadCollection("title", (await props.params).slug);
  if (!c) return { title: "Collection · Screen Passport" };
  const description = `${c.places.length} published filming places${c.city ? ` in ${c.city}` : ""}. Visit them and check in on site.`;
  return { title: `${c.name} · Screen Passport`, description, openGraph: { title: c.name, description, siteName: "Screen Passport" } };
}

export default function Page(props: PageProps<"/collection/title/[slug]">) {
  return (
    <main className="w-full pb-16">
      <Suspense fallback={<p className="label px-4 py-16 text-center text-ink/60">Opening…</p>}>
        <View params={props.params} />
      </Suspense>
    </main>
  );
}

async function View({ params }: { params: Promise<{ slug: string }> }) {
  const slug = decodeURIComponent((await params).slug);
  const c = await loadCollection("title", slug);
  if (!c) {
    // Replaced by a curated collection of the same title: old links still land on it.
    const curated = curatedFor((await getLiveData()).collections, slug);
    if (curated) redirect(`/collection/${encodeURIComponent(curated.id)}`);
    notFound();
  }
  return <CollectionView c={c} />;
}
