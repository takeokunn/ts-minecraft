import { Effect, MutableRef, Option } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { KeyMappings } from '@ts-minecraft/entity/domain/key-mappings'
import { resolveJumpExhaustion, resolveMovementExhaustionRate } from './movement-logic'
import { applySurvivalMovementAndHunger } from './movement'

describe('physics-stage-survival/movement', () => {
  it('applies movement and jump exhaustion and returns the derived movement state', async () => {
    const addExhaustion = vi.fn(() => Effect.void)
    const applyDamage = vi.fn(() => Effect.succeed(true))
    const getHealth = vi.fn(() => Effect.succeed({ current: 18, max: 20 }))
    const getHunger = vi.fn(() => Effect.succeed({ foodLevel: 20 }))
    const heal = vi.fn(() => Effect.void)
    const healthTick = vi.fn(() => Effect.void)
    const hungerTick = vi.fn(() => Effect.succeed('none' as never))
    const isCreative = vi.fn(() => Effect.succeed(false))
    const isKeyPressed = vi.fn((key: string) =>
      Effect.succeed(key === KeyMappings.SPRINT || key === KeyMappings.MOVE_FORWARD),
    )
    const fishingTick = vi.fn(() => Effect.succeed(Option.none()))
    const addBlock = vi.fn(() => Effect.void)
    const playEffect = vi.fn(() => Effect.void)

    const services = {
      gameMode: { isCreative },
      healthService: { tick: healthTick, getHealth, heal },
      hungerService: { getHunger, addExhaustion, tick: hungerTick },
      inputService: { isKeyPressed },
      fishingService: { tick: fishingTick },
      inventoryService: { addBlock },
      soundManager: { playEffect },
    } as never
    const refs = {
      healthTickAccumulatorRef: MutableRef.make(0),
      hungerTickAccumulatorRef: MutableRef.make(0),
      wasGroundedRef: MutableRef.make(true),
    } as never
    const inputs = {
      deltaTime: 0,
      difficulty: 'normal',
      initialPlayerPos: { x: 0, y: 64, z: 0 },
    } as never

    const result = await Effect.runPromise(
      applySurvivalMovementAndHunger(
        services,
        refs,
        inputs,
        { x: 3, y: 64, z: 4 },
        false,
        applyDamage,
      ),
    )

    expect(result).toEqual({
      inCreative: false,
      isGrounded: false,
      isSprinting: true,
      isSneaking: false,
      distanceMoved: 5,
    })
    expect(healthTick).toHaveBeenCalledOnce()
    expect(getHealth).toHaveBeenCalledOnce()
    expect(getHunger).toHaveBeenCalledOnce()
    expect(isCreative).toHaveBeenCalledOnce()
    expect(isKeyPressed).toHaveBeenCalledTimes(4)
    expect(fishingTick).toHaveBeenCalledWith(0)
    expect(addBlock).not.toHaveBeenCalled()
    expect(playEffect).not.toHaveBeenCalled()
    expect(applyDamage).not.toHaveBeenCalled()
    expect(addExhaustion).toHaveBeenNthCalledWith(1, 5 * resolveMovementExhaustionRate(true))
    expect(addExhaustion).toHaveBeenNthCalledWith(2, resolveJumpExhaustion(true))
    expect(MutableRef.get(refs.wasGroundedRef)).toBe(false)
  })
})
