import { formatTripDate, MAX_JOINS } from "./trip";

export const INVITE_WIDTH = 1080;
export const INVITE_HEIGHT = 1920;

export interface InviteData {
  tripTitle: string;
  films: string; // plain text, e.g. "Babylon Berlin" or "Dark and Babylon Berlin"
  when: string; // "Sat 28 Nov, 10:00 Berlin time"
  venue: string;
  stops: number;
  seatsLeft: number;
  link: string; // full URL
  linkLabel: string; // without https://
  hashtags: string[];
}

/** "The Queen's Gambit" -> "#TheQueensGambit". Letters and digits only, accents removed. */
export function hashtag(title: string): string | null {
  const words = title
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’`]/g, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  const tag = words.map((w) => w[0].toUpperCase() + w.slice(1)).join("");
  return tag ? `#${tag}` : null;
}

function joinTitles(titles: string[]): string {
  if (titles.length <= 1) return titles.join("");
  if (titles.length > 3) return `${titles.slice(0, 3).join(", ")} and more`;
  return `${titles.slice(0, -1).join(", ")} and ${titles[titles.length - 1]}`;
}

export function buildInvite(input: {
  title: string;
  filmTitles: string[];
  startsAt: string;
  timeZone: string;
  meetingPoint: string;
  stops: number;
  joined: number;
  url: string;
}): InviteData {
  const films = [...new Set(input.filmTitles)];
  return {
    tripTitle: input.title,
    films: joinTitles(films),
    when: formatTripDate(input.startsAt, input.timeZone),
    venue: input.meetingPoint,
    stops: input.stops,
    seatsLeft: Math.max(0, MAX_JOINS - input.joined),
    link: input.url,
    linkLabel: input.url.replace(/^https?:\/\//, "").replace(/\/$/, ""),
    hashtags: films.map(hashtag).filter((t): t is string => !!t).slice(0, 3),
  };
}

/** Caption to paste under the story: the trip, when, the link and the film's hashtag. */
export function inviteCaption(d: InviteData): string {
  return `Now showing: ${d.tripTitle}, ${d.when}. Grab a seat: ${d.link} ${d.hashtags.join(" ")}`.trim();
}
