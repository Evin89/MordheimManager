/**
 * A dice-rattle sound for the roller (§20.1), synthesised with the Web Audio
 * API rather than shipped as an audio file — the same dependency-free, works-
 * offline stance as the canvas cards: no binary asset, no licensing, no CDN.
 *
 * The rattle is a handful of short filtered noise bursts spread across the roll
 * window (each a die clacking on the table), pitched and timed at random so no
 * two rolls sound identical, and scaled a little by how many dice are thrown.
 */

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

/** Lazily made and resumed inside the roll click, which is the user gesture
 * browsers require before audio may play. Null when audio is unavailable. */
function context(): AudioContext | null {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** One short white-noise buffer, reused as the source for every clack. */
function noiseBuffer(c: AudioContext): AudioBuffer {
  if (noise) return noise;
  const len = Math.floor(c.sampleRate * 0.08);
  noise = c.createBuffer(1, len, c.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
  return noise;
}

const KEY = 'mordheim.diceSound';

/** Default on — the player asked for the sound; the toggle turns it off. */
export function diceSoundEnabled(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
}

export function setDiceSoundEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* preference only */
  }
}

/** Plays the rattle for a roll of `diceCount` dice across the tumble window
 * (`durationMs`). No-op when muted or when the browser has no audio. */
export function playDiceRoll(diceCount: number, durationMs = 500): void {
  if (!diceSoundEnabled()) return;
  const c = context();
  if (!c) return;

  const buf = noiseBuffer(c);
  const spread = (durationMs / 1000) * 0.92; // rattle over most of the tumble
  // ~11 clacks a second, plus a little per die; capped so a long roll of many
  // dice can't schedule an absurd number of nodes.
  const clacks = Math.min(48, Math.round(spread * 11) + diceCount * 2);
  const now = c.currentTime;

  for (let i = 0; i < clacks; i += 1) {
    const t = now + Math.random() * spread;
    const dur = 0.025 + Math.random() * 0.03;

    const src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 0.8 + Math.random() * 0.6;

    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 700 + Math.random() * 1500;
    filter.Q.value = 1.1;

    const gain = c.createGain();
    const peak = 0.09 + Math.random() * 0.07;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
}
