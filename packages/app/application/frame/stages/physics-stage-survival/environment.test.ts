import { Effect, HashMap, MutableRef, Option } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex, type BlockTypeIndex, type DeltaTimeSecs } from '@ts-minecraft/core'
import { describe, expect, it } from 'vitest'
import type { Weather } from '@ts-minecraft/game'
import {
  CACTUS_DAMAGE,
  DROWN_DAMAGE,
  DROWN_DAMAGE_INTERVAL_SECS,
  LAVA_DAMAGE,
  LAVA_DAMAGE_INTERVAL_SECS,
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
import { applySurvivalEnvironmentEffects } from './environment'
import type { SurvivalMovementState } from './types'

const CHUNK_BLOCK_COUNT = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT

const AIR = blockTypeToIndex('AIR')
const STONE = blockTypeToIndex('STONE')
const WATER = blockTypeToIndex('WATER')
const LAVA = blockTypeToIndex('LAVA')
const CACTUS = blockTypeToIndex('CACTUS')

const makeChunk = (): { readonly blocks: Uint8Array } => {
  const blocks = new Uint8Array(CHUNK_BLOCK_COUNT)
  blocks.fill(AIR)
  return { blocks }
}

const setChunkBlock = (blocks: Uint8Array, x: number, y: number, z: number, blockIndex: BlockTypeIndex): void => {
  blocks[y + z * CHUNK_HEIGHT + x * CHUNK_HEIGHT * CHUNK_SIZE] = blockIndex
}

const setColumnBlock = (blocks: Uint8Array, y: number, blockIndex: BlockTypeIndex): void => {
  setChunkBlock(blocks, 0, y, 0, blockIndex)
}

const makeMovement = (overrides: Partial<SurvivalMovementState> = {}): SurvivalMovementState => ({
  inCreative: false,
  isGrounded: false,
  isSprinting: false,
  isSneaking: false,
  distanceMoved: 0,
  ...overrides,
})

const makeInputs = (overrides: Partial<PhysicsStageInputs> = {}): PhysicsStageInputs =>
  ({
    deltaTime: 0,
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
    ...overrides,
  }) as PhysicsStageInputs

type TestServices = {
  readonly chunkManagerService: {
    readonly getChunkCalls: Array<{ readonly x: number; readonly z: number }>
  }
  readonly equipmentService: {
    readonly getAllCalls: number[]
    readonly getEquippedItemCalls: string[]
  }
  readonly soundManager: {
    readonly playEffectCalls: Array<readonly [string, unknown]>
  }
  readonly weatherService: {
    readonly getWeatherCalls: number[]
  }
}

const makeServices = (
  chunk: { readonly blocks: Uint8Array },
  weather: Weather = 'clear',
): PhysicsStageServices & TestServices => {
  const getChunkCalls: Array<{ readonly x: number; readonly z: number }> = []
  const getAllCalls: number[] = []
  const getEquippedItemCalls: string[] = []
  const playEffectCalls: TestServices['soundManager']['playEffectCalls'] = []
  const getWeatherCalls: number[] = []

  return {
    chunkManagerService: {
      getChunk: (coord: { readonly x: number; readonly z: number }) => {
        getChunkCalls.push(coord)
        return Effect.succeed(chunk)
      },
      getChunkCalls,
    },
    equipmentService: {
      getAll: () => {
        getAllCalls.push(1)
        return Effect.succeed(emptyEquipmentSlots())
      },
      getAllCalls,
      getEquippedItem: (slot: string) => {
        getEquippedItemCalls.push(slot)
        return Effect.succeed(Option.none())
      },
      getEquippedItemCalls,
    },
    soundManager: {
      playEffect: (effectName: string, options: unknown) => {
        playEffectCalls.push([effectName, options])
        return Effect.void
      },
      playEffectCalls,
    },
    weatherService: {
      getWeather: () => {
        getWeatherCalls.push(1)
        return Effect.succeed(weather)
      },
      getWeatherCalls,
    },
  } as unknown as PhysicsStageServices & TestServices
}

const makeRefs = (overrides: Partial<Record<keyof PhysicsStageRefs, number>> = {}): PhysicsStageRefs => {
  return {
    lastHealthRef: MutableRef.make(0),
    lastHungerRef: MutableRef.make(0),
    lastXPRef: MutableRef.make(0),
    lastArmorRef: MutableRef.make(0),
    portalSecsRef: MutableRef.make(0),
    dirtyChunksRef: MutableRef.make(HashMap.empty<string, unknown>()),
    lavaDamageSecsRef: MutableRef.make(overrides.lavaDamageSecsRef ?? 0),
    lavaBurnRemainingSecsRef: MutableRef.make(overrides.lavaBurnRemainingSecsRef ?? 0),
    lavaBurnDamageSecsRef: MutableRef.make(overrides.lavaBurnDamageSecsRef ?? 0),
    airSecsRef: MutableRef.make(overrides.airSecsRef ?? 10),
    drownDamageSecsRef: MutableRef.make(overrides.drownDamageSecsRef ?? 0),
    suffocationDamageSecsRef: MutableRef.make(overrides.suffocationDamageSecsRef ?? 0),
    lightningDamageSecsRef: MutableRef.make(overrides.lightningDamageSecsRef ?? 0),
    voidDamageSecsRef: MutableRef.make(overrides.voidDamageSecsRef ?? 0),
    lastAirBubblesRef: MutableRef.make(overrides.lastAirBubblesRef ?? 10),
    isShieldBlockingRef: MutableRef.make(false),
    wasGroundedRef: MutableRef.make(false),
    footstepDistanceAccumulatorRef: MutableRef.make(overrides.footstepDistanceAccumulatorRef ?? 0),
    finalPosRef: MutableRef.make({ x: 0, y: 0, z: 0 }),
    healthTickAccumulatorRef: MutableRef.make(0),
    hungerTickAccumulatorRef: MutableRef.make(0),
    entityPhysicsChunkCacheRef: MutableRef.make(new Map()),
    lastEntityPhysicsChunkCoordRef: MutableRef.make(null),
  } as unknown as PhysicsStageRefs
}

describe('physics-stage-survival/environment', () => {
  it('applies lava and suffocation damage, and hides the air UI on land', async () => {
    const chunk = makeChunk()
    setColumnBlock(chunk.blocks, 61, STONE)
    setColumnBlock(chunk.blocks, 62, LAVA)
    setColumnBlock(chunk.blocks, 63, STONE)

    const services = makeServices(chunk)
    const refs = await makeRefs({ lastAirBubblesRef: 0 })
    const airElement = { style: { display: 'block' }, textContent: 'before' } as unknown as HTMLElement
    const inputs = makeInputs({
      deltaTime: LAVA_DAMAGE_INTERVAL_SECS as DeltaTimeSecs,
      airElementOrNull: airElement,
    })
    const movement = makeMovement({ isGrounded: true })
    const refreshedPos = { x: 0, y: 62.3, z: 0 }
    const damageCalls: number[] = []
    const applyDamage = (damage: number) => {
      damageCalls.push(damage)
      return Effect.succeed(true)
    }

    await Effect.runPromise(applySurvivalEnvironmentEffects(services, refs, inputs, refreshedPos, movement, applyDamage))

    expect(services.chunkManagerService.getChunkCalls).toContainEqual({ x: 0, z: 0 })
    expect(services.equipmentService.getAllCalls).toEqual([1])
    expect(damageCalls).toEqual([LAVA_DAMAGE, SUFFOCATION_DAMAGE])
    expect(services.soundManager.playEffectCalls).toEqual([
      ['playerHurt', { position: refreshedPos }],
      ['playerHurt', { position: refreshedPos }],
    ])
    expect(airElement.style.display).toBe('none')
    expect(airElement.textContent).toBe('before')
    expect(MutableRef.get(refs.lastAirBubblesRef)).toBe(10)
  })

  it('applies void damage below the world without touching the air UI', async () => {
    const chunk = makeChunk()
    const services = makeServices(chunk)
    const refs = await makeRefs()
    const damageCalls: number[] = []
    const applyDamage = (damage: number) => {
      damageCalls.push(damage)
      return Effect.succeed(true)
    }
    const refreshedPos = { x: 0, y: VOID_DAMAGE_Y - 1, z: 0 }

    await Effect.runPromise(
      applySurvivalEnvironmentEffects(
        services,
        refs,
        makeInputs({ deltaTime: VOID_DAMAGE_INTERVAL_SECS as DeltaTimeSecs }),
        refreshedPos,
        makeMovement(),
        applyDamage,
      ),
    )

    expect(services.chunkManagerService.getChunkCalls).toContainEqual({ x: 0, z: 0 })
    expect(damageCalls).toEqual([VOID_DAMAGE])
    expect(services.soundManager.playEffectCalls).toEqual([['playerHurt', { position: refreshedPos }]])
    expect(MutableRef.get(refs.lastAirBubblesRef)).toBe(10)
  })

  it('updates the air meter and applies drowning damage while submerged', async () => {
    const chunk = makeChunk()
    setColumnBlock(chunk.blocks, 63, WATER)

    const services = makeServices(chunk)
    const refs = await makeRefs({ airSecsRef: 0, lastAirBubblesRef: 10 })
    const airElement = { style: { display: 'none' }, textContent: 'before' } as unknown as HTMLElement
    const inputs = makeInputs({
      deltaTime: DROWN_DAMAGE_INTERVAL_SECS as DeltaTimeSecs,
      airElementOrNull: airElement,
    })
    const movement = makeMovement()
    const refreshedPos = { x: 0, y: 62.3, z: 0 }
    const damageCalls: number[] = []
    const applyDamage = (damage: number) => {
      damageCalls.push(damage)
      return Effect.succeed(true)
    }

    await Effect.runPromise(applySurvivalEnvironmentEffects(services, refs, inputs, refreshedPos, movement, applyDamage))

    expect(services.chunkManagerService.getChunkCalls).toContainEqual({ x: 0, z: 0 })
    expect(services.equipmentService.getEquippedItemCalls).toEqual(['HELMET'])
    expect(damageCalls).toEqual([DROWN_DAMAGE])
    expect(services.soundManager.playEffectCalls).toEqual([['playerHurt', { position: refreshedPos }]])
    expect(airElement.style.display).toBe('block')
    expect(airElement.textContent).toBe('💀 Drowning')
    expect(MutableRef.get(refs.airSecsRef)).toBe(0)
    expect(MutableRef.get(refs.lastAirBubblesRef)).toBe(0)
  })

  it('applies cactus contact damage when the player body touches an adjacent cactus', async () => {
    const chunk = makeChunk()
    setChunkBlock(chunk.blocks, 1, 61, 0, CACTUS)
    setChunkBlock(chunk.blocks, 1, 62, 0, CACTUS)

    const services = makeServices(chunk)
    const refs = await makeRefs()
    const refreshedPos = { x: 0.69, y: 62.3, z: 0.5 }
    const damageCalls: number[] = []
    const applyDamage = (damage: number) => {
      damageCalls.push(damage)
      return Effect.succeed(true)
    }

    await Effect.runPromise(
      applySurvivalEnvironmentEffects(
        services,
        refs,
        makeInputs(),
        refreshedPos,
        makeMovement(),
        applyDamage,
      ),
    )

    expect(services.chunkManagerService.getChunkCalls).toContainEqual({ x: 0, z: 0 })
    expect(damageCalls).toEqual([CACTUS_DAMAGE])
    expect(services.soundManager.playEffectCalls).toEqual([['playerHurt', { position: refreshedPos }]])
  })

  it('applies lightning damage during thunder when the player is exposed to the sky', async () => {
    const chunk = makeChunk()
    const services = makeServices(chunk, 'thunder')
    const refs = await makeRefs()
    const refreshedPos = { x: 0, y: 62.3, z: 0 }
    const damageCalls: number[] = []
    const applyDamage = (damage: number) => {
      damageCalls.push(damage)
      return Effect.succeed(true)
    }

    await Effect.runPromise(
      applySurvivalEnvironmentEffects(
        services,
        refs,
        makeInputs({ deltaTime: LIGHTNING_DAMAGE_INTERVAL_SECS as DeltaTimeSecs }),
        refreshedPos,
        makeMovement(),
        applyDamage,
      ),
    )

    expect(services.weatherService.getWeatherCalls).toEqual([1])
    expect(damageCalls).toEqual([LIGHTNING_DAMAGE])
    expect(services.soundManager.playEffectCalls).toEqual([['playerHurt', { position: refreshedPos }]])
    expect(MutableRef.get(refs.lightningDamageSecsRef)).toBe(0)
  })

  it('prevents thunder lightning damage when a solid block covers the player', async () => {
    const chunk = makeChunk()
    setColumnBlock(chunk.blocks, 70, STONE)

    const services = makeServices(chunk, 'thunder')
    const refs = await makeRefs()
    const refreshedPos = { x: 0, y: 62.3, z: 0 }
    const damageCalls: number[] = []
    const applyDamage = (damage: number) => {
      damageCalls.push(damage)
      return Effect.succeed(true)
    }

    await Effect.runPromise(
      applySurvivalEnvironmentEffects(
        services,
        refs,
        makeInputs({ deltaTime: LIGHTNING_DAMAGE_INTERVAL_SECS as DeltaTimeSecs }),
        refreshedPos,
        makeMovement(),
        applyDamage,
      ),
    )

    expect(services.weatherService.getWeatherCalls).toEqual([1])
    expect(damageCalls).toEqual([])
    expect(services.soundManager.playEffectCalls).toEqual([])
    expect(MutableRef.get(refs.lightningDamageSecsRef)).toBe(0)
  })
})
