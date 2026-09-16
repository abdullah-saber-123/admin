/**
 * The backend sends timestamps like "2026-08-13T07:22:00" - no "Z", no
 * offset. Per the JS spec, a date-time string with NO timezone marker is
 * parsed as LOCAL time, not UTC. But the backend's clock is UTC. So without
 * fixing this, every "time ago" / date display is off by exactly the
 * browser's UTC offset (e.g. 3 hours early for Saudi Arabia, UTC+3) -
 * a sync that just happened shows as "3h ago" instead of "just now".
 *
 * Fix: if the string has no timezone marker, treat it as UTC by appending "Z"
 * before handing it to the Date constructor.
 */
export function parseServerDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const hasTimezone = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(value);
  return new Date(hasTimezone ? value : `${value}Z`);
}

/**
 * Consistent D/M/YYYY date display everywhere in the app (e.g. "27/7/2026"),
 * no month names - matches what was asked for across every screen.
 */
export function fmtDate(value) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "—";
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

/** Same D/M/YYYY date, plus HH:MM - for timestamps that include a time
 * component (follow-up log entries, etc). Uses parseServerDate so the
 * UTC-offset fix above is applied automatically. */
export function fmtDateTime(value) {
  if (!value) return "—";
  const d = parseServerDate(value);
  if (!d || isNaN(d.getTime())) return "—";
  const datePart = fmtDate(d);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${datePart} ${hh}:${mm}`;
}

/**
 * Whole calendar days from today until a date-only value (e.g. "2026-08-30"),
 * counted in the user's own local calendar - not a raw millisecond subtraction,
 * which can drift by a day depending on the browser's timezone offset relative
 * to the UTC midnight a date-only string parses to. Negative = already past.
 */
export function daysUntil(value) {
  if (!value) return null;
  const target = value instanceof Date ? value : new Date(value);
  if (isNaN(target.getTime())) return null;
  const now = new Date();
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const targetUTC = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  return Math.round((targetUTC - todayUTC) / 86400000);
}
