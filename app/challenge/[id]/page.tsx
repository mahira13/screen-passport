import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import { JoinChallenge } from "@/components/ChallengeFriends";
import { ProgressRing } from "@/components/ProgressRing";
import { ShareLink } from "@/components/ShareLink";
import { MAX_CHALLENGERS } from "@/lib/challenges";
import { challengeStandings, getChallenge, type ChallengeView } from "@/lib/challenges-server";
import { isPassportId } from "@/lib/ids";
import { siteUrl } from "@/lib/site-url";
import { TrackView } from "@/components/TrackView";

const WRAP = "mx-auto w-full max-w-screen-md px-4 sm:px-8";

const loadChallenge = cache(async (id: string): Promise<ChallengeView | null | "failed"> => {
  if (!isPassportId(id) || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    return await getChallenge(id);
  } catch (e) {
    console.error("challenge page:", e instanceof Error ? e.message : e);
    return "failed";
  }
});

export async function generateMetadata(props: PageProps<"/challenge/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const ch = await loadChallenge(id);
  if (!ch || ch === "failed" || !ch.collection) return { title: "Challenge · Screen Passport", robots: { index: false } };
  const title = `${ch.collection.name}: who checks in everywhere first?`;
  const description = `${ch.people.length} ${ch.people.length === 1 ? "person" : "people"} racing to visit ${ch.goal.length} real filming places. Join on Screen Passport.`;
  return {
    metadataBase: new URL(siteUrl()),
    title: `${title} · Screen Passport`,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "website", url: `/challenge/${ch.id}`, siteName: "Screen Passport" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function ChallengePage(props: PageProps<"/challenge/[id]">) {
  return (
    <main className="w-full pb-16">
      <Suspense fallback={<p className="label px-4 py-16 text-center text-ink/60">Opening challenge…</p>}>
        <Challenge params={props.params} />
      </Suspense>
    </main>
  );
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <div className={`${WRAP} pt-16 text-center`}>
      <h1 className="font-display text-4xl">{title}</h1>
      <p className="mt-2 text-ink/80">{text}</p>
      <Link href="/collections" className="label mt-6 inline-flex min-h-11 items-center bg-accent px-5 text-paper">Browse collections</Link>
    </div>
  );
}

async function Challenge({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ch = await loadChallenge(id);
  if (!ch) notFound();
  if (ch === "failed") return <Message title="We can't open this challenge right now" text="Something went wrong on our side. Please try again in a minute." />;
  if (!ch.collection || ch.goal.length === 0) {
    return <Message title="This collection isn't available any more" text="Its places are being checked again. Pick another collection to play." />;
  }
  const c = ch.collection;
  const rows = challengeStandings(ch);
  const winner = rows.find((r) => r.finishedAt);

  return (
    <>
      <header className={`${WRAP} pt-10 sm:pt-16`}>
        <TrackView page="challenge" id={id} />
        <p className="label text-accent">Friend challenge</p>
        <h1 className="mt-2 font-display text-5xl leading-[0.95] tracking-tight sm:text-6xl">{c.name}</h1>
        <p className="mt-3 text-ink/80">
          Who checks in at all {ch.goal.length} places first? Check-ins count only on site, within 200 m.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href={c.href} className="label inline-flex min-h-11 items-center bg-accent px-5 text-paper transition-colors hover:bg-ink">See the places</Link>
          <ShareLink path={`/challenge/${ch.id}`} title={c.name} text={`Race me: who checks in at every ${c.name} place first?`} what="challenge" />
        </div>
      </header>

      <section className={`${WRAP} mt-10 border-t-2 border-accent bg-surface p-5 sm:p-6`}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-3xl">Standings</h2>
          <span className="label text-ink/60">{rows.length} / {MAX_CHALLENGERS}</span>
        </div>
        {winner && <p className="mt-2 font-display text-xl text-accent">{winner.name} finished first.</p>}
        {rows.length === 0 ? (
          <p className="mt-4 text-ink/80">Nobody has joined yet. Be the first.</p>
        ) : (
          <ol className="mt-4 grid gap-2">
            {rows.map((r, i) => (
              <li key={i} className="flex items-center gap-3 border-b border-ink/10 pb-2">
                <span className="label w-6 text-ink/60">{i + 1}</span>
                <ProgressRing done={r.progress.done} total={r.progress.total} size={40} />
                <span className="flex-1 text-lg">{r.name}</span>
                <span className="label text-ink/70">{r.finishedAt ? "Finished" : `${r.progress.done}/${r.progress.total}`}</span>
              </li>
            ))}
          </ol>
        )}
        <JoinChallenge id={ch.id} full={rows.length >= MAX_CHALLENGERS} />
        <p className="mt-4 text-xs text-ink/60">Only first names are shown. Your passport stays private.</p>
      </section>
    </>
  );
}
