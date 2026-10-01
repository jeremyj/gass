'use strict';

const { addDays, tuesdayOf, nextTuesday, inPause, isDateString, pickPair, PARTNER_WINDOW } = require('../../server/services/turni-schedule');

// Deterministic rnd for tests
function seq(values) { let i = 0; return () => values[i++ % values.length]; }

describe('date helpers', () => {
  it('addDays crosses the October DST change', () => {
    expect(addDays('2026-10-20', 7)).toBe('2026-10-27');
    expect(addDays('2026-03-24', 7)).toBe('2026-03-31');
    expect(addDays('2026-12-29', 7)).toBe('2027-01-05');
  });

  it('tuesdayOf maps Monday..Sunday to that week\'s Tuesday', () => {
    expect(tuesdayOf('2026-12-07')).toBe('2026-12-08'); // Monday
    expect(tuesdayOf('2026-12-08')).toBe('2026-12-08');
    expect(tuesdayOf('2026-12-09')).toBe('2026-12-08'); // Wednesday
    expect(tuesdayOf('2026-12-13')).toBe('2026-12-08'); // Sunday
  });

  it('nextTuesday is on or after the date', () => {
    expect(nextTuesday('2026-10-01')).toBe('2026-10-06');
    expect(nextTuesday('2026-10-06')).toBe('2026-10-06');
    expect(nextTuesday('2026-10-07')).toBe('2026-10-13');
  });

  it('inPause includes both ends', () => {
    const p = [{ dal: '2026-12-29', al: '2027-01-05' }];
    expect(inPause('2026-12-29', p)).toBe(true);
    expect(inPause('2027-01-05', p)).toBe(true);
    expect(inPause('2027-01-12', p)).toBe(false);
  });

  it('isDateString accepts only real yyyy-mm-dd dates', () => {
    expect(isDateString('2026-12-09')).toBe(true);
    expect(isDateString('2026-02-30')).toBe(false);
    expect(isDateString('9/12/2026')).toBe(false);
    expect(isDateString(undefined)).toBe(false);
  });
});

describe('pickPair', () => {
  const none = () => 0;

  it('takes the longest-waiting person first', () => {
    const people = [{ id: 1, waitKey: '2026-10-06' }, { id: 2, waitKey: '2026-09-22' }, { id: 3, waitKey: '2026-09-29' }];
    expect(pickPair(people, none, seq([0.5]))[0]).toBe(2);
  });

  it('prefers, among the next PARTNER_WINDOW, the partner met least', () => {
    const people = [1, 2, 3, 4, 5, 6].map((id, i) => ({ id, waitKey: `2026-09-${String(10 + i).padStart(2, '0')}` }));
    const counts = { '1-2': 3, '1-3': 1, '1-4': 2, '1-5': 0, '1-6': 0 };
    const pairCount = (a, b) => counts[`${Math.min(a, b)}-${Math.max(a, b)}`] || 0;
    // 5 and 6 are outside the window (2,3,4), so 3 wins with 1 shift together
    expect(PARTNER_WINDOW).toBe(3);
    expect(pickPair(people, pairCount, seq([0.5]))).toEqual([1, 3]);
  });

  it('breaks equal waits at random', () => {
    const people = [{ id: 1, waitKey: '' }, { id: 2, waitKey: '' }];
    expect(pickPair(people, none, seq([0.9, 0.1, 0.5]))[0]).toBe(2);
    expect(pickPair(people, none, seq([0.1, 0.9, 0.5]))[0]).toBe(1);
  });

  it('handles fewer than two people', () => {
    expect(pickPair([], none)).toEqual([null, null]);
    expect(pickPair([{ id: 7, waitKey: '' }], none)).toEqual([7, null]);
  });

  it('keeps everyone on a regular rhythm with varied partners over ten years', () => {
    // 21 people (odd), 520 weeks: the property the 2026-10-01 simulation showed
    let r = 1;
    const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    const last = new Map(), counts = new Map(), shifts = new Map();
    for (let id = 1; id <= 21; id++) { last.set(id, ''); shifts.set(id, []); }
    const key = (a, b) => `${Math.min(a, b)}-${Math.max(a, b)}`;
    for (let w = 1; w <= 520; w++) {
      const wk = String(w).padStart(4, '0');
      const people = [...last].map(([id, waitKey]) => ({ id, waitKey }));
      const [a, b] = pickPair(people, (x, y) => counts.get(key(x, y)) || 0, rnd);
      for (const id of [a, b]) { last.set(id, wk); shifts.get(id).push(w); }
      counts.set(key(a, b), (counts.get(key(a, b)) || 0) + 1);
    }
    const gaps = [...shifts.values()].flatMap(s => s.slice(1).map((w, i) => w - s[i]));
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(8);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(13);
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(5);
  });
});
