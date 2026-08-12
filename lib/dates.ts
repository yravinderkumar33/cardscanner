// Date grouping and labels for the History screen.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Section header for a scan date: Today / Yesterday / Earlier in <Month> / <Month> / <Month Year>. */
export function sectionLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const days = Math.round((startOfDay(now).getTime() - startOfDay(d).getTime()) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
    return `Earlier in ${MONTHS[d.getMonth()]}`;
  }
  if (d.getFullYear() === now.getFullYear()) return MONTHS[d.getMonth()];
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Trailing row label: time for today, otherwise a short date. */
export function whenLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const days = Math.round((startOfDay(now).getTime() - startOfDay(d).getTime()) / 86400000);
  if (days <= 0) {
    let h = d.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`;
  }
  if (days === 1) return 'Yesterday';
  const short = MONTHS[d.getMonth()].slice(0, 3);
  return d.getFullYear() === now.getFullYear() ? `${short} ${d.getDate()}` : `${short} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Longer stamp for the detail screen: "Today, 2:14 PM" / "Aug 6" style. */
export function scannedLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const days = Math.round((startOfDay(now).getTime() - startOfDay(d).getTime()) / 86400000);
  if (days <= 0) return `Today, ${whenLabel(iso, now)}`;
  return whenLabel(iso, now);
}
