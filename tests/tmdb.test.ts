import { describe, expect, it } from "vitest";
import { normaliseTitle } from "@/lib/match";
import { metadataUpdate, pickHit } from "@/lib/tmdb";

describe("pickHit", () => {
  const hits = [
    { id: 48138, title: "Unknown", release_date: "2011-02-16" },
    { id: 9, title: "Unknown", release_date: "2006-11-03" },
    { id: 5, title: "Unknown Soldier", release_date: "2011-01-01" },
  ];
  it("refuses to guess between two films of the same name", () => {
    expect(pickHit({ title: "Unknown", aliases: ["Unknown Identity"], year: null }, hits, normaliseTitle))
      .toEqual({ ambiguous: hits.slice(0, 2) });
  });
  it("uses the year, and matches German aliases on the original title", () => {
    expect(pickHit({ title: "Unknown", aliases: [], year: 2011 }, hits, normaliseTitle)).toEqual({ hit: hits[0] });
    const tv = [{ id: 87739, name: "The Queen's Gambit", first_air_date: "2020-10-23" }];
    expect(pickHit({ title: "Das Damengambit", aliases: ["The Queen's Gambit"], year: null }, tv, normaliseTitle)).toEqual({ hit: tv[0] });
  });
});

describe("metadataUpdate", () => {
  const work = { title: "The Queen's Gambit", aliases: ["Das Damengambit"], year: null };
  const details = {
    id: 87739, first_air_date: "2020-10-23",
    alternative_titles: { results: [
      { iso_3166_1: "US", title: "Queen's Gambit" },
      { iso_3166_1: "FR", title: "Le Jeu de la dame" },
      { iso_3166_1: "DE", title: "Damengambit (Arbeitstitel)", type: "working title" },
    ] },
    translations: { translations: [
      { iso_3166_1: "DE", iso_639_1: "de", data: { name: "Das Damengambit" } },
      { iso_3166_1: "ES", iso_639_1: "es", data: { name: "Gambito de dama" } },
    ] },
  };
  it("fills an empty year and adds only German and English titles", () => {
    expect(metadataUpdate(work, details)).toEqual({
      year: 2020, aliases: ["Das Damengambit", "Queen's Gambit"], added: ["Queen's Gambit"] });
  });
  it("keeps a year we already have unless forced, and never drops aliases", () => {
    expect(metadataUpdate({ ...work, year: 2019 }, details).year).toBe(2019);
    expect(metadataUpdate({ ...work, year: 2019 }, details, true).year).toBe(2020);
    expect(metadataUpdate({ ...work, aliases: ["X"] }, { id: 1 }).aliases).toEqual(["X"]);
  });
});
