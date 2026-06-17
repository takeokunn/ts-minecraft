import { Effect, Option } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { handleFishingCatch } from './fishing'

describe('physics-stage-survival/fishing', () => {
  it('adds caught items and plays a sound when fishing produces a catch', async () => {
    const addBlock = vi.fn(() => Effect.void)
    const playEffect = vi.fn(() => Effect.void)
    const tick = vi.fn(() => Effect.succeed(Option.some('COD' as never)))
    const services = {
      fishingService: { tick },
      inventoryService: { addBlock },
      soundManager: { playEffect },
    }

    await Effect.runPromise(handleFishingCatch(services, { x: 4, y: 65, z: -2 }, 0.5))

    expect(tick).toHaveBeenCalledOnce()
    expect(addBlock).toHaveBeenCalledWith('COD', 1)
    expect(playEffect).toHaveBeenCalledWith('blockPlace', { position: { x: 4, y: 65, z: -2 } })
  })

  it('does nothing when fishing has no catch', async () => {
    const addBlock = vi.fn(() => Effect.void)
    const playEffect = vi.fn(() => Effect.void)
    const tick = vi.fn(() => Effect.succeed(Option.none()))
    const services = {
      fishingService: { tick },
      inventoryService: { addBlock },
      soundManager: { playEffect },
    }

    await Effect.runPromise(handleFishingCatch(services, { x: 4, y: 65, z: -2 }, 0.5))

    expect(tick).toHaveBeenCalledOnce()
    expect(addBlock).not.toHaveBeenCalled()
    expect(playEffect).not.toHaveBeenCalled()
  })
})
