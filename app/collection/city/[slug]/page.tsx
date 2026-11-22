import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CollectionView } from "@/components/CollectionView";
import { collectionParams, loadCollection } from "@/lib/collection-loaders";

export const generateStaticParams = () => collectionParams("city", "slug");

export async function generateMetadata(props: PageProps<"/collection/city/[slug]">): Promise<Metadata> {
  const c = await loadCollection("city", (await props.params).slug);
  if (!c) return { title: "Collection · Screen Passport" };
  const description = `${c.places.length} published filming places${c.city ? ` in ${c.city}` : ""}. Visit them and check in on site.`;
  return { title: `${c.name} · Screen Passport`, description, openGraph: { title: c.name, description, siteName: "Screen Passport" } };
}

export default function Page(props: PageProps<"/collection/city/[slug]">) {
  return (
    <main className="w-full pb-16">
      <Suspense fallback={<p className="label px-4 py-16 text-center text-ink/60">Opening…</p>}>
        <View params={props.params} />
      </Suspense>
    </main>
  );
}

async function View({ params }: { params: Promise<{ slug: string }> }) {
  const c = await loadCollection("city", (await params).slug);
  if (!c) notFound();
  return <CollectionView c={c} />;
}
