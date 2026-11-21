import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { LocationReviewCard, type ReviewLocation } from "@/components/admin/LocationReviewCard";
import { LoginForm } from "@/components/admin/LoginForm";
import { ADMIN_COOKIE, isValidToken } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";
import { logout } from "./actions";

export const metadata: Metadata = { title: "Review locations", robots: { index: false, follow: false } };

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
    .select("id, name, scene_note, address, city, lat, lng, coord_quality, visit_note, source_name, source_url, geocode_query, works(title)")
    .eq("status", "unverified")
    .order("id");
  if (error) return <p className="mt-6 text-red-700">Could not load locations: {error.message}</p>;

  const rows = data as unknown as ReviewLocation[];
  return (
    <>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span>{rows.length === 0 ? "Nothing to review." : `${rows.length} unverified`}</span>
        <form action={logout}>
          <button className="text-neutral-600 underline">Sign out</button>
        </form>
      </div>
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
