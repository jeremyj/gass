/**
 * Pure helpers for the turni schedule (no DB).
 *
 * Dates are local calendar strings 'yyyy-mm-dd'. Arithmetic runs on UTC
 * midnights, so a DST change can never shift a day (toISOString of a UTC
 * midnight is that same calendar date).
 */

const TUESDAY = 2;
// Partner chosen among the next 3 waiting (= the previous partner plus the next
// pair, since waits come in pairs). Simulated over 10 years (2026-10-01): gaps
// 10-12 weeks for 22 people, ~all partners met, no pair more than 4 times
const PARTNER_WINDOW = 3;

function parseDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDays(dateStr, n) {
  const date = parseDay(dateStr);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

// Tuesday of the Monday-Sunday week containing dateStr
function tuesdayOf(dateStr) {
  const isoWeekday = parseDay(dateStr).getUTCDay() || 7; // Mon=1 .. Sun=7
  return addDays(dateStr, TUESDAY - isoWeekday);
}

// First Tuesday on or after dateStr
function nextTuesday(dateStr) {
  return addDays(dateStr, (TUESDAY - parseDay(dateStr).getUTCDay() + 7) % 7);
}

function inPause(dateStr, pauses) {
  return pauses.some(p => p.dal <= dateStr && dateStr <= p.al);
}

function isDateString(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && addDays(s, 0) === s;
}

/**
 * Pick the next pair from the rolling queue.
 * people: [{ id, waitKey }], waitKey = 'yyyy-mm-dd' of the last shift (or of
 * joining the queue); '' sorts first. pairCount(a, b) = shifts done together.
 * The longest-waiting person goes; the partner is, among the next
 * PARTNER_WINDOW waiting, the one met least. Ties are broken by rnd().
 */
function pickPair(people, pairCount, rnd = Math.random) {
  const order = people
    .map(p => ({ id: p.id, waitKey: p.waitKey || '', r: rnd() }))
    .sort((x, y) => (x.waitKey < y.waitKey ? -1 : x.waitKey > y.waitKey ? 1 : x.r - y.r));
  if (order.length === 0) return [null, null];
  const first = order[0];
  if (order.length === 1) return [first.id, null];
  const partner = order
    .slice(1, 1 + PARTNER_WINDOW)
    .map(p => ({ id: p.id, n: pairCount(first.id, p.id), r: rnd() }))
    .sort((x, y) => x.n - y.n || x.r - y.r)[0];
  return [first.id, partner.id];
}

module.exports = { TUESDAY, PARTNER_WINDOW, addDays, tuesdayOf, nextTuesday, inPause, isDateString, pickPair };
