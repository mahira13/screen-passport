import { describe, expect, it } from "vitest";
import { buildInvite, hashtag, inviteCaption } from "@/lib/invite-card";

const base = {
  title: "Babylon Berlin Half-Day Walk",
  filmTitles: ["Babylon Berlin", "Babylon Berlin"],
  startsAt: "2026-11-28T09:00:00Z",
  timeZone: "Europe/Berlin",
  meetingPoint: "Rotes Rathaus",
  stops: 5,
  joined: 3,
  url: "https://screenpassport.app/trip/abc123def456",
};

describe("hashtag", () => {
  it("joins words in PascalCase without punctuation or accents", () => {
    expect(hashtag("Babylon Berlin")).toBe("#BabylonBerlin");
    expect(hashtag("The Queen's Gambit")).toBe("#TheQueensGambit");
    expect(hashtag("The Hunger Games: Mockingjay – Part 2")).toBe("#TheHungerGamesMockingjayPart2");
    expect(hashtag("Café Größe")).toBe("#CafeGrosse");
    expect(hashtag("!!!")).toBeNull();
  });
});

describe("buildInvite", () => {
  it("fills the ticket from the trip", () => {
    const d = buildInvite(base);
    expect(d).toMatchObject({
      films: "Babylon Berlin",
      when: "Sat 28 Nov, 10:00 Berlin time",
      venue: "Rotes Rathaus",
      stops: 5,
      seatsLeft: 47,
      linkLabel: "screenpassport.app/trip/abc123def456",
      hashtags: ["#BabylonBerlin"],
    });
  });
  it("never shows negative seats and names several films in plain text", () => {
    const d = buildInvite({ ...base, joined: 60, filmTitles: ["Dark", "Babylon Berlin", "Tár", "Run Lola Run"] });
    expect(d.seatsLeft).toBe(0);
    expect(d.films).toBe("Dark, Babylon Berlin, Tár and more");
    expect(d.hashtags).toEqual(["#Dark", "#BabylonBerlin", "#Tar"]);
  });
});

describe("inviteCaption", () => {
  it("has the trip, time, link and hashtag", () => {
    expect(inviteCaption(buildInvite(base))).toBe(
      "Now showing: Babylon Berlin Half-Day Walk, Sat 28 Nov, 10:00 Berlin time. Grab a seat: https://screenpassport.app/trip/abc123def456 #BabylonBerlin",
    );
  });
});
