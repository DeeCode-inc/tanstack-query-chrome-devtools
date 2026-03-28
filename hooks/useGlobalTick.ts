import { useCallback, useSyncExternalStore } from "react";
import { subscribe } from "@/utils/tick-store";
import { formatRelativeTime } from "@/utils/format";

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noopUnsubscribe = () => {};
const noopSubscribe = () => noopUnsubscribe;

export function useGlobalTick(timestamp: number): string {
  const subscribeToStore = useCallback(
    (listener: () => void) => timestamp === 0 ? noopSubscribe() : subscribe(listener, timestamp),
    [timestamp],
  );

  const getSnapshot = useCallback(() => formatRelativeTime(timestamp), [timestamp]);

  return useSyncExternalStore(subscribeToStore, getSnapshot);
}
