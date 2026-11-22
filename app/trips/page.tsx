import type { Metadata } from "next";
import { CreateButton, MyTrips } from "@/components/MyTrips";

export const metadata: Metadata = { title: "Your trips · Screen Passport", robots: { index: false } };

export default function TripsPage() {
  return (
    <main className="mx-auto w-full max-w-screen-xl px-4 pb-20 pt-10 sm:px-8 sm:pt-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-5xl leading-[0.95] tracking-tight sm:text-7xl">Your trips</h1>
        <CreateButton />
      </div>
      <MyTrips />
    </main>
  );
}
