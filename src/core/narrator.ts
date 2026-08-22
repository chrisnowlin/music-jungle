/**
 * narrator.ts — speechSynthesis wrapper (progressive enhancement).
 * Safe knobs: rate/pitch. The game must stay completable when this is absent.
 */
let enabled = true;
let supported = 'speechSynthesis' in window;
const queue: string[] = [];

export function narratorSupported(): boolean {
  return supported;
}

export function setNarration(on: boolean): void {
  enabled = on;
  if (!on) cancel();
}

export function narrationEnabled(): boolean {
  return enabled && supported;
}

// ChromeOS: voices load async; touch getVoices to warm it.
if (supported) {
  void window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    void window.speechSynthesis.getVoices();
  };
}

export function speak(text: string, opts: { rate?: number; pitch?: number } = {}): void {
  if (!narrationEnabled() || !text) return;
  cancel();
  // chunk long text — some engines cut off long utterances
  const chunks = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  for (const raw of chunks.slice(0, 4)) {
    const u = new SpeechSynthesisUtterance(raw.trim());
    u.rate = opts.rate ?? 0.95;
    u.pitch = opts.pitch ?? 1.1;
    window.speechSynthesis.speak(u);
  }
  queue.length = 0;
}

/** Speak without cancelling what is already queued (short labels). */
export function say(text: string): void {
  if (!narrationEnabled() || !text) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}

export function cancel(): void {
  if (supported) window.speechSynthesis.cancel();
}
