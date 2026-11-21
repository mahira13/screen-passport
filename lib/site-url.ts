/**
 * The public site address for share links and previews (server side).
 * NEXT_PUBLIC_SITE_URL if set; on Vercel, the production domain it provides; locally, localhost.
 */
export function siteUrl(env: Record<string, string | undefined> = process.env): string {
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL;
  const url = env.NEXT_PUBLIC_SITE_URL || (vercel ? `https://${vercel}` : "http://localhost:3000");
  return url.replace(/\/$/, "");
}
