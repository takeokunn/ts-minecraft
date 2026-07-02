export const MAX_WORLD_SEED_VALUE = 0xffffffff

const SIGNED_INTEGER_PATTERN = /^-?\d+$/

export const hashWorldSeedString = (input: string): number => {
  let hash = 0x811c9dc5

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }

  return hash >>> 0
}

export const parseWorldSeedInput = (input: string): number | undefined => {
  const trimmed = input.trim()
  if (trimmed.length === 0) return undefined

  if (SIGNED_INTEGER_PATTERN.test(trimmed)) {
    const numeric = Number(trimmed)
    if (Number.isSafeInteger(numeric)) return numeric >>> 0
  }

  return hashWorldSeedString(trimmed)
}
