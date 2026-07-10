import type { SoundEffect } from '@ts-minecraft/game'

// Sound-cue captions (hearing accessibility): a small self-expiring text stack
// mirroring every gameplay sound cue, so no critical information is conveyed
// by audio alone. Rows live in the static #sound-captions container (index.html).
const CAPTION_DISPLAY_MS = 2500
const MAX_CAPTION_ROWS = 5

// null = intentionally uncaptioned: GUI feedback clicks carry no gameplay
// information (vanilla subtitles skip UI sounds too).
export const SOUND_CAPTION_LABELS = {
  blockBreak: 'Block breaks',
  blockPlace: 'Block placed',
  playerHurt: 'You were hurt',
  entityHit: 'Attack lands',
  mobHurt: 'Mob hurts',
  mobDeath: 'Mob dies',
  enchant: 'Item enchanted',
  inventoryOpen: null,
  inventoryClose: null,
  itemPickup: 'Item picked up',
  footstepGrass: 'Footsteps',
  footstepStone: 'Footsteps',
  footstepWood: 'Footsteps',
  rainAmbient: 'Rain falls',
  thunderClap: 'Thunder rumbles',
  levelUp: 'Level up!',
  achievementUnlock: 'Achievement unlocked',
} satisfies Record<SoundEffect, string | null>

type CaptionRow = { el: HTMLElement; timer: ReturnType<typeof setTimeout> }

let captionsEnabled = false
const activeRows = new Map<string, CaptionRow>()

const removeRow = (label: string): void => {
  const row = activeRows.get(label)
  if (row === undefined) return
  clearTimeout(row.timer)
  row.el.remove()
  activeRows.delete(label)
}

export const setSoundCaptionsEnabled = (enabled: boolean): void => {
  captionsEnabled = enabled
  if (enabled) return
  // Deleting the current key during Map iteration is spec-safe.
  for (const [label, row] of activeRows) {
    clearTimeout(row.timer)
    row.el.remove()
    activeRows.delete(label)
  }
}

export const announceSoundCaption = (effect: SoundEffect): void => {
  if (!captionsEnabled) return
  /* c8 ignore next */
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return
  const container = document.getElementById('sound-captions')
  if (container === null) return
  const label = SOUND_CAPTION_LABELS[effect]
  if (label === null) return

  // Repeated cues (footsteps, rain) refresh their row's timer instead of stacking.
  const existing = activeRows.get(label)
  if (existing !== undefined) {
    clearTimeout(existing.timer)
    existing.timer = setTimeout(() => removeRow(label), CAPTION_DISPLAY_MS)
    return
  }

  if (activeRows.size >= MAX_CAPTION_ROWS) {
    // Map iterates in insertion order — the first key is the oldest row.
    const oldest = activeRows.keys().next()
    if (!oldest.done) removeRow(oldest.value)
  }

  const row = container.ownerDocument.createElement('div')
  row.className = 'sound-caption-row'
  row.textContent = label
  container.appendChild(row)
  activeRows.set(label, { el: row, timer: setTimeout(() => removeRow(label), CAPTION_DISPLAY_MS) })
}
