// Cached loaders for the title and location pages (shared by page, metadata and Open Graph image).
import { cache } from "react";
import { locationPage, titlePage } from "./catalogue-pages";
import { getLiveData } from "./live-data";

export const loadTitle = cache(async (id: string) => {
  const data = await getLiveData();
  return titlePage(decodeURIComponent(id), data.works, data.locations);
});

export const loadLocation = cache(async (id: string) => {
  if (!/^\d{1,9}$/.test(id)) return null;
  const data = await getLiveData();
  return locationPage(Number(id), data.works, data.locations);
});

/** Every published title and place, so the pages are prerendered. */
export async function catalogueIds() {
  const data = await getLiveData().catch(() => null);
  return {
    titles: [...new Set(data?.locations.map((l) => l.work_id) ?? [])],
    locations: [...new Set(data?.locations.map((l) => l.id) ?? [])],
  };
}
