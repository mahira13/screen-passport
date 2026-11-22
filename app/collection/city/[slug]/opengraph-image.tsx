import { loadCollection } from "@/lib/collection-loaders";
import { collectionOgImage, OG_SIZE } from "@/lib/collection-og";

export const alt = "A Screen Passport collection of filming places";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  return collectionOgImage(await loadCollection("city", (await params).slug).catch(() => null));
}
