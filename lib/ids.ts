// No 0/O, 1/l/I: ids stay readable if someone types one from a screen.
const ALPHABET = "23456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ"; // 57 chars
export const PASSPORT_ID_LENGTH = 12; // 57^12 ≈ 2^70 possibilities

/** Unbiased random string from ALPHABET (rejection sampling). */
export function randomId(length = PASSPORT_ID_LENGTH): string {
  const limit = 256 - (256 % ALPHABET.length);
  let out = "";
  while (out.length < length) {
    for (const b of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (b < limit && out.length < length) out += ALPHABET[b % ALPHABET.length];
    }
  }
  return out;
}

export function isPassportId(x: unknown): x is string {
  return typeof x === "string" && x.length === PASSPORT_ID_LENGTH && [...x].every((c) => ALPHABET.includes(c));
}

/** Secret that lets the creator's browser edit its passport. */
export function randomEditKey(): string {
  return randomId(32);
}
