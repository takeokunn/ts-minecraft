import { Effect } from 'effect'
import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'

import type { Settings } from '@ts-minecraft/game'
import { resolvePreset } from '@ts-minecraft/game/application/settings-service.config'
import { buildSessionBootstrapStartupState } from '@ts-minecraft/app/main/session-bootstrap/startup'

const createSessionControlSpy = vi.fn()
const control = { tag: 'control' } as never

vi.mock('@ts-minecraft/app/main/session-control', () => ({
  createSessionControl: Effect.sync(() => {
    createSessionControlSpy()
    return control
  }),
}))

describe('session-bootstrap-startup', () => {
  it('creates the control and resolves the initial settings bundle once', async () => {
    const settings: Settings = {
      graphicsQuality: 'high',
      renderDistance: 12,
      dayLengthSeconds: 1200,
    }
    const settingsService = {
      getSettings: vi.fn(() => Effect.succeed(settings)),
    } as never

    const result = await Effect.runPromise(buildSessionBootstrapStartupState({ settingsService }))

    expect(createSessionControlSpy).toHaveBeenCalledOnce()
    expect(settingsService.getSettings).toHaveBeenCalledOnce()
    expect(result.control).toBe(control)
    expect(result.initialSettings).toBe(settings)
    expect(result.initialGraphics).toEqual(resolvePreset(settings.graphicsQuality))
  })
})
