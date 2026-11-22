import { describe, expect, it } from "vitest";
import { missionInfo, MISSION_MIN_CHECKINS, sceneNumber, spreadKm, walkLabel } from "@/lib/mission";

const at = (id: number, lat: number, lng: number, city: string | null = "Berlin", checkIn = true) => ({ id, lat, lng, city, checkIn });

describe("spreadKm", () => {
  it("is zero for one place and the widest pair otherwise", () => {
    expect(spreadKm([at(1, 52.5, 13.4)])).toBe(0);
    // Brandenburg Gate to Alexanderplatz is about 2.3 km
    expect(spreadKm([at(1, 52.5163, 13.3777), at(2, 52.5219, 13.4132), at(3, 52.518, 13.39)])).toBeCloseTo(2.48, 1);
  });
});

describe("missionInfo", () => {
  it("rates a small walkable city set Easy with its spread in km", () => {
    const m = missionInfo([at(1, 52.5163, 13.3777), at(2, 52.5219, 13.4132), at(3, 52.518, 13.39)]);
    expect(m).toMatchObject({ scenes: 3, cities: 1, reels: 1, level: "Easy", locked: false });
    expect(m.line).toBe("Easy · 3 scenes · 2 km");
  });

  it("rates a big multi-city set Epic and counts cities instead of km", () => {
    const places = Array.from({ length: 12 }, (_, i) => at(i + 1, 48 + i * 0.5, 10 + i * 0.3, ["Berlin", "Görlitz", "Potsdam", "Munich"][i % 4]));
    const m = missionInfo(places);
    expect(m).toMatchObject({ scenes: 12, cities: 4, level: "Epic", reels: 5 });
    expect(m.line).toBe("Epic · 12 scenes · 4 cities");
  });

  it("locks a mission with too few check-in places", () => {
    const m = missionInfo([at(1, 52.5, 13.4), at(2, 52.51, 13.41, "Berlin", false), at(3, 52.52, 13.42, "Berlin", false)]);
    expect(MISSION_MIN_CHECKINS).toBe(2);
    expect(m.checkIns).toBe(1);
    expect(m.locked).toBe(true);
  });

  it("says one scene and under 1 km for a single place", () => {
    expect(missionInfo([at(1, 52.5, 13.4), at(1, 52.5, 13.4)]).line).toBe("Easy · 1 scene · under 1 km");
  });

  it("ignores missing cities when counting", () => {
    expect(missionInfo([at(1, 52.5, 13.4, null), at(2, 52.5, 13.41)]).cities).toBe(1);
  });
});

describe("walkLabel", () => {
  it("shows walking minutes up to half an hour, then km", () => {
    expect(walkLabel(0.04)).toBe("1 min walk");
    expect(walkLabel(0.64)).toBe("8 min walk");
    expect(walkLabel(2.4)).toBe("30 min walk");
    expect(walkLabel(2.5)).toBe("about 2.5 km");
    expect(walkLabel(40)).toBe("about 40 km");
  });
});

describe("sceneNumber", () => {
  it("pads the position inside the mission", () => {
    expect(sceneNumber(0)).toBe("Scene 01");
    expect(sceneNumber(11)).toBe("Scene 12");
  });
});
