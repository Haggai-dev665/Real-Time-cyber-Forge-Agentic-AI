/** Compact "time ago" — e.g. now, 2m, 5h, 3d. */
export function timeAgo(input: number | string | undefined | null): string {
  if (input == null) return '';
  const ts = typeof input === 'number' ? input : Date.parse(input);
  if (Number.isNaN(ts)) return '';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

/** Title-cases a backend event type like "threat:new" → "Threat". */
export function eventTitle(type: string, data: Record<string, unknown>): string {
  const label =
    (data.title as string) ||
    (data.message as string) ||
    (data.summary as string) ||
    (data.host as string) ||
    (data.url as string);
  if (label) return label;
  const [head] = type.split(':');
  return head.charAt(0).toUpperCase() + head.slice(1);
}
