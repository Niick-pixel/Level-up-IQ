// Mind Gym's own sounds, synthesized with the Web Audio API (no audio files, works offline).
// Reminder sounds: chime, bell, marimba, soft. Game tones: tone(i) for Simon and friends.

let ctx = null;
function audio() {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/** One note: frequency (Hz), start offset and length (s), peak gain, waveform, partials. */
function note(ac, out, { f, at = 0, len = 1, gain = 0.3, type = 'sine', partials = [[1, 1]], attack = 0.005 }) {
  const t0 = ac.currentTime + at;
  for (const [mult, amp] of partials) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.value = f * mult;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain * amp, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    osc.connect(g).connect(out);
    osc.start(t0);
    osc.stop(t0 + len + 0.05);
  }
}

// Each sound is a short phrase; all end within ~2 seconds.
const SOUNDS = {
  // three rising notes of a major chord, glassy
  chime: (ac, out) => [523.25, 659.25, 783.99].forEach((f, i) => note(ac, out, { f, at: i * 0.16, len: 1.4, gain: 0.22, partials: [[1, 1], [2, 0.25], [3, 0.08]] })),
  // a struck bell: inharmonic partials, long decay, played twice
  bell: (ac, out) => [0, 0.9].forEach((at) => note(ac, out, { f: 660, at, len: 1.8, gain: 0.25, partials: [[1, 1], [2.76, 0.4], [5.4, 0.2], [8.93, 0.1]] })),
  // a wooden marimba figure
  marimba: (ac, out) => [392, 523.25, 659.25, 523.25].forEach((f, i) => note(ac, out, { f, at: i * 0.13, len: 0.5, gain: 0.3, partials: [[1, 1], [4, 0.2], [10, 0.05]], attack: 0.002 })),
  // two gentle low notes
  soft: (ac, out) => [349.23, 440].forEach((f, i) => note(ac, out, { f, at: i * 0.35, len: 1.6, gain: 0.18, type: 'triangle', attack: 0.08 })),
  none: () => {},
};

export const SOUND_NAMES = ['chime', 'bell', 'marimba', 'soft', 'none'];

/** Plays a reminder sound at a volume from 0 to 1. Never throws. */
export function playSound(name = 'chime', volume = 0.7) {
  try {
    if (name === 'none' || volume <= 0) return;
    const ac = audio();
    const master = ac.createGain();
    master.gain.value = Math.min(1, Math.max(0, volume));
    master.connect(ac.destination);
    (SOUNDS[name] || SOUNDS.chime)(ac, master);
  } catch { /* no audio device: stay silent */ }
}

// Game tones: a pentatonic scale, so any sequence sounds pleasant.
const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99];

/** A short tone for pad i (Simon). */
export function tone(i, { len = 0.35, volume = 0.5 } = {}) {
  try {
    const ac = audio();
    const master = ac.createGain();
    master.gain.value = volume;
    master.connect(ac.destination);
    note(ac, master, { f: SCALE[i % SCALE.length], len, gain: 0.35, type: 'triangle', attack: 0.01 });
  } catch { /* silent */ }
}

/** A low buzz for a mistake. */
export function buzz(volume = 0.4) {
  try {
    const ac = audio();
    const master = ac.createGain();
    master.gain.value = volume;
    master.connect(ac.destination);
    note(ac, master, { f: 110, len: 0.45, gain: 0.25, type: 'sawtooth', attack: 0.01 });
  } catch { /* silent */ }
}
