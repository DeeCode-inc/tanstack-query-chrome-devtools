import { useGlobalTick } from "@/hooks/useGlobalTick";

export function RelativeTime({ timestamp }: { timestamp: number }) {
  const text = useGlobalTick(timestamp);
  return <>{text}</>;
}
