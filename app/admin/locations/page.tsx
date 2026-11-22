import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { LocationReviewCard, type ReviewLocation } from "@/components/admin/LocationReviewCard";
import { ImageReviewCard, type ImageRow } from "@/components/admin/ImageReviewCard";
import { FeaturedPins } from "@/components/admin/FeaturedPins";
import { buildCollections } from "@/lib/collections-model";
import { featuredPicks } from "@/lib/featured";
import { LoginForm } from "@/components/admin/LoginForm";
import { VerificationPanel } from "@/components/admin/VerificationPanel";
import { ADMIN_COOKIE, isValidToken } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";
import { TRUSTED_DOMAINS } from "@/lib/trusted-sources";
import { logout } from "./actions";

export const metadata: Metadata = { title: "Review locations", robots: { index: false, follow: false } };

// "Run AI verification" fetches pages, calls Claude and the geocoder: give its server action time.
export const maxDuration = 60;

export default function AdminLocationsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Locations to review</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Check each source, fix the pin, then verify the coordinates and set the location live.
      </p>
      <Suspense fallback={<p className="mt-6 text-sm text-neutral-500">Loading…</p>}>
        <AdminLocations />
      </Suspense>
    </main>
  );
}

async function AdminLocations() {
  // Read the cookie first: it makes this part render per request, not at build time.
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!process.env.ADMIN_PASSWORD) {
    return <p className="mt-6">Admin is switched off. Set ADMIN_PASSWORD to use this page.</p>;
  }
  if (!isValidToken(token)) return <LoginForm />;

  const { data, error } = await supabaseAdmin()
    .from("locations")
    .select("id, name, scene_note, address, city, lat, lng, coord_quality, visit_note, source_name, source_url, geocode_query, verification_status, works(title)")
    .eq("status", "unverified")
    .order("id");
  if (error) return <p className="mt-6 text-red-400">Could not load locations: {error.message}</p>;

  // The latest AI review per place (internal: reasons and evidence quote). Table from migration 008.
  const reviews = await supabaseAdmin()
    .from("location_reviews")
    .select("location_id, decision, reasons, evidence_quote, created_at")
    .in("location_id", data.map((d) => d.id))
    .order("created_at", { ascending: false });
  const latest = new Map<number, ReviewLocation["review"]>();
  for (const r of reviews.data ?? []) if (!latest.has(r.location_id)) latest.set(r.location_id, r);
  const rows = (data as unknown as ReviewLocation[]).map((l) => ({ ...l, review: latest.get(l.id) ?? null }));

  // Photos of published places waiting for a decision (auto-matched ones can still be rejected). From 009.
  const photos = await supabaseAdmin()
    .from("locations")
    .select("id, name, city, image_thumb_url, image_author, image_license, image_source_page, image_status, image_check_reason")
    .eq("verification_status", "published")
    // Waiting for review, auto-matched (can still be rejected), or rejected (ready for "Find another").
    .or("image_status.eq.auto,image_status.eq.rejected,and(image_status.is.null,image_source_page.not.is.null)")
    .order("image_status", { nullsFirst: true })
    .limit(60);
  // Featured: read pins straight from the table (not the cached public data), so changes show at once.
  const [works, locs, cols] = await Promise.all([
    supabaseAdmin().from("works").select("id, title, type, aliases, year"),
    supabaseAdmin().from("catalogue_entries").select("id, work_id, name, city, lat, lng, coord_quality, image_thumb_url, image_source_page"),
    supabaseAdmin().from("collections").select("id, name, city, work_ids, description, featured_rank"),
  ]);
  const featured = !works.error && !locs.error && !cols.error
    ? buildCollections({ works: works.data, locations: locs.data, collections: cols.data } as unknown as Parameters<typeof buildCollections>[0])
    : null;
  return (
    <>
      <VerificationPanel />
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer">Trusted source domains ({TRUSTED_DOMAINS.length}, read-only)</summary>
        <p className="mt-2 text-neutral-600">AI verification can only publish with evidence from these domains (and their subdomains). The list lives in lib/trusted-sources.ts and changes through code review.</p>
        <p className="mt-2 break-words font-mono text-xs">{TRUSTED_DOMAINS.join(" · ")}</p>
      </details>
      {featured ? (
        <FeaturedPins
          rows={featured.filter((c) => c.kind === "curated").map((c) => ({ id: c.slug, name: c.name, rank: c.pinRank, places: c.places.length, checkIn: c.places.filter((p) => p.checkIn).length }))}
          preview={featuredPicks(featured, { from: null, radiusKm: null }).map((c) => c.name)}
        />
      ) : <p className="mt-6 text-sm text-red-500">Featured collections need migrations 009 and 010: {(cols.error ?? locs.error ?? works.error)?.message}</p>}
      <div className="mt-4 flex items-center justify-between text-sm">
        <span>{rows.length === 0 ? "Nothing to review." : `${rows.length} unverified`}</span>
        <form action={logout}>
          <button className="text-neutral-600 underline">Sign out</button>
        </form>
      </div>
      {(photos.data?.length ?? 0) > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Photos to check</h2>
          <ul className="mt-2 grid gap-3 sm:grid-cols-2">
            {(photos.data as ImageRow[]).map((r) => <li key={r.id}><ImageReviewCard row={r} /></li>)}
          </ul>
        </section>
      )}
      <ul className="mt-4 space-y-4">
        {rows.map((l) => (
          <li key={l.id}>
            <LocationReviewCard location={l} />
          </li>
        ))}
      </ul>
    </>
  );
}
