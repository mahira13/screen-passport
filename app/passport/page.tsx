import type { Metadata } from "next";
import { PassportRedirect } from "@/components/PassportRedirect";

export const metadata: Metadata = { title: "My Passport · Screen Passport" };

export default function PassportPage() {
  return (
    <main className="w-full">
      <PassportRedirect />
    </main>
  );
}
