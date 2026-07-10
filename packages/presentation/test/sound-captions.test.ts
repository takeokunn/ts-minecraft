import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  announceSoundCaption,
  setSoundCaptionsEnabled,
  SOUND_CAPTION_LABELS,
} from '../hud/sound-captions'

// Tests run in node environment (document === undefined).
// The DOM path is exercised via a stubbed global document.

type StubRow = {
  className: string
  textContent: string
  remove: () => void
  removed: boolean
}

const stubDocument = () => {
  const rows: StubRow[] = []
  const makeRow = (): StubRow => {
    const row: StubRow = {
      className: '',
      textContent: '',
      removed: false,
      remove: () => { row.removed = true },
    }
    return row
  }
  const doc = {
    createElement: () => {
      const row = makeRow()
      return row
    },
  }
  const container = {
    ownerDocument: doc,
    appendChild: (row: StubRow) => { rows.push(row) },
  }
  ;(globalThis as { document?: unknown }).document = {
    ...doc,
    getElementById: (id: string) => (id === 'sound-captions' ? container : null),
  }
  return { rows }
}

afterEach(() => {
  setSoundCaptionsEnabled(false) // also clears active rows between tests
  delete (globalThis as { document?: unknown }).document
  vi.useRealTimers()
})

describe('SOUND_CAPTION_LABELS', () => {
  it('has a non-empty label (or explicit null) for every effect', () => {
    for (const [effect, label] of Object.entries(SOUND_CAPTION_LABELS)) {
      if (label !== null) {
        expect(label.length, `label for ${effect}`).toBeGreaterThan(0)
      }
    }
  })
})

describe('announceSoundCaption — no DOM', () => {
  it('does not throw when document is undefined', () => {
    setSoundCaptionsEnabled(true)
    expect(() => announceSoundCaption('thunderClap')).not.toThrow()
  })
})

describe('announceSoundCaption — DOM', () => {
  it('does nothing while captions are disabled', () => {
    const { rows } = stubDocument()
    setSoundCaptionsEnabled(false)
    announceSoundCaption('thunderClap')
    expect(rows).toHaveLength(0)
  })

  it('appends a row with the effect label when enabled', () => {
    vi.useFakeTimers()
    const { rows } = stubDocument()
    setSoundCaptionsEnabled(true)
    announceSoundCaption('thunderClap')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.textContent).toBe('Thunder rumbles')
    expect(rows[0]!.className).toBe('sound-caption-row')
  })

  it('skips intentionally uncaptioned GUI sounds', () => {
    const { rows } = stubDocument()
    setSoundCaptionsEnabled(true)
    announceSoundCaption('inventoryOpen')
    expect(rows).toHaveLength(0)
  })

  it('refreshes the existing row for repeated cues instead of stacking', () => {
    vi.useFakeTimers()
    const { rows } = stubDocument()
    setSoundCaptionsEnabled(true)
    announceSoundCaption('footstepGrass')
    announceSoundCaption('footstepStone') // same "Footsteps" label
    announceSoundCaption('footstepGrass')
    expect(rows).toHaveLength(1)
  })

  it('expires rows after the display window', () => {
    vi.useFakeTimers()
    const { rows } = stubDocument()
    setSoundCaptionsEnabled(true)
    announceSoundCaption('playerHurt')
    vi.advanceTimersByTime(3000)
    expect(rows[0]!.removed).toBe(true)
  })

  it('evicts the oldest row beyond the cap', () => {
    vi.useFakeTimers()
    const { rows } = stubDocument()
    setSoundCaptionsEnabled(true)
    const distinct = ['blockBreak', 'blockPlace', 'playerHurt', 'entityHit', 'mobHurt', 'mobDeath'] as const
    for (const effect of distinct) announceSoundCaption(effect)
    expect(rows).toHaveLength(6)
    expect(rows[0]!.removed).toBe(true) // oldest evicted to stay within 5 visible
    expect(rows[5]!.removed).toBe(false)
  })

  it('clears all rows when captions are turned off', () => {
    vi.useFakeTimers()
    const { rows } = stubDocument()
    setSoundCaptionsEnabled(true)
    announceSoundCaption('playerHurt')
    announceSoundCaption('mobDeath')
    setSoundCaptionsEnabled(false)
    expect(rows.every((row) => row.removed)).toBe(true)
  })
})
