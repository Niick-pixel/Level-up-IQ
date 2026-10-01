// Reminders and check-ins: a few times a day, Mind Gym reminds you to train, with its own sound.
//
// Each reminder time is a "slot". When a slot comes due, it fires (a notification plus a sound
// played by the window). A slot counts as done once you've trained for the check-in length
// (any game, review or keyword session counts) after it fired. If you already trained that long
// since the previous slot, it's done without bothering you.
//
// Gentle mode fires once. Mandatory mode brings the window forward with the check-in and keeps
// coming back every few minutes until it's done; you can snooze a limited number of times.
// When a newer slot comes due, an older unfinished one is marked missed (no pile-up), and
// nothing fires during quiet hours.
const path = require('path');
const { readJson, writeJson } = require('./json-file');

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

/** Is this minute-of-day inside quiet hours (which may wrap past midnight)? */
function inQuiet(min, start, end) {
  if (!TIME.test(start || '') || !TIME.test(end || '') || start === end) return false;
  const a = toMin(start);
  const b = toMin(end);
  return a < b ? min >= a && min < b : min >= a || min < b;
}

class Reminders {
  /**
   * @param {string|null} dir
   * @param {{ now?: () => number, dateKey: (ms) => string, getSettings: () => object, todayMs: () => number }} deps
   */
  constructor(dir, deps) {
    this.file = dir ? path.join(dir, 'reminders.json') : null;
    this.deps = deps;
    this.now = deps.now || Date.now;
    this.state = readJson(this.file, { day: null, slots: {} });
  }

  #save() {
    writeJson(this.file, this.state);
  }

  #times(s) {
    return [...new Set((s.reminderTimes || []).filter((t) => TIME.test(t)))].sort();
  }

  #roll(day) {
    if (this.state.day !== day) this.state = { day, slots: {} };
  }

  #goalMs(s) {
    return Math.max(1, s.checkinMinutes || 5) * 60 * 1000;
  }

  /** Minutes-of-day and date info for now. */
  #clock() {
    const t = this.now();
    const d = new Date(t);
    return { t, day: this.deps.dateKey(t), min: d.getHours() * 60 + d.getMinutes(), weekday: d.getDay() };
  }

  /**
   * Called every ~30 s. Returns what to do now: { fire: { time, mandatory, repeat } | null }.
   */
  tick() {
    const s = this.deps.getSettings();
    const c = this.#clock();
    this.#roll(c.day);
    if (!s.dailyReminder) return { fire: null };
    const days = Array.isArray(s.reminderDays) ? s.reminderDays : [0, 1, 2, 3, 4, 5, 6];
    if (!days.includes(c.weekday)) return { fire: null };

    const today = this.deps.todayMs();
    const goal = this.#goalMs(s);
    const due = this.#times(s).filter((t) => toMin(t) <= c.min);
    let changed = false;
    let prevBase = 0;
    // settle what's due: done, missed, or "already trained enough since the last one"
    due.forEach((t, i) => {
      const slot = (this.state.slots[t] ||= {});
      if (slot.firedAt && !slot.done && today - slot.baseMs >= goal) { slot.done = true; slot.doneMs = today; changed = true; }
      if (!slot.firedAt && !slot.done && !slot.missed && today - prevBase >= goal) {
        slot.done = true; // you already trained since the previous check-in
        slot.early = true;
        slot.doneMs = today;
        changed = true;
      }
      if (i < due.length - 1 && !slot.done && !slot.missed) { slot.missed = true; changed = true; }
      // training only counts once: the next check-in measures from when this one was completed
      prevBase = slot.doneMs ?? slot.baseMs ?? prevBase;
    });

    let fire = null;
    const latest = due.at(-1);
    const slot = latest && this.state.slots[latest];
    if (slot && !slot.done && !slot.missed && !inQuiet(c.min, s.quietStart, s.quietEnd)) {
      const every = Math.max(1, s.snoozeMinutes || 10) * 60 * 1000;
      if (!slot.firedAt) {
        Object.assign(slot, { firedAt: c.t, lastFireAt: c.t, baseMs: today, snoozes: 0 });
        fire = { time: latest, mandatory: Boolean(s.checkinMandatory), repeat: false };
      } else if (s.checkinMandatory && c.t - slot.lastFireAt >= every) {
        slot.lastFireAt = c.t;
        fire = { time: latest, mandatory: true, repeat: true };
      }
      if (fire) changed = true;
    }
    if (changed) this.#save();
    return { fire };
  }

  /** Puts off the current check-in until the next repeat (mandatory mode limits how often). */
  snooze(time) {
    const s = this.deps.getSettings();
    const slot = this.state.slots[time];
    if (!slot?.firedAt || slot.done || slot.missed) return this.status();
    const max = s.checkinMandatory ? Math.max(0, s.maxSnoozes ?? 2) : Infinity;
    if ((slot.snoozes || 0) >= max) throw new Error('No snoozes left for this check-in.');
    slot.snoozes = (slot.snoozes || 0) + 1;
    slot.lastFireAt = this.now();
    this.#save();
    return this.status();
  }

  /** For the UI: today's slots, the check-in that's due (if any) and the next one. */
  status() {
    const s = this.deps.getSettings();
    const c = this.#clock();
    this.#roll(c.day);
    const today = this.deps.todayMs();
    const goal = this.#goalMs(s);
    const days = Array.isArray(s.reminderDays) ? s.reminderDays : [0, 1, 2, 3, 4, 5, 6];
    const activeToday = Boolean(s.dailyReminder) && days.includes(c.weekday);
    const slots = this.#times(s).map((time) => {
      const x = this.state.slots[time] || {};
      const state = x.done ? 'done' : x.missed ? 'missed' : x.firedAt ? 'due' : toMin(time) <= c.min ? 'due' : 'upcoming';
      const doneMs = x.firedAt ? Math.max(0, today - x.baseMs) : 0;
      return {
        time,
        state,
        progress: state === 'done' ? 1 : Math.min(1, doneMs / goal),
        snoozesLeft: s.checkinMandatory ? Math.max(0, (s.maxSnoozes ?? 2) - (x.snoozes || 0)) : null,
      };
    });
    const due = activeToday ? slots.find((x) => x.state === 'due') || null : null;
    const next = activeToday ? slots.find((x) => x.state === 'upcoming') || null : null;
    return {
      enabled: Boolean(s.dailyReminder),
      activeToday,
      mandatory: Boolean(s.checkinMandatory),
      minutes: s.checkinMinutes || 5,
      slots: activeToday ? slots : [],
      due,
      next,
      quiet: inQuiet(c.min, s.quietStart, s.quietEnd),
    };
  }
}

module.exports = { Reminders, inQuiet, TIME };
