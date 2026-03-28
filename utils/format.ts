const rtf = new Intl.RelativeTimeFormat("en", {
  numeric: "always",
  style: "narrow",
});

export function formatRelativeTime(timestamp: number): string {
  if (timestamp === 0) return "never";
  const diffSec = Math.round((timestamp - Date.now()) / 1000);
  if (Math.abs(diffSec) < 60) return `< ${rtf.format(-1, "minute")}`;
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 24) return rtf.format(diffHr, "hour");
  const diffDay = Math.round(diffHr / 24);
  return rtf.format(diffDay, "day");
}

export function formatAbsoluteTime(timestamp: number): string {
  if (timestamp === 0) return "";
  return new Date(timestamp).toLocaleTimeString("en", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}
