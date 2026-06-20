import { afterEach, describe, it, expect, vi } from 'vitest'
import { Effect, Option } from 'effect'
import * as THREE from 'three'
import { DEFAULT_PLAYER_ID, SlotIndex } from '@ts-minecraft/core'
import { EntityType } from '@ts-minecraft/entity/domain/mob/entity'
import { EXHAUSTION_DAMAGE } from '@ts-minecraft/entity/application/hunger-service.config'
import type { FrameHandlerDeps } from '@ts-minecraft/app/application/frame/types/deps'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import {
  ENDER_PEARL_DAMAGE,
  ENDER_PEARL_ENDERMITE_SPAWN_CHANCE,
  ENDER_PEARL_MAX_DISTANCE,
  handleEnderPearlThrow,
  resolveEnderPearlTeleportTarget,
  shouldSpawnEndermiteFromEnderPearl,
} from './interaction-item-use-handler/ender-pearl'
import { selectedHotbarSlotIndex } from './selected-hotbar-slot'

const PLAYER_POSITION = { x: 10, y: 64, z: 10 }

afterEach(() => {
  vi.restoreAllMocks()
})

type EnderPearlDeps = Pick<FrameHandlerDeps, 'camera'>

type EnderPearlServices = Pick<
  FrameHandlerServices,
  'hotbarService' | 'inventoryService' | 'gameMode' | 'gameState' | 'entityManager' | 'healthService' | 'hungerService'
>

const makeDeps = (direction: THREE.Vector3): EnderPearlDeps => ({
  camera: {
    getWorldDirection: vi.fn((target: THREE.Vector3) => target.copy(direction)),
  },
})

const makeServices = (): EnderPearlServices => ({
  hotbarService: {
    getSelectedBlockType: vi.fn(() => Effect.succeed(Option.some('ENDER_PEARL'))),
    getSelectedSlot: vi.fn(() => Effect.succeed(SlotIndex.make(2))),
  },
  inventoryService: {
    removeBlock: vi.fn(() => Effect.void),
  },
  gameMode: {
    isCreative: vi.fn(() => Effect.succeed(false)),
  },
  gameState: {
    getPlayerPosition: vi.fn(() => Effect.succeed(PLAYER_POSITION)),
    setPlayerPosition: vi.fn(() => Effect.void),
  },
  healthService: {
    applyDamage: vi.fn(() => Effect.void),
  },
  hungerService: {
    addExhaustion: vi.fn(() => Effect.void),
  },
  entityManager: {
    addEntity: vi.fn(() => Effect.succeed('entity-endermite')),
  },
})

describe('resolveEnderPearlTeleportTarget', () => {
  it('uses the target hit distance when a block is targeted', () => {
    const result = resolveEnderPearlTeleportTarget(
      PLAYER_POSITION,
      new THREE.Vector3(0, 0, -1),
      Option.some({ blockX: 10, blockY: 64, blockZ: 4, distance: 6, normal: { x: 0, y: 0, z: 1 } }),
    )

    expect(result).toEqual({ x: 10, y: 64, z: 4 })
  })

  it('uses the max distance when no block is targeted', () => {
    const result = resolveEnderPearlTeleportTarget(PLAYER_POSITION, new THREE.Vector3(1, 0, 0), Option.none())

    expect(result).toEqual({ x: 10 + ENDER_PEARL_MAX_DISTANCE, y: 64, z: 10 })
  })
})

describe('shouldSpawnEndermiteFromEnderPearl', () => {
  it('uses a 5% chance with an exclusive upper boundary', () => {
    expect(shouldSpawnEndermiteFromEnderPearl(0)).toBe(true)
    expect(shouldSpawnEndermiteFromEnderPearl(ENDER_PEARL_ENDERMITE_SPAWN_CHANCE - 0.001)).toBe(true)
    expect(shouldSpawnEndermiteFromEnderPearl(ENDER_PEARL_ENDERMITE_SPAWN_CHANCE)).toBe(false)
    expect(shouldSpawnEndermiteFromEnderPearl(1)).toBe(false)
  })
})

describe('handleEnderPearlThrow', () => {
  it('returns false when selected item is not ENDER_PEARL', async () => {
    const deps = makeDeps(new THREE.Vector3(0, 0, -1))
    const services = makeServices()
    services.hotbarService.getSelectedBlockType.mockReturnValue(Effect.succeed(Option.some('STONE')))

    const result = await Effect.runPromise(handleEnderPearlThrow(deps, services, { targetHit: Option.none() }))

    expect(result).toBe(false)
    expect(services.inventoryService.removeBlock).not.toHaveBeenCalled()
    expect(services.gameState.setPlayerPosition).not.toHaveBeenCalled()
  })

  it('survival consumes one pearl and teleports along the camera direction', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const deps = makeDeps(new THREE.Vector3(0, 0, -1))
    const services = makeServices()

    const result = await Effect.runPromise(handleEnderPearlThrow(deps, services, {
      targetHit: Option.some({ blockX: 10, blockY: 64, blockZ: 4, distance: 6, normal: { x: 0, y: 0, z: 1 } }),
    }))

    expect(result).toBe(true)
    expect(services.gameState.getPlayerPosition).toHaveBeenCalledWith(DEFAULT_PLAYER_ID)
    expect(services.inventoryService.removeBlock).toHaveBeenCalledWith('ENDER_PEARL', 1, selectedHotbarSlotIndex(SlotIndex.make(2)))
    expect(services.gameState.setPlayerPosition).toHaveBeenCalledWith({ x: 10, y: 64, z: 4 })
    expect(services.healthService.applyDamage).toHaveBeenCalledWith(ENDER_PEARL_DAMAGE)
    expect(services.hungerService.addExhaustion).toHaveBeenCalledWith(EXHAUSTION_DAMAGE)
    expect(services.entityManager.addEntity).not.toHaveBeenCalled()
  })

  it('creative teleports without consuming an item', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const deps = makeDeps(new THREE.Vector3(1, 0, 0))
    const services = makeServices()
    services.gameMode.isCreative.mockReturnValue(Effect.succeed(true))

    const result = await Effect.runPromise(handleEnderPearlThrow(deps, services, { targetHit: Option.none() }))

    expect(result).toBe(true)
    expect(services.inventoryService.removeBlock).not.toHaveBeenCalled()
    expect(services.gameState.setPlayerPosition).toHaveBeenCalledWith({ x: 10 + ENDER_PEARL_MAX_DISTANCE, y: 64, z: 10 })
    expect(services.healthService.applyDamage).not.toHaveBeenCalled()
    expect(services.hungerService.addExhaustion).not.toHaveBeenCalled()
    expect(services.entityManager.addEntity).not.toHaveBeenCalled()
  })

  it('spawns an Endermite at the teleport target on a successful 5% roll', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.049)
    const deps = makeDeps(new THREE.Vector3(0, 0, -1))
    const services = makeServices()

    const result = await Effect.runPromise(handleEnderPearlThrow(deps, services, {
      targetHit: Option.some({ blockX: 10, blockY: 64, blockZ: 4, distance: 6, normal: { x: 0, y: 0, z: 1 } }),
    }))

    expect(result).toBe(true)
    expect(services.gameState.setPlayerPosition).toHaveBeenCalledWith({ x: 10, y: 64, z: 4 })
    expect(services.entityManager.addEntity).toHaveBeenCalledWith(EntityType.Endermite, { x: 10, y: 64, z: 4 })
  })

  it('does not teleport when survival item consumption fails', async () => {
    const deps = makeDeps(new THREE.Vector3(0, 0, -1))
    const services = makeServices()
    services.inventoryService.removeBlock.mockReturnValue(Effect.fail('slot-empty'))

    const result = await Effect.runPromise(handleEnderPearlThrow(deps, services, { targetHit: Option.none() }))

    expect(result).toBe(false)
    expect(services.gameState.setPlayerPosition).not.toHaveBeenCalled()
    expect(services.healthService.applyDamage).not.toHaveBeenCalled()
    expect(services.hungerService.addExhaustion).not.toHaveBeenCalled()
  })
})
