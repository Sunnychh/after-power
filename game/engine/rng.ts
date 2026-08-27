export function normalizeSeed(seed: number | string): number {
  if (typeof seed === 'number' && Number.isFinite(seed)) return (seed >>> 0) || 1;
  let value = 2166136261;
  for (const char of String(seed)) {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0) || 1;
}

export function nextRandom(state: number): { value: number; state: number } {
  let next = state >>> 0;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  next >>>= 0;
  return { value: next / 4294967296, state: next || 1 };
}

export function randomInt(state: number, min: number, max: number): { value: number; state: number } {
  const next = nextRandom(state);
  return { value: Math.floor(next.value * (max - min + 1)) + min, state: next.state };
}

export function seededPick<T>(state: number, values: T[]): { value: T; state: number } {
  const next = randomInt(state, 0, Math.max(0, values.length - 1));
  return { value: values[next.value], state: next.state };
}
