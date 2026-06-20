import { Effect, HashMap, MutableRef, Option } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import {
  DROWN_DAMAGE,
  DROWN_DAMAGE_INTERVAL_SECS,
} from '@ts-minecraft/entity/domain/environment-hazard.config'
import { emptyEquipmentSlots } from '../../../../../inventory/application/equipment-persistence'
import type { PhysicsStageInputs } from '../physics-stage-types/inputs'
import type { PhysicsStageRefs } from '../physics-stage-types/refs'
import type { PhysicsStageServices } from '../physics-stage-types/services'
import { applySurvivalAirEffects } from './environment-air'
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

const makeRefs = (airSecs = 0, lastAirBubbles = 10): PhysicsStageRefs =>
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
    airSecsRef: MutableRef.make(airSecs),
    drownDamageSecsRef: MutableRef.make(0),
    suffocationDamageSecsRef: MutableRef.make(0),
    lightningDamageSecsRef: MutableRef.make(0),
    voidDamageSecsRef: MutableRef.make(0),
    lastAirBubblesRef: MutableRef.make(lastAirBubbles),
    isShieldBlockingRef: MutableRef.make(false),
    wasGroundedRef: MutableRef.make(false),
    footstepDistanceAccumulatorRef: MutableRef.make(0),
    finalPosRef: MutableRef.make({ x: 0, y: 0, z: 0 }),
    healthTickAccumulatorRef: MutableRef.make(0),
    hungerTickAccumulatorRef: MutableRef.make(0),
    entityPhysicsChunkCacheRef: MutableRef.make(new Map()),
    lastEntityPhysicsChunkCoordRef: MutableRef.make(null),
  }) as unknown as PhysicsStageRefs

const makeServices = () => {
  const playEffect = vi.fn(() => Effect.void)
  const getEquippedItem = vi.fn(() => Effect.succeed(Option.none()))
  return {
    chunkManagerService: {
      getChunk: vi.fn(() => Effect.void),
    },
    equipmentService: {
      getAll: vi.fn(() => Effect.succeed(emptyEquipmentSlots())),
      getEquippedItem,
    },
    soundManager: {
      playEffect,
    },
  } as PhysicsStageServices & {
    readonly soundManager: {
      readonly playEffect: ReturnType<typeof vi.fn>
    }
    readonly equipmentService: {
      readonly getEquippedItem: ReturnType<typeof vi.fn>
    }
  }
}

describe('physics-stage-survival/environment-air', () => {
  it('syncs the air meter and applies drowning damage while submerged', async () => {
    const services = makeServices()
    const refs = makeRefs()
    const airElement = { style: { display: 'none' }, textContent: 'before' } as unknown as HTMLElement
    const refreshedPos = { x: 2, y: 70, z: -3 }
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

    await Effect.runPromise(
      applySurvivalAirEffects(
        {
          ...services,
          equipmentService: {
            ...services.equipmentService,
            getEquippedItem: services.equipmentService.getEquippedItem,
          },
        } as PhysicsStageServices,
        refs,
        {
          ...makeInputs(DROWN_DAMAGE_INTERVAL_SECS),
          airElementOrNull: airElement,
        },
        refreshedPos,
        movement,
        'WATER',
        applyDamage,
      ),
    )

    expect(services.equipmentService.getEquippedItem).toHaveBeenCalledOnce()
    expect(damageCalls).toEqual([DROWN_DAMAGE])
    expect(services.soundManager.playEffect).toHaveBeenCalledOnce()
    expect(services.soundManager.playEffect).toHaveBeenCalledWith('playerHurt', { position: refreshedPos })
    expect(airElement.style.display).toBe('block')
    expect(airElement.textContent).toBe('💀 Drowning')
    expect(MutableRef.get(refs.airSecsRef)).toBe(0)
    expect(MutableRef.get(refs.lastAirBubblesRef)).toBe(0)
  })
})
