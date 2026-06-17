import { Effect } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { makeFurnaceService } from '../../test/frame-handler-test-kit'
import { runFurnaceMaintenance } from './frame-maintenance-furnace'

describe('runFurnaceMaintenance', () => {
  it('ticks the furnace service with the maintenance delta time', async () => {
    const tick = vi.fn(() => Effect.void)
    const furnaceService = makeFurnaceService()
    furnaceService.tick = tick

    await Effect.runPromise(runFurnaceMaintenance({ furnaceService }, 0.25 as never))

    expect(tick).toHaveBeenCalledOnce()
    expect(tick).toHaveBeenCalledWith(0.25)
  })

  it('swallows failures from the furnace service', async () => {
    const tick = vi.fn(() => Effect.fail(new Error('boom')))
    const furnaceService = makeFurnaceService()
    furnaceService.tick = tick

    const result = await Effect.runPromise(runFurnaceMaintenance({ furnaceService }, 1 as never))

    expect(result).toBeUndefined()
  })

  it('swallows defects from the furnace service', async () => {
    const tick = vi.fn(() => Effect.die('fatal'))
    const furnaceService = makeFurnaceService()
    furnaceService.tick = tick

    const result = await Effect.runPromise(runFurnaceMaintenance({ furnaceService }, 1 as never))

    expect(result).toBeUndefined()
  })
})
