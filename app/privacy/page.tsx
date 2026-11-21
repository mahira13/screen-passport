import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy · Screen Passport" };

const H = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-6 font-display text-lg font-semibold">{children}</h2>
);

// Fill in every [placeholder] before launch.
export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-screen-2xl px-4 sm:px-8 lg:px-12 space-y-2 pb-16 pt-6 text-base text-ink/85 [&>*]:max-w-2xl">
      <h1 className="text-4xl font-black tracking-tight text-ink sm:text-5xl">Privacy</h1>
      <p className="text-sm text-ink/70">Last updated: [date]</p>

      <H>Who is responsible</H>
      <p>[Full name or company name], [address], [email address]. See the Impressum.</p>

      <H>No accounts</H>
      <p>
        You don&apos;t sign up, and we don&apos;t ask for an email address or password. We don&apos;t connect to Netflix or
        any other streaming account.
      </p>

      <H>Your location</H>
      <p>
        If you tap &quot;Use my location&quot;, your browser shares it with this page. We round it to about 100 m and use it
        to sort places by distance. We don&apos;t store it, except as the rounded start point of a trip you create.
      </p>

      <H>Your passport</H>
      <p>
        A passport stores only the titles you marked as watched, places you checked in at, the start city and, if you add
        one, a display name. It has a random ID; anyone with its link can view it. Your browser remembers your last
        passport in local storage.
      </p>

      <H>Trips</H>
      <p>
        A trip stores the titles, start point, way of getting around, length, date and time, time zone, meeting point,
        the plan and the organiser&apos;s first name. People who join add only a first name. Anyone with the link can see
        the trip, including these first names, so don&apos;t add personal details. The organiser can delete the trip at any
        time with their secret link; this also deletes everyone who joined.
      </p>
      <p>
        To write a trip&apos;s descriptions we send the chosen filming places (names and notes from our database) to
        Anthropic&apos;s Claude API. We don&apos;t send names, your location or anything else about you.
      </p>

      <H>Reports and limits</H>
      <p>
        To stop spam we limit how many trips and joins can come from one connection per day, and count reports once per
        connection. For this we store a one-way, salted hash of your IP address, never the address itself. Rate-limit
        entries are deleted after two days; report entries are deleted with the trip.
      </p>

      <H>Photos</H>
      <p>
        Postcard photos are put together in your browser and are not uploaded.
      </p>

      <H>Usage statistics</H>
      <p>
        We count events such as &quot;map viewed&quot; or &quot;trip created&quot; with a few details like the start city.
        These events contain no names, no IP addresses and no exact locations.
      </p>

      <H>Services we use</H>
      <ul className="list-disc space-y-1 pl-5">
        <li>Hosting: Vercel Inc. [region / data processing agreement details]</li>
        <li>Database: Supabase Inc. [region, e.g. EU (Frankfurt)]</li>
        <li>Trip descriptions: Anthropic PBC (Claude API)</li>
        <li>Map tiles: OpenStreetMap Foundation. Your browser loads map tiles from their servers, which see your IP address.</li>
        <li>Google Maps and Layla open only when you tap their buttons; their own privacy policies then apply.</li>
      </ul>

      <H>Legal basis</H>
      <p>[Legal basis, e.g. Art. 6(1)(b) GDPR for trips you create or join, Art. 6(1)(f) GDPR for spam protection.]</p>

      <H>Your rights</H>
      <p>
        You can ask for access, correction or deletion of your data, restrict or object to processing, and complain to a
        data protection authority. Since we don&apos;t know who you are, please include the link to the passport or trip.
        Contact: [email address].
      </p>
    </main>
  );
}
