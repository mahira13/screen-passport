"use client";

import { useSyncExternalStore } from "react";
import { getServerSnapshot, getSnapshot, subscribe } from "./passport-store";

export function usePassport() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
