"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

/** Counts one page view (page type and id only). Renders nothing. */
export function TrackView({ page, id }: { page: string; id: string }) {
  useEffect(() => track("page_viewed", { page, id }), [page, id]);
  return null;
}
