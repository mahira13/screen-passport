"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { legacyHashTarget } from "@/lib/nav";

/** Old links like /#collections: the hash never reaches the server, so forward in the browser. */
export function LegacyHashRedirect() {
  const router = useRouter();
  useEffect(() => {
    const target = legacyHashTarget(window.location.hash);
    if (target) router.replace(target);
  }, [router]);
  return null;
}
