import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'

import { readSessionHudElements } from '@ts-minecraft/app/main/session-runtime-deps/hud'

describe('session-runtime-deps/hud', () => {
  it('reads the session hud elements from the canonical DOM ids', () => {
    const getElementById = vi.fn(() => null)
    vi.stubGlobal('document', { getElementById })
    const elements = readSessionHudElements()

    expect(elements.fpsElement).toBeNull()
    expect(elements.healthValueElement).toBeNull()
    expect(elements.healthMaxElement).toBeNull()
    expect(elements.hungerValueElement).toBeNull()
    expect(elements.hungerMaxElement).toBeNull()
    expect(elements.xpLevelElement).toBeNull()
    expect(elements.xpBarElement).toBeNull()
    expect(elements.xpBarMaxElement).toBeNull()
    expect(elements.armorValueElement).toBeNull()
    expect(elements.airElement).toBeNull()
    expect(elements.breakProgressElement).toBeNull()

    expect(getElementById).toHaveBeenCalledWith('fps-value')
    expect(getElementById).toHaveBeenCalledWith('health-value')
    expect(getElementById).toHaveBeenCalledWith('health-max')
    expect(getElementById).toHaveBeenCalledWith('hunger-value')
    expect(getElementById).toHaveBeenCalledWith('hunger-max')
    expect(getElementById).toHaveBeenCalledWith('xp-level')
    expect(getElementById).toHaveBeenCalledWith('xp-bar')
    expect(getElementById).toHaveBeenCalledWith('xp-bar-max')
    expect(getElementById).toHaveBeenCalledWith('armor-value')
    expect(getElementById).toHaveBeenCalledWith('air-display')
    expect(getElementById).toHaveBeenCalledWith('break-progress')
  })
})
