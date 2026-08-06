const PALETTE = ['#4338CA', '#0E7490', '#B45309', '#15803D', '#7C3AED', '#BE123C', '#0F766E', '#A16207'];
const cache = new Map();

export function studyColor(name) {
  if (!cache.has(name)) {
    cache.set(name, PALETTE[cache.size % PALETTE.length]);
  }
  return cache.get(name);
}

export function primeStudyColors(studies) {
  studies.forEach((s) => studyColor(s.name));
}
