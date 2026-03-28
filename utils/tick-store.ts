type Listener = () => void;

const listeners = new Set<Listener>();
const timestamps = new Map<Listener, number>();
let tickCount = 0;
let timerId: ReturnType<typeof setTimeout> | null = null;

function computeInterval(): number {
  const now = Date.now();
  let minAge = Infinity;
  for (const ts of timestamps.values()) {
    const age = now - ts;
    if (age < minAge) minAge = age;
  }
  if (minAge < 60_000) return 1_000;
  if (minAge < 3_600_000) return 30_000;
  return 60_000;
}

function tick(): void {
  tickCount++;
  for (const listener of listeners) {
    listener();
  }
  scheduleTick();
}

function scheduleTick(): void {
  if (listeners.size === 0) return;
  timerId = setTimeout(tick, computeInterval());
}

export function subscribe(listener: Listener, timestamp: number): () => void {
  listeners.add(listener);
  timestamps.set(listener, timestamp);
  if (listeners.size === 1) {
    scheduleTick();
  }
  return () => {
    listeners.delete(listener);
    timestamps.delete(listener);
    if (listeners.size === 0 && timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };
}

export function getSnapshot(): number {
  return tickCount;
}
