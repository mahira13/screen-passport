"use client";

import { useState } from "react";

export function ReportTrip({ tripId }: { tripId: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | string>("idle");

  const report = async () => {
    if (!window.confirm("Report this trip as spam, unsafe or offensive?")) return;
    setState("sending");
    const res = await fetch(`/api/trip/${tripId}/report`, { method: "POST" }).catch(() => null);
    if (res?.ok) setState("done");
    else setState((await res?.json().catch(() => null))?.error ?? "Couldn't send the report. Try again.");
  };

  if (state === "done") return <p role="status" className="text-xs text-ink/70">Thanks. We&apos;ve got your report.</p>;
  return (
    <div>
      <button type="button" onClick={report} disabled={state === "sending"} className="text-xs text-ink/70 underline underline-offset-2">
        Report this trip
      </button>
      {state !== "idle" && state !== "sending" && <p role="alert" className="mt-1 text-xs text-red-400">{state}</p>}
    </div>
  );
}
