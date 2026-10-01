// 1.1: reminders several times a day, check-ins (gentle and mandatory), quiet hours, settings.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Reminders, inQuiet } = require('../src/main/reminders');
const { Store } = require('../src/main/store');
const { localDateKey } = require('../src/shared/rng.js');

const MIN = 60 * 1000;

function setup(settings = {}) {
  let now = new Date(2026, 9, 1, 8, 0).getTime(); // Thursday 08:00 local
  let trained = 0;
  const s = {
    dailyReminder: true, reminderTimes: ['09:00', '14:00', '19:00'], reminderDays: [0, 1, 2, 3, 4, 5, 6],
    checkinMinutes: 5, checkinMandatory: false, snoozeMinutes: 10, maxSnoozes: 2, quietStart: '22:30', quietEnd: '07:00',
    ...settings,
  };
  const r = new Reminders(null, { now: () => now, dateKey: localDateKey, getSettings: () => s, todayMs: () => trained });
  return {
    r, s,
    at: (h, m = 0) => { const d = new Date(now); d.setHours(h, m, 0, 0); now = d.getTime(); },
    advance: (ms) => { now += ms; },
    train: (ms) => { trained += ms; },
  };
}

test('reminders: each time fires once (gentle); training completes the check-in', () => {
  const t = setup();
  assert.equal(t.r.tick().fire, null, 'nothing before 09:00');
  assert.equal(t.r.status().next.time, '09:00');
  t.at(9, 0);
  assert.deepEqual(t.r.tick().fire, { time: '09:00', mandatory: false, repeat: false });
  assert.equal(t.r.tick().fire, null, 'gentle mode fires once');
  assert.equal(t.r.status().due.time, '09:00');
  t.train(3 * MIN);
  t.r.tick();
  assert.equal(t.r.status().due.progress, 0.6);
  t.train(2 * MIN);
  t.r.tick();
  assert.equal(t.r.status().due, null);
  assert.equal(t.r.status().slots[0].state, 'done');
  assert.equal(t.r.status().next.time, '14:00');
});

test('reminders: already trained since the last one → no reminder; late start fires only the latest', () => {
  const t = setup();
  t.at(9, 0); t.r.tick();
  t.train(5 * MIN); t.r.tick(); // 09:00 done
  t.train(6 * MIN); // trained again before 14:00
  t.at(14, 0);
  assert.equal(t.r.tick().fire, null);
  assert.equal(t.r.status().slots[1].state, 'done');

  // the minutes that completed 09:00 don't count again for 14:00
  const once = setup();
  once.at(9, 0); once.r.tick();
  once.train(5 * MIN); once.r.tick();
  once.at(14, 0);
  assert.equal(once.r.tick().fire?.time, '14:00');

  const late = setup();
  late.at(15, 30); // app opened mid-afternoon
  assert.equal(late.r.tick().fire.time, '14:00');
  assert.deepEqual(late.r.status().slots.map((x) => x.state), ['missed', 'due', 'upcoming']);
});

test('reminders: mandatory mode repeats until done; snoozes are limited', () => {
  const t = setup({ checkinMandatory: true, maxSnoozes: 1 });
  t.at(9, 0);
  assert.equal(t.r.tick().fire.mandatory, true);
  t.advance(5 * MIN);
  assert.equal(t.r.tick().fire, null, 'not yet');
  t.advance(5 * MIN);
  assert.deepEqual(t.r.tick().fire, { time: '09:00', mandatory: true, repeat: true });
  assert.equal(t.r.snooze('09:00').due.snoozesLeft, 0);
  assert.throws(() => t.r.snooze('09:00'), /No snoozes left/);
  t.advance(9 * MIN);
  assert.equal(t.r.tick().fire, null, 'snooze pushed the repeat back');
  t.advance(1 * MIN);
  assert.equal(t.r.tick().fire.repeat, true);
  t.train(5 * MIN);
  t.r.tick();
  t.advance(30 * MIN);
  assert.equal(t.r.tick().fire, null, 'done: no more repeats');
});

test('reminders: quiet hours, days off, turned off; a new day starts fresh', () => {
  assert.ok(inQuiet(23 * 60, '22:30', '07:00'));
  assert.ok(inQuiet(6 * 60, '22:30', '07:00'));
  assert.ok(!inQuiet(12 * 60, '22:30', '07:00'));
  assert.ok(inQuiet(13 * 60, '12:00', '14:00'));
  assert.ok(!inQuiet(13 * 60, '', ''));

  const q = setup({ reminderTimes: ['23:00'] });
  q.at(23, 5);
  assert.equal(q.r.tick().fire, null, 'quiet hours');

  const off = setup({ reminderDays: [0, 6] }); // weekends only; Oct 1 2026 is a Thursday
  off.at(9, 0);
  assert.equal(off.r.tick().fire, null);
  assert.equal(off.r.status().activeToday, false);

  const disabled = setup({ dailyReminder: false });
  disabled.at(9, 0);
  assert.equal(disabled.r.tick().fire, null);

  const t = setup();
  t.at(9, 0); t.r.tick();
  t.advance(24 * 60 * MIN);
  t.at(8, 0);
  assert.equal(t.r.status().slots.every((x) => x.state === 'upcoming'), true);
});

test('settings: reminder times are cleaned up; 1.0 settings keep their reminder time', () => {
  const s = new Store(null);
  assert.deepEqual(s.get().reminderTimes, ['19:00']);
  assert.equal(s.get().difficultyMode, 'adaptive');
  const out = s.set({ reminderTimes: ['18:00', '07:30', 'bad', '18:00'], reminderDays: [1, 9, 1, 'x', 5], reminderSound: 'nope', checkinMinutes: 0, quietStart: '' });
  assert.deepEqual(out.reminderTimes, ['07:30', '18:00']);
  assert.deepEqual(out.reminderDays, [1, 5]);
  assert.equal(out.reminderSound, 'chime');
  assert.equal(out.checkinMinutes, 1);
  assert.equal(out.quietStart, '');
  assert.deepEqual(s.set({ reminderTimes: Array.from({ length: 9 }, (_, i) => `1${i}:00`) }).reminderTimes.length, 6);

  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-store-'));
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ dailyReminder: true, dailyReminderTime: '08:15' }));
  const old = new Store(dir).get();
  assert.deepEqual(old.reminderTimes, ['08:15']);
  assert.equal(old.dailyReminder, true);
});
