import { Effect, MutableRef } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import {
  CACTUS_DAMAGE,
  FIRE_DAMAGE,
  LAVA_DAMAGE,
  LAVA_BURN_DURATION_SECS,
  LIGHTNING_DAMAGE,
  LIGHTNING_DAMAGE_INTERVAL_SECS,
  SUFFOCATION_DAMAGE,
  VOID_DAMAGE,
  VOID_DAMAGE_INTERVAL_SECS,
  VOID_DAMAGE_Y,
} from '@ts-minecraft/entity/domain/environment-hazard.config'
import { applySurvivalHazardEffects } from './environment-hazards'
import type { SurvivalMovementState } from './types'
import { makeDefaultInputs, makeDefaultRefs, makeDefaultServices } from './test-builders'

describe('physics-stage-survival/environment-hazards', () => {
  it('applies cadenced hazard damage for lava, suffocation, and the void', async () => {
    const services = makeDefaultServices()
    const refs = makeDefaultRefs(10, 10)
    const damageCalls: number[] = []
    const applyDamage = (damage: number) => {
      damageCalls.push(damage)
      return Effect.succeed(true)
    }
    const movement: SurvivalMovementState = {
      distanceMoved: 0,
      inCreative: false,
      isGrounded: false,
      isSneaking: false,
      isSprinting: false,
    }
    const refreshedPos = { x: 0, y: VOID_DAMAGE_Y - 1, z: 0 }

    await Effect.runPromise(
      applySurvivalHazardEffects(
        services,
        refs,
        makeDefaultInputs(VOID_DAMAGE_INTERVAL_SECS),
        refreshedPos,
        movement,
        'LAVA',
        'STONE',
        false,
        false,
        applyDamage,
      ),
    )

    expect(damageCalls).toEqual([LAVA_DAMAGE, SUFFOCATION_DAMAGE, VOID_DAMAGE])
    expect((services.soundManager.playEffect as ReturnType<typeof vi.fn>).mock.calls).toEqual([
      ['playerHurt', { position: refreshedPos }],
      ['playerHurt', { position: refreshedPos }],
      ['playerHurt', { position: refreshedPos }],
    ])
    expect(MutableRef.get(refs.lavaDamageSecsRef)).toBe(0)
    expect(MutableRef.get(refs.suffocationDamageSecsRef)).toBe(0)
    expect(MutableRef.get(refs.voidDamageSecsRef)).toBe(0)
  })

  it('applies cactus contact damage immediately in survival', async () => {
    const services = makeDefaultServices()
    const refs = makeDefaultRefs(10, 10)
    const damageCalls: number[] = []
    const applyDamage = (damage: number) => {
      damageCalls.push(damage)
      return Effect.succeed(true)
    }
    const movement: SurvivalMovementState = {
      distanceMoved: 0,
      inCreative: false,
      isGrounded: false,
      isSneaking: false,
      isSprinting: false,
    }
    const refreshedPos = { x: 1, y: 64, z: 1 }

    await Effect.runPromise(
      applySurvivalHazardEffects(
        services,
        refs,
        makeDefaultInputs(0),
        refreshedPos,
        movement,
        'AIR',
        'AIR',
        true,
        false,
        applyDamage,
      ),
    )

    expect(damageCalls).toEqual([CACTUS_DAMAGE])
    expect((services.soundManager.playEffect as ReturnType<typeof vi.fn>).mock.calls).toEqual([
      ['playerHurt', { position: refreshedPos }],
    ])
  })

  it('keeps burning briefly after leaving lava', async () => {
    const services = makeDefaultServices()
    const refs = makeDefaultRefs(10, 10)
    const damageCalls: number[] = []
    const applyDamage = (damage: number) => {
      damageCalls.push(damage)
      return Effect.succeed(true)
    }
    const movement: SurvivalMovementState = {
      distanceMoved: 0,
      inCreative: false,
      isGrounded: false,
      isSneaking: false,
      isSprinting: false,
    }
    const refreshedPos = { x: 1, y: 64, z: 1 }

    await Effect.runPromise(
      applySurvivalHazardEffects(
        services,
        refs,
        makeDefaultInputs(0.5),
        refreshedPos,
        movement,
        'LAVA',
        'AIR',
        false,
        false,
        applyDamage,
      ),
    )

    await Effect.runPromise(
      applySurvivalHazardEffects(
        services,
        refs,
        makeDefaultInputs(1),
        refreshedPos,
        movement,
        'AIR',
        'AIR',
        false,
        false,
        applyDamage,
      ),
    )

    expect(damageCalls).toEqual([LAVA_DAMAGE, FIRE_DAMAGE])
    expect(MutableRef.get(refs.lavaBurnRemainingSecsRef)).toBe(LAVA_BURN_DURATION_SECS - 1)
  })

  it('clears post-lava burn state in creative', async () => {
    const services = makeDefaultServices()
    const refs = makeDefaultRefs(10, 10)
    MutableRef.set(refs.lavaBurnRemainingSecsRef, 4)
    MutableRef.set(refs.lavaBurnDamageSecsRef, 0.5)
    const damageCalls: number[] = []
    const applyDamage = (damage: number) => {
      damageCalls.push(damage)
      return Effect.succeed(true)
    }
    const movement: SurvivalMovementState = {
      distanceMoved: 0,
      inCreative: true,
      isGrounded: false,
      isSneaking: false,
      isSprinting: false,
    }
    const refreshedPos = { x: 1, y: 64, z: 1 }

    await Effect.runPromise(
      applySurvivalHazardEffects(
        services,
        refs,
        makeDefaultInputs(1),
        refreshedPos,
        movement,
        'AIR',
        'AIR',
        false,
        false,
        applyDamage,
      ),
    )

    expect(damageCalls).toEqual([])
    expect(MutableRef.get(refs.lavaBurnRemainingSecsRef)).toBe(0)
    expect(MutableRef.get(refs.lavaBurnDamageSecsRef)).toBe(0)
  })

  it('applies cadenced lightning damage while thunder sky exposure is active', async () => {
    const services = makeDefaultServices()
    const refs = makeDefaultRefs(10, 10)
    const damageCalls: number[] = []
    const applyDamage = (damage: number) => {
      damageCalls.push(damage)
      return Effect.succeed(true)
    }
    const movement: SurvivalMovementState = {
      distanceMoved: 0,
      inCreative: false,
      isGrounded: false,
      isSneaking: false,
      isSprinting: false,
    }
    const refreshedPos = { x: 1, y: 64, z: 1 }

    await Effect.runPromise(
      applySurvivalHazardEffects(
        services,
        refs,
        makeDefaultInputs(LIGHTNING_DAMAGE_INTERVAL_SECS),
        refreshedPos,
        movement,
        'AIR',
        'AIR',
        false,
        true,
        applyDamage,
      ),
    )

    expect(damageCalls).toEqual([LIGHTNING_DAMAGE])
    expect((services.soundManager.playEffect as ReturnType<typeof vi.fn>).mock.calls).toEqual([
      ['playerHurt', { position: refreshedPos }],
    ])
    expect(MutableRef.get(refs.lightningDamageSecsRef)).toBe(0)
  })
})
