import { describe, expect, it, vi } from 'vitest'
import { Effect } from 'effect'
import { applyDamageAndPlayHurt, playHurtIfDamaged } from './feedback'

describe('physics-stage-survival/feedback', () => {
  it('plays playerHurt only when damage was applied', async () => {
    const playEffect = vi.fn(() => Effect.void)
    const services = { soundManager: { playEffect } }
    const position = { x: 12, y: 64, z: -8 }

    await Effect.runPromise(playHurtIfDamaged(services, position, true))
    expect(playEffect).toHaveBeenCalledOnce()
    expect(playEffect).toHaveBeenCalledWith('playerHurt', { position })

    playEffect.mockClear()

    await Effect.runPromise(playHurtIfDamaged(services, position, false))
    expect(playEffect).not.toHaveBeenCalled()
  })

  it('delegates damage application before playing hurt feedback', async () => {
    const playEffect = vi.fn(() => Effect.void)
    const services = { soundManager: { playEffect } }
    const position = { x: 1, y: 2, z: 3 }
    const applyDamage = vi.fn((amount: number) => Effect.succeed(amount > 0))

    await Effect.runPromise(applyDamageAndPlayHurt(services, position, applyDamage, 4))

    expect(applyDamage).toHaveBeenCalledOnce()
    expect(applyDamage).toHaveBeenCalledWith(4)
    expect(playEffect).toHaveBeenCalledOnce()
    expect(playEffect).toHaveBeenCalledWith('playerHurt', { position })
  })
})
