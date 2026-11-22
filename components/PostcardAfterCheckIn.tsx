"use client";

import { usePassport } from "@/lib/use-passport";
import { PostcardMaker } from "./PostcardMaker";

/** The postcard is offered only after a successful check-in at this place. */
export function PostcardAfterCheckIn(props: { placeId: number; place: string; title: string }) {
  const { visited } = usePassport();
  return visited.includes(props.placeId) ? <PostcardMaker {...props} /> : null;
}
