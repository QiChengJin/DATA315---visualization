export const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

export const CHORD_TYPES = [
  'maj','min','dim','aug','sus2','sus4',
  'maj7','min7','dom7','dim7','hdim7','min-maj7','maj6','min6','aug7'
];

export const KEY_LABELS = [
  ...NOTE_NAMES.map(n => `${n} maj`),
  ...NOTE_NAMES.map(n => `${n} min`),
  'other'
];

export const VALIDITY_LABELS = ['invalid','basic chord','suspended','other'];

// Chromatic color per root note — evenly spaced on hue wheel
export const ROOT_COLORS = NOTE_NAMES.map((_, i) =>
  `hsl(${Math.round((i / 12) * 360)}, 70%, 55%)`
);

// Neutral chord-type colors (categorical)
export const TYPE_COLORS = [
  '#4e79a7','#f28e2b','#e15759','#76b7b2','#59a14f',
  '#edc948','#b07aa1','#ff9da7','#9c755f','#bab0ac',
  '#54a0b5','#8cd17d','#b6992d','#499894','#86bcb6'
];

export function softmax(logits) {
  const max = Math.max(...logits);
  const exps = logits.map(x => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(x => x / sum);
}

export function topK(probs, labels, k = 3) {
  return probs
    .map((p, i) => ({ p, label: labels[i], i }))
    .sort((a, b) => b.p - a.p)
    .slice(0, k);
}
