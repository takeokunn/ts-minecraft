import { Effect, HashMap, MutableRef, Option } from 'effect'
import { vi } from 'vitest'
import { emptyEquipmentSlots } from '../../../../../inventory/application/equipment-persistence'
import type { PhysicsStageInputs } from '../physics-stage-types/inputs'
import type { PhysicsStageRefs } from '../physics-stage-types/refs'
import type { PhysicsStageServices } from '../physics-stage-types/services'

export const makeDefaultInputs = (deltaTime: number): PhysicsStageInputs =>
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

export const makeDefaultRefs = (airSecs = 0, lastAirBubbles = 10): PhysicsStageRefs =>
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

export const makeDefaultServices = () => {
  const playEffect = vi.fn(() => Effect.void)
  const getEquippedItem = vi.fn(() => Effect.succeed(Option.none()))
  const flash = vi.fn(() => Effect.void)
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
    damageOverlay: {
      flash,
    },
  } as PhysicsStageServices & {
    readonly soundManager: {
      readonly playEffect: ReturnType<typeof vi.fn>
    }
    readonly equipmentService: {
      readonly getEquippedItem: ReturnType<typeof vi.fn>
    }
    readonly damageOverlay: {
      readonly flash: ReturnType<typeof vi.fn>
    }
  }
}
