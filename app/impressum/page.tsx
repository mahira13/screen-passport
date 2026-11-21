import type { Metadata } from "next";

export const metadata: Metadata = { title: "Impressum · Screen Passport" };

// Fill in every [placeholder] before launch.
export default function ImpressumPage() {
  return (
    <main className="mx-auto w-full max-w-screen-2xl px-4 sm:px-8 lg:px-12 pb-16 pt-6 text-base text-ink/85 [&>*]:max-w-2xl">
      <h1 className="text-4xl font-black tracking-tight text-ink sm:text-5xl">Impressum</h1>
      <p className="mt-1 text-sm text-ink/70">Information according to § 5 DDG</p>

      <h2 className="mt-6 font-display text-lg font-semibold">Provider</h2>
      <p className="mt-1">
        [Full name or company name]<br />
        [Street and house number]<br />
        [Postcode and city]<br />
        [Country]
      </p>

      <h2 className="mt-6 font-display text-lg font-semibold">Contact</h2>
      <p className="mt-1">
        Email: [email address]<br />
        Phone: [phone number]
      </p>

      <h2 className="mt-6 font-display text-lg font-semibold">Responsible for content (§ 18 Abs. 2 MStV)</h2>
      <p className="mt-1">[Full name], [address as above]</p>

      <h2 className="mt-6 font-display text-lg font-semibold">Filming locations and links</h2>
      <p className="mt-1">
        Every filming location links to its source. We check sources before a place goes live, but we can&apos;t take
        responsibility for the content of external sites. Film and series titles belong to their owners; this site is
        not connected to any studio or streaming service.
      </p>
    </main>
  );
}
