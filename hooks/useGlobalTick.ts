import { useCallback, useSyncExternalStore } from "react";
import { formatRelativeTime } from "@/utils/format";
import { subscribe } from "@/utils/tick-store";

const noopUnsubscribe = () => {};
const noopSubscribe = () => noopUnsubscribe;

export function useGlobalTick(timestamp: number): string {
  const subscribeToStore = useCallback(
    (listener: () => void) =>
      timestamp === 0 ? noopSubscribe() : subscribe(listener, timestamp),
    [timestamp],
  );

  const getSnapshot = useCallback(
    () => formatRelativeTime(timestamp),
    [timestamp],
  );

  return useSyncExternalStore(subscribeToStore, getSnapshot);
}
