"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { isNativeApp } from "@/lib/native-alerts";

const subscribe = () => () => {};

/** Renders children only inside the iPhone app, never on the website or during server rendering. */
export function NativeOnly({ children }: { children: ReactNode }) {
  const native = useSyncExternalStore(subscribe, isNativeApp, () => false);
  return native ? <>{children}</> : null;
}
