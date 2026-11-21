export const LAYLA_URL = "https://layla.ai";
const MAX_PLACES = 5;

/** "Berlin/Potsdam" -> "Berlin": seed cities can name two places. */
export function mainCity(city: string | null | undefined): string | null {
  const c = city?.split("/")[0].trim();
  return c ? c : null;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * "Plan a day in Berlin visiting Rotes Rathaus, Alexanderplatz and Körnerpark
 * where Babylon Berlin was filmed." Uses the title's places in the same city as
 * the chosen place, closest first, at most five, chosen place always included.
 */
export function laylaPrompt(
  title: string,
  chosen: { name: string; city: string | null },
  allPlaces: { name: string; city: string | null; distanceKm: number }[],
): string {
  const city = mainCity(chosen.city);
  const sameCity = allPlaces
    .filter((p) => mainCity(p.city) === city)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .map((p) => p.name);
  const names = [...new Set([chosen.name, ...sameCity])].slice(0, MAX_PLACES);
  const where = city ? `a day in ${city}` : "a day";
  return `Plan ${where} visiting ${joinNames(names)} where ${title} was filmed.`;
}
