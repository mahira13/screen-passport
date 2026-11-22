import { describe, expect, it } from "vitest";
import { type CommonsPage, fileFromPage, isFreeLicense, toCandidate } from "@/lib/images/commons";
import { parseMatch } from "@/lib/images/relevance";
import { coverPhoto, type LiveLocation } from "@/lib/nearby";

describe("isFreeLicense", () => {
  it.each(["CC0", "Public domain", "PD-self", "CC BY 4.0", "CC BY-SA 3.0", "CC-BY-SA-4.0"])("accepts %s", (l) =>
    expect(isFreeLicense(l)).toBe(true));
  it.each(["CC BY-NC 2.0", "CC BY-ND 4.0", "CC BY-NC-SA 3.0", "Fair use", "All rights reserved", ""])("rejects %s", (l) =>
    expect(isFreeLicense(l)).toBe(false));
});

const page = (title: string, meta: Record<string, string> = {}, mime = "image/jpeg"): CommonsPage => ({
  title,
  imageinfo: [{
    url: "https://upload.wikimedia.org/a/b/Foo.jpg",
    thumburl: "https://upload.wikimedia.org/a/b/800px-Foo.jpg",
    descriptionurl: "https://commons.wikimedia.org/wiki/File:Foo.jpg",
    mime,
    extmetadata: Object.fromEntries(Object.entries({ LicenseShortName: "CC BY-SA 4.0", Artist: "<a href='x'>Jane Doe</a>", ...meta }).map(([k, v]) => [k, { value: v }])),
  }],
});

describe("toCandidate", () => {
  it("keeps a free photo with its 800 px thumbnail, plain-text author and file page", () => {
    const c = toCandidate(page("File:Foo.jpg", { LicenseUrl: "https://creativecommons.org/licenses/by-sa/4.0" }));
    expect(c).toMatchObject({
      file: "File:Foo.jpg", thumbUrl: "https://upload.wikimedia.org/a/b/800px-Foo.jpg", author: "Jane Doe",
      license: "CC BY-SA 4.0", sourcePage: "https://commons.wikimedia.org/wiki/File:Foo.jpg",
    });
  });
  it("moves a thumb.wikimedia.org thumbnail to the same path on upload.wikimedia.org", () => {
    const p = page("File:Foo.jpg");
    p.imageinfo![0].thumburl = "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Foo.jpg/960px-Foo.jpg?utm_source=x";
    expect(toCandidate(p)).toMatchObject({ thumbUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Foo.jpg/960px-Foo.jpg?utm_source=x" });
  });
  it("skips non-free licences, non-photos, stills, posters, promo images and portraits", () => {
    expect(toCandidate(page("File:Foo.jpg", { LicenseShortName: "CC BY-NC 2.0" }))).toHaveProperty("skip");
    expect(toCandidate(page("File:Foo.svg", {}, "image/svg+xml"))).toHaveProperty("skip");
    for (const t of ["File:Film still Foo.jpg", "File:Foo screenshot.png", "File:Foo poster.jpg", "File:Foo promotional photo.jpg", "File:Portrait of Foo.jpg"])
      expect(toCandidate(page(t))).toHaveProperty("skip");
  });
});

describe("fileFromPage", () => {
  it("turns a Commons file page into the stored file name", () => {
    expect(fileFromPage("https://commons.wikimedia.org/wiki/File:Br%C3%BCcke_am_Fluss.jpg")).toBe("File:Brücke am Fluss.jpg");
  });
  it("returns null for anything else", () => {
    expect(fileFromPage(null)).toBeNull();
    expect(fileFromPage("https://example.com/wiki/File:Foo.jpg")).toBeNull();
    expect(fileFromPage("https://commons.wikimedia.org/wiki/Category:Foo")).toBeNull();
  });
});

describe("parseMatch", () => {
  it("accepts only the exact shape", () => {
    expect(parseMatch('{"matches":true,"reason":"Shows the bridge."}')).toEqual({ matches: true, reason: "Shows the bridge." });
    expect(parseMatch('{"matches":"yes","reason":"x"}')).toBeNull();
    expect(parseMatch("not json")).toBeNull();
  });
});

describe("coverPhoto", () => {
  const loc = (id: number, work_id: string, photo: boolean): LiveLocation => ({
    id, work_id, name: `P${id}`, city: "Berlin", lat: 52.5, lng: 13.4, coord_quality: "source",
    ...(photo ? { image_thumb_url: `https://upload.wikimedia.org/${id}.jpg`, image_author: "A", image_license: "CC0", image_source_page: `https://commons.wikimedia.org/wiki/File:${id}.jpg` } : {}),
  });
  it("uses the first place with a photo, titles in order", () => {
    expect(coverPhoto(["none", "b", "a"], [loc(3, "a", true), loc(7, "b", true), loc(5, "b", false)])?.url).toBe("https://upload.wikimedia.org/7.jpg"); // #5 has none
    expect(coverPhoto(["b"], [loc(5, "b", false)])).toBeNull();
    expect(coverPhoto(["b", "a"], [loc(7, "b", true), loc(9, "b", false)])?.url).toBe("https://upload.wikimedia.org/7.jpg");
  });
});

describe("poster candidates", () => {
  const page = (url: string, license = "Public domain", title = "File:Metropolis poster.jpg") => ({
    title, imageinfo: [{ url, descriptionurl: `https://commons.wikimedia.org/wiki/${title}`, mime: "image/jpeg",
      extmetadata: { LicenseShortName: { value: license }, Artist: { value: "Heinz Schulz-Neudamm" } } }],
  });
  it("accepts a free poster hosted on Commons", () => {
    expect(toCandidate(page("https://upload.wikimedia.org/wikipedia/commons/a/ab/Metropolis.jpg"), "poster")).toMatchObject({ license: "Public domain" });
  });
  it("refuses local (fair-use) uploads and non-free licences", () => {
    expect(toCandidate(page("https://upload.wikimedia.org/wikipedia/en/a/ab/Metropolis.jpg"), "poster")).toEqual({ skip: "not hosted on Commons" });
    expect(toCandidate(page("https://upload.wikimedia.org/wikipedia/commons/a/ab/M.jpg", "Fair use"), "poster")).toMatchObject({ skip: expect.stringMatching(/licence/) });
  });
  it("still keeps posters out of place photos", () => {
    expect(toCandidate(page("https://upload.wikimedia.org/wikipedia/commons/a/ab/Metropolis.jpg"))).toEqual({ skip: "still, poster, logo or portrait" });
  });
});
