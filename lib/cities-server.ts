// Start cities from the cached live data (server only).
import { deriveCities, type City } from "./cities";
import { getLiveData } from "./live-data";

export async function getCities(): Promise<City[]> {
  try {
    return deriveCities((await getLiveData()).locations);
  } catch (e) {
    console.error("cities failed:", e instanceof Error ? e.message : e);
    return [];
  }
}
