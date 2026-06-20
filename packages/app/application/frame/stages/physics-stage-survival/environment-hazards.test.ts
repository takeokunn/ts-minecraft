import { Effect, HashMap, MutableRef, Option } from 'effect'
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
import { emptyEquipmentSlots } from '../../../../../inventory/application/equipment-persistence'
import type { PhysicsStageInputs } from '../physics-stage-types/inputs'
import type { PhysicsStageRefs } from '../physics-stage-types/refs'
import type { PhysicsStageServices } from '../physics-stage-types/services'
import { applySurvivalHazardEffects } from './environment-hazards'
import type { SurvivalMovementState } from './types'

const makeInputs = (deltaTime: number): PhysicsStageInputs =>
  ({
    deltaTime,
    initialPlayerPos: { x: 0, y: 0, z: 0 },
    healthValueElementOrNull: null,
    healthMaxElementOrNull: null,
    hungerValueElementOrNull: null,
    hungerMaxElementOrNull: null,
    xpLevelElementOrNull: null,
    xpBarElementOrNull: null,
    xpBarMaxElementOrNull: null,
    armorValueElementOrNull: null,
    airElementOrNull: null,
    debugFlags: {} as never,
    difficulty: 'NORMAL' as never,
  }) as unknown as PhysicsStageInputs

const makeRefs = (): PhysicsStageRefs =>
  ({
    lastHealthRef: MutableRef.make(0),
    lastHungerRef: MutableRef.make(0),
    lastXPRef: MutableRef.make(0),
    lastArmorRef: MutableRef.make(0),
    portalSecsRef: MutableRef.make(0),
    dirtyChunksRef: MutableRef.make(HashMap.empty<string, unknown>()),
    lavaDamageSecsRef: MutableRef.make(0),
    lavaBurnRemainingSecsRef: MutableRef.make(0),
    lavaBurnDamageSecsRef: MutableRef.make(0),
    airSecsRef: MutableRef.make(10),
    drownDamageSecsRef: MutableRef.make(0),
    suffocationDamageSecsRef: MutableRef.make(0),
    lightningDamageSecsRef: MutableRef.make(0),
    voidDamageSecsRef: MutableRef.make(0),
    lastAirBubblesRef: MutableRef.make(10),
    isShieldBlockingRef: MutableRef.make(false),
    wasGroundedRef: MutableRef.make(false),
    footstepDistanceAccumulatorRef: MutableRef.make(0),
    finalPosRef: MutableRef.make({ x: 0, y: 0, z: 0 }),
    healthTickAccumulatorRef: MutableRef.make(0),
    hungerTickAccumulatorRef: MutableRef.make(0),
    entityPhysicsChunkCacheRef: MutableRef.make(new Map()),
    lastEntityPhysicsChunkCoordRef: MutableRef.make(null),
  }) as unknown as PhysicsStageRefs

const makeServices = (): PhysicsStageServices => {
  const playEffect = vi.fn(() => Effect.void)
  return {
    chunkManagerService: {
      getChunk: vi.fn(() => Effect.void),
    },
    equipmentService: {
      getAll: vi.fn(() => Effect.succeed(emptyEquipmentSlots())),
      getEquippedItem: vi.fn(() => Effect.succeed(Option.none())),
    },
    soundManager: {
      playEffect,
    },
  } as never
}

describe('physics-stage-survival/environment-hazards', () => {
  it('applies cadenced hazard damage for lava, suffocation, and the void', async () => {
    const services = makeServices()
    const refs = makeRefs()
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
        makeInputs(VOID_DAMAGE_INTERVAL_SECS),
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
    const services = makeServices()
    const refs = makeRefs()
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
        makeInputs(0),
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
    const services = makeServices()
    const refs = makeRefs()
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
        makeInputs(0.5),
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
        makeInputs(1),
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
    const services = makeServices()
    const refs = makeRefs()
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
        makeInputs(1),
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
    const services = makeServices()
    const refs = makeRefs()
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
        makeInputs(LIGHTNING_DAMAGE_INTERVAL_SECS),
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
