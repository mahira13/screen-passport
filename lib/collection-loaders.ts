import { cache } from "react";
import { findCollection, type CollectionKind } from "./collections-model";
import { allCollections } from "./page-data";

export const loadAllCollections = cache(allCollections);
export const loadCollection = cache(async (kind: CollectionKind, slug: string) =>
  findCollection(await loadAllCollections(), kind, decodeURIComponent(slug)));
export const collectionParams = async (kind: CollectionKind, key: "id" | "slug") =>
  (await loadAllCollections()).filter((c) => c.kind === kind).map((c) => ({ [key]: c.slug }));
