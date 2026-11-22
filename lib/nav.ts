// Main navigation: Discover · Collections · Map · My Passport.

export type NavKey = "discover" | "collections" | "map" | "passport";

export const NAV: { key: NavKey; label: string; href: string }[] = [
  { key: "discover", label: "Discover", href: "/discover" },
  { key: "collections", label: "Collections", href: "/collections" },
  { key: "map", label: "Map", href: "/map" },
  { key: "passport", label: "My Passport", href: "/passport" },
];

/** Which nav item a path belongs to (null on home, trips, legal pages). */
export function activeNav(pathname: string): NavKey | null {
  const first = pathname.split("/")[1] ?? "";
  if (first === "discover" || first === "collections" || first === "map") return first;
  if (first === "passport" || first === "p") return "passport";
  return null;
}

/** The passport link: the saved passport if there is one. */
export const passportHref = (id: string | null) => (id ? `/p/${encodeURIComponent(id)}` : "/passport");

// The home page used to hold everything; old links and shares point at its sections.
const LEGACY: Record<string, string> = {
  "#discover": "/discover",
  "#index": "/discover#index",
  "#collections": "/collections",
};

/** Where an old home-page anchor now lives, or null. */
export const legacyHashTarget = (hash: string): string | null => LEGACY[hash] ?? null;
